// ─────────────────────────────────────────────────────────────────────────────
// ai-picks-chat
// Conversational endpoint. On every turn:
//   1. Pulls fresh odds for major sports from The Odds API
//   2. Computes the Bet365-vs-market-avg edge table
//   3. Hands Claude the conversation history + top edge candidates
//   4. Returns Claude's reply as plain markdown text
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.3";

const MAX_HISTORY      = 12;   // turns kept
const MAX_CANDIDATES   = 18;   // shortlist size into Claude
const NEUTRAL_THRESH   = 0.5;  // %  ±this is "neutral"
const RATE_LIMIT_SECS  = 8;    // floor between requests per user

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SPORT_LABELS: Record<string, { league: string; correctScore: boolean }> = {
  americanfootball_nfl:    { league: "NFL",        correctScore: false },
  basketball_nba:          { league: "NBA",        correctScore: false },
  baseball_mlb:            { league: "MLB",        correctScore: false },
  icehockey_nhl:           { league: "NHL",        correctScore: false },
  soccer_fifa_world_cup:   { league: "World Cup",  correctScore: true  },
  soccer_epl:              { league: "EPL",        correctScore: true  },
  soccer_uefa_champs_league: { league: "UCL",      correctScore: true  },
  soccer_usa_mls:          { league: "MLS",        correctScore: true  },
  mma_mixed_martial_arts:  { league: "MMA",        correctScore: false },
};

const DEFAULT_SPORTS = Object.keys(SPORT_LABELS);

type BookOdds = { key: string; title: string; odds: number; point?: number };

function americanToDecimal(o: number): number {
  return o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
}
function decimalToAmerican(d: number): number {
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}
function fmt(o: number): string { return `${o > 0 ? "+" : ""}${o}`; }
function isBet365(k: string, t: string): boolean {
  const a = (k ?? "").toLowerCase(); const b = (t ?? "").toLowerCase();
  return a.includes("bet365") || b.includes("bet365") || b.includes("bet 365");
}

type Edge = {
  league: string; away: string; home: string; commence: string;
  market: string; selection: string;
  bet365_odds: number; avg_odds: number; edge_pct: number;
  status: "edge" | "neutral" | "no_edge";
  other_books: { title: string; odds: number }[];
};

function analyseGame(game: any, league: string): Edge[] {
  const out: Edge[] = [];
  const buckets: Record<string, BookOdds[]> = {};
  const labels: Record<string, { market: string; selection: string }> = {};

  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      if (!["h2h", "spreads", "totals"].includes(market.key)) continue;
      for (const o of market.outcomes ?? []) {
        const k = `${market.key}|${o.name}|${o.point ?? ""}`;
        (buckets[k] ??= []).push({ key: bm.key, title: bm.title, odds: o.price, point: o.point });
        if (!labels[k]) {
          if (market.key === "h2h") labels[k] = { market: "Moneyline", selection: o.name };
          else if (market.key === "spreads") {
            const pt = o.point > 0 ? `+${o.point}` : `${o.point}`;
            labels[k] = { market: `Spread ${pt}`, selection: `${o.name} ${pt}` };
          } else labels[k] = { market: `${o.name} ${o.point}`, selection: `${o.name} ${o.point}` };
        }
      }
    }
  }

  for (const [k, books] of Object.entries(buckets)) {
    if (books.length < 2) continue;
    const b365 = books.find(b => isBet365(b.key, b.title));
    if (!b365) continue;
    const others = books.filter(b => !isBet365(b.key, b.title));
    if (others.length === 0) continue;

    const avgDec = others.reduce((s, b) => s + americanToDecimal(b.odds), 0) / others.length;
    const b365Dec = americanToDecimal(b365.odds);
    const edge = (b365Dec / avgDec - 1) * 100;

    let status: Edge["status"] = "edge";
    if (Math.abs(edge) <= NEUTRAL_THRESH) status = "neutral";
    else if (edge < 0) status = "no_edge";

    out.push({
      league, away: game.away_team, home: game.home_team, commence: game.commence_time,
      market: labels[k].market, selection: labels[k].selection,
      bet365_odds: b365.odds, avg_odds: decimalToAmerican(avgDec),
      edge_pct: Math.round(edge * 100) / 100, status,
      other_books: others.slice(0, 5).map(b => ({ title: b.title, odds: b.odds })),
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Light rate limit (8s floor)
    const { data: profile } = await supabase
      .from("profiles").select("last_chat_request").eq("id", user.id).single();
    if (profile?.last_chat_request) {
      const since = (Date.now() - new Date(profile.last_chat_request).getTime()) / 1000;
      if (since < RATE_LIMIT_SECS) {
        return new Response(
          JSON.stringify({ error: `Slow down — wait ${Math.ceil(RATE_LIMIT_SECS - since)}s` }),
          { status: 429, headers: corsHeaders },
        );
      }
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const messages: { role: "user" | "assistant"; content: string }[] =
      Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "Need a user message at end of history" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // ── Fetch odds for major sports & analyse ───────────────────────────────
    const oddsKey = Deno.env.get("ODDS_API_KEY");
    if (!oddsKey) throw new Error("ODDS_API_KEY not configured");

    const allEdges: Edge[] = [];
    await Promise.allSettled(DEFAULT_SPORTS.map(async sport => {
      const label = SPORT_LABELS[sport];
      const r = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${oddsKey}` +
        `&regions=us,uk,eu&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`
      );
      if (!r.ok) return;
      const games: any[] = await r.json();
      for (const g of games.slice(0, 6)) {
        allEdges.push(...analyseGame(g, label.league));
      }
    }));

    // Sort by edge_pct desc; keep only those with positive edge for the shortlist
    const edges = allEdges.filter(e => e.status === "edge").sort((a, b) => b.edge_pct - a.edge_pct);
    const shortlist = edges.slice(0, MAX_CANDIDATES);

    // Build a compact text table for Claude
    const candTable = shortlist.length === 0
      ? "(no Bet365 positive-edge markets right now)"
      : shortlist.map((e, i) =>
          `${i + 1}. [${e.league}] ${e.away} @ ${e.home} — ${e.market} ${e.selection} | ` +
          `Bet365 ${fmt(e.bet365_odds)} vs Avg ${fmt(e.avg_odds)} | Edge +${e.edge_pct}% | ` +
          `Others: ${e.other_books.map(b => `${b.title} ${fmt(b.odds)}`).join(", ")}`,
        ).join("\n");

    const stats = {
      total_outcomes_scanned: allEdges.length,
      positive_edge: allEdges.filter(e => e.status === "edge").length,
      neutral:       allEdges.filter(e => e.status === "neutral").length,
      no_edge:       allEdges.filter(e => e.status === "no_edge").length,
    };

    // ── Call Claude ─────────────────────────────────────────────────────────
    const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const system = `You are Engie, a sports-betting analyst. You chat naturally with the user about today's games and value betting.

Hard rules — never break:
1. Bet365 is the reference sportsbook. The candidate list below is pre-filtered: every entry already has Bet365 priced ABOVE the average of the other US/UK/EU books — that's the value edge.
2. NEVER recommend a pick that isn't in the candidate list. If the user asks about a game/market not in the list, explain: "Bet365 doesn't have a positive edge on that right now" — do not invent edges.
3. When recommending picks, always cite the numbers: Bet365 odds, market avg, edge %.
4. Be concise. Use short paragraphs and bullet lists. Markdown allowed (**bold**, *italic*, bullet \`-\`).
5. If the user is just chatting (greetings, questions), respond normally — don't force picks.
6. Add a brief responsibility note when recommending bets ("Bet responsibly. Past results don't predict future ones.").
7. NEVER mention "candidate list" or "shortlist" as those terms — say "today's value plays" or "current Bet365 edges".

PICK SAVING (machine use only — users never see this):
When you explicitly recommend one or more specific picks in your reply, append this exact block at the VERY END of your response — after all text and disclaimers. It is stripped automatically before display; do NOT reference or explain it in your reply:
<picks>[{"idx": 1, "reasoning": "brief reason why this edge is compelling"}]</picks>
Rules for the block:
- "idx" is the 1-based line number from the VALUE PLAYS list below.
- Include only picks you actively recommend in THIS message (not previous turns).
- Omit the block entirely when you are chatting, answering questions, or making no specific recommendations.

Snapshot stats (current scan):
- ${stats.total_outcomes_scanned} markets scanned across NFL/NBA/MLB/NHL/EPL/UCL/MLS/MMA
- ${stats.positive_edge} markets where Bet365 has positive edge (value)
- ${stats.neutral} neutral / ${stats.no_edge} no edge

VALUE PLAYS RIGHT NOW (Bet365 odds > market average):
${candTable}`;

    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: messages.map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    });

    const rawReply = message.content
      .filter(c => c.type === "text")
      .map(c => (c as any).text)
      .join("\n");

    // ── Extract and save any picks Claude recommended ───────────────────────
    const picksBlockMatch = rawReply.match(/<picks>([\s\S]*?)<\/picks>/);
    const reply = rawReply.replace(/<picks>[\s\S]*?<\/picks>/g, "").trimEnd();

    const leagueToSport: Record<string, string> = {
      NFL: "americanfootball_nfl",
      NBA: "basketball_nba",
      MLB: "baseball_mlb",
      NHL: "icehockey_nhl",
      EPL: "soccer_epl",
      UCL: "soccer_uefa_champs_league",
      MLS: "soccer_usa_mls",
      MMA: "mma_mixed_martial_arts",
    };

    let savedPicks: any[] = [];
    if (picksBlockMatch) {
      try {
        const picksData: { idx: number; reasoning: string }[] = JSON.parse(picksBlockMatch[1]);
        const insertRows = picksData
          .map((p) => {
            const idx = Number(p.idx) - 1;
            const e = shortlist[idx];
            if (!e) return null;
            const vr = e.edge_pct >= 5 ? 9 : e.edge_pct >= 3 ? 8 : e.edge_pct >= 1.5 ? 7 : 6;
            const gameId = `${e.away.toLowerCase().replace(/\W+/g, "-")}_${e.home.toLowerCase().replace(/\W+/g, "-")}_${e.commence.slice(0, 10)}`;
            const betType = e.market.toLowerCase().includes("spread") ? "spread"
              : e.market.toLowerCase().includes("total") ? "total"
              : "moneyline";
            return {
              game_id:          gameId,
              sport:            leagueToSport[e.league] ?? "unknown",
              league:           e.league,
              home_team:        e.home,
              away_team:        e.away,
              commence_time:    e.commence,
              selection:        e.selection,
              bet_type:         betType,
              market:           e.market,
              recommended_odds: e.bet365_odds,
              bookmaker_key:    "bet365",
              value_rating:     vr,
              reasoning:        String(p.reasoning ?? ""),
              bet365_odds:      e.bet365_odds,
              avg_market_odds:  e.avg_odds,
              edge_pct:         e.edge_pct,
              model_version:    "claude-sonnet-4-6",
              expires_at:       new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
            };
          })
          .filter(Boolean);

        if (insertRows.length > 0) {
          const { data } = await supabase
            .from("ai_picks")
            .insert(insertRows)
            .select("id, away_team, home_team, selection, recommended_odds, edge_pct, league, bet_type");
          savedPicks = data ?? [];
        }
      } catch (pickErr) {
        console.warn("pick-save error:", pickErr);
      }
    }

    await supabase.from("profiles").update({
      last_chat_request: new Date().toISOString(),
    }).eq("id", user.id);

    return new Response(
      JSON.stringify({ reply, picks_saved: savedPicks, stats, candidate_count: shortlist.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("ai-picks-chat error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

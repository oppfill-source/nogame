// ─────────────────────────────────────────────────────────────────────────────
// generate-ai-picks (v2)
//
// Frontend POSTs prompt parameters; the function:
//   1. Fetches live odds from The Odds API for the requested sport(s)
//   2. For every market/outcome computes:
//        - Bet365 odds
//        - average odds across all OTHER bookmakers
//        - edge_pct = decimal(Bet365) / decimal(avg) - 1
//   3. Only outcomes where Bet365 has a positive edge survive to Claude
//   4. Claude returns strict JSON; we insert into ai_picks
//   5. Correct Score odds (soccer) are returned as a raw table — no AI logic
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.3";

const RATE_LIMIT_MINUTES = 5;
const NEUTRAL_EDGE_THRESHOLD = 0.5; // ±0.5% counts as "No Edge"
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SPORT_LABELS: Record<string, { league: string; correctScore: boolean }> = {
  americanfootball_nfl:    { league: "NFL",        correctScore: false },
  americanfootball_ncaaf:  { league: "NCAAF",      correctScore: false },
  basketball_nba:          { league: "NBA",        correctScore: false },
  basketball_ncaab:        { league: "NCAAB",      correctScore: false },
  baseball_mlb:            { league: "MLB",        correctScore: false },
  icehockey_nhl:           { league: "NHL",        correctScore: false },
  soccer_fifa_world_cup:   { league: "World Cup",  correctScore: true  },
  soccer_epl:              { league: "EPL",        correctScore: true  },
  soccer_uefa_champs_league: { league: "UCL",      correctScore: true  },
  soccer_usa_mls:          { league: "MLS",        correctScore: true  },
  soccer_spain_la_liga:    { league: "La Liga",    correctScore: true  },
  soccer_italy_serie_a:    { league: "Serie A",    correctScore: true  },
  soccer_germany_bundesliga: { league: "Bundesliga", correctScore: true },
  mma_mixed_martial_arts:  { league: "MMA",        correctScore: false },
};

const DEFAULT_SPORTS = [
  "americanfootball_nfl",
  "basketball_nba",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_fifa_world_cup",
  "soccer_epl",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

type BookOdds = { key: string; title: string; odds: number; point?: number };
type Outcome = {
  game_id: string;
  sport_key: string;
  league: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  market: string;            // "Moneyline" | "Spread +3.5" | "Over 47.5" etc
  market_type: "moneyline" | "spread" | "total";
  selection: string;         // outcome name displayed to user
  bet365: BookOdds | null;
  others: BookOdds[];
  avg_market_odds: number;   // average decimal of "others" converted back to american
  bet365_decimal: number;
  avg_decimal: number;
  edge_pct: number;          // positive => bet365 better than avg
  implied_prob_diff: number; // avg_implied - bet365_implied
  status: "edge" | "neutral" | "no_edge";
};

function americanToDecimal(odds: number): number {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

function decimalToAmerican(dec: number): number {
  if (dec >= 2) return Math.round((dec - 1) * 100);
  return Math.round(-100 / (dec - 1));
}

function impliedProb(american: number): number {
  return american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100);
}

function fmtAmerican(o: number): string {
  return `${o > 0 ? "+" : ""}${o}`;
}

// Match Bet365 by various keys the Odds API uses
function isBet365(key: string, title: string): boolean {
  const k = (key ?? "").toLowerCase();
  const t = (title ?? "").toLowerCase();
  return k.includes("bet365") || t.includes("bet365") || t.includes("bet 365");
}

// Build the cross-book outcome map for h2h / spreads / totals
function extractOutcomes(game: any, sportKey: string, league: string): Outcome[] {
  // key by `${marketKey}|${outcomeName}|${point ?? ""}`
  const buckets: Record<string, BookOdds[]> = {};
  const labels: Record<string, { market: string; market_type: Outcome["market_type"]; selection: string }> = {};

  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      if (!["h2h", "spreads", "totals"].includes(market.key)) continue;
      for (const outcome of market.outcomes ?? []) {
        const key = `${market.key}|${outcome.name}|${outcome.point ?? ""}`;
        const entry: BookOdds = {
          key: bm.key,
          title: bm.title,
          odds: outcome.price,
          point: outcome.point,
        };
        (buckets[key] ??= []).push(entry);

        if (!labels[key]) {
          if (market.key === "h2h") {
            labels[key] = {
              market: "Moneyline",
              market_type: "moneyline",
              selection: outcome.name,
            };
          } else if (market.key === "spreads") {
            const pt = outcome.point > 0 ? `+${outcome.point}` : `${outcome.point}`;
            labels[key] = {
              market: `Spread ${pt}`,
              market_type: "spread",
              selection: `${outcome.name} ${pt}`,
            };
          } else {
            labels[key] = {
              market: `${outcome.name} ${outcome.point}`,
              market_type: "total",
              selection: `${outcome.name} ${outcome.point}`,
            };
          }
        }
      }
    }
  }

  const outcomes: Outcome[] = [];
  for (const [key, books] of Object.entries(buckets)) {
    if (books.length < 2) continue; // need bet365 + at least one other
    const bet365 = books.find((b) => isBet365(b.key, b.title)) ?? null;
    if (!bet365) continue;

    const others = books.filter((b) => !isBet365(b.key, b.title));
    if (others.length === 0) continue;

    const otherDecs = others.map((o) => americanToDecimal(o.odds));
    const avgDec = otherDecs.reduce((a, b) => a + b, 0) / otherDecs.length;
    const b365Dec = americanToDecimal(bet365.odds);
    const edgePct = (b365Dec / avgDec - 1) * 100;
    const impliedDiff = impliedProb(decimalToAmerican(avgDec)) - impliedProb(bet365.odds);

    let status: Outcome["status"] = "edge";
    if (Math.abs(edgePct) <= NEUTRAL_EDGE_THRESHOLD) status = "neutral";
    else if (edgePct < 0) status = "no_edge";

    outcomes.push({
      game_id: game.id,
      sport_key: sportKey,
      league,
      home_team: game.home_team,
      away_team: game.away_team,
      commence_time: game.commence_time,
      market: labels[key].market,
      market_type: labels[key].market_type,
      selection: labels[key].selection,
      bet365,
      others,
      avg_market_odds: decimalToAmerican(avgDec),
      bet365_decimal: b365Dec,
      avg_decimal: avgDec,
      edge_pct: Math.round(edgePct * 100) / 100,
      implied_prob_diff: Math.round(impliedDiff * 1000) / 1000,
      status,
    });
  }
  return outcomes;
}

// Correct Score market — raw table only, no edge logic
function extractCorrectScore(game: any): Record<string, BookOdds[]> {
  const result: Record<string, BookOdds[]> = {};
  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      if (market.key !== "correct_score") continue;
      for (const outcome of market.outcomes ?? []) {
        const score = outcome.name;
        (result[score] ??= []).push({ key: bm.key, title: bm.title, odds: outcome.price });
      }
    }
  }
  return result;
}

// ─── main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Auth + rate limit ────────────────────────────────────────────────────
    const cronSecret = req.headers.get("x-cron-secret");
    const isCronCall = CRON_SECRET.length > 0 && cronSecret === CRON_SECRET;
    let userId: string | null = null;

    if (!isCronCall) {
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
      userId = user.id;

      const { data: profile } = await supabase
        .from("profiles").select("last_ai_request").eq("id", userId).single();

      if (profile?.last_ai_request) {
        const minutesSince =
          (Date.now() - new Date(profile.last_ai_request).getTime()) / 60_000;
        if (minutesSince < RATE_LIMIT_MINUTES) {
          const retryAfter = Math.ceil(RATE_LIMIT_MINUTES - minutesSince);
          return new Response(
            JSON.stringify({ error: "rate_limited", retry_after: retryAfter * 60 }),
            { status: 429, headers: { ...corsHeaders, "Retry-After": String(retryAfter * 60) } },
          );
        }
      }
    }

    // ── Parse prompt params ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const params = {
      sport:              String(body.sport ?? "all"),         // "all" or sport_key
      market_type:        String(body.market_type ?? "all"),   // all|moneyline|spread|total
      risk_level:         String(body.risk_level ?? "balanced"), // conservative|balanced|aggressive
      num_picks:          Math.min(10, Math.max(1, Number(body.num_picks ?? 5))),
      min_confidence:     Math.min(95, Math.max(40, Number(body.min_confidence ?? 55))),
      odds_min:           Number.isFinite(Number(body.odds_min)) ? Number(body.odds_min) : -1000,
      odds_max:           Number.isFinite(Number(body.odds_max)) ? Number(body.odds_max) : 1000,
      strategy:           String(body.strategy ?? "value"),    // safest|value|underdog|parlay
      explanation_detail: String(body.explanation_detail ?? "balanced"), // brief|balanced|detailed
      custom_prompt:      String(body.custom_prompt ?? "").slice(0, 800),
    };

    const sports = params.sport === "all"
      ? DEFAULT_SPORTS
      : [params.sport];

    // ── Fetch odds for chosen sports ─────────────────────────────────────────
    const oddsApiKey = Deno.env.get("ODDS_API_KEY");
    if (!oddsApiKey) throw new Error("ODDS_API_KEY not configured");

    const allOutcomes: Outcome[] = [];
    const correctScoreTable: Array<{
      game_id: string; league: string; home_team: string; away_team: string;
      commence_time: string; scores: Record<string, BookOdds[]>;
    }> = [];

    await Promise.allSettled(sports.map(async (sport) => {
      const label = SPORT_LABELS[sport] ?? { league: sport, correctScore: false };
      const markets = label.correctScore
        ? "h2h,spreads,totals,correct_score"
        : "h2h,spreads,totals";

      const resp = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport}/odds/?` +
          `apiKey=${oddsApiKey}&regions=us,uk,eu&markets=${markets}` +
          `&oddsFormat=american&dateFormat=iso`,
      );
      if (!resp.ok) return;
      const games: any[] = await resp.json();

      for (const g of games.slice(0, 8)) {
        const outs = extractOutcomes(g, sport, label.league);
        allOutcomes.push(...outs);

        if (label.correctScore) {
          const cs = extractCorrectScore(g);
          if (Object.keys(cs).length > 0) {
            correctScoreTable.push({
              game_id: g.id,
              league: label.league,
              home_team: g.home_team,
              away_team: g.away_team,
              commence_time: g.commence_time,
              scores: cs,
            });
          }
        }
      }
    }));

    // ── Filter to positive-edge candidates ───────────────────────────────────
    let candidates = allOutcomes.filter((o) => o.status === "edge");

    if (params.market_type !== "all") {
      candidates = candidates.filter((o) => o.market_type === params.market_type);
    }
    candidates = candidates.filter(
      (o) => o.bet365!.odds >= params.odds_min && o.bet365!.odds <= params.odds_max,
    );

    // Sort by edge_pct desc; take top 30 to send to Claude
    candidates.sort((a, b) => b.edge_pct - a.edge_pct);
    const shortlist = candidates.slice(0, 30);

    if (shortlist.length === 0) {
      const stats = {
        total_outcomes_scanned: allOutcomes.length,
        positive_edge: allOutcomes.filter((o) => o.status === "edge").length,
        neutral:       allOutcomes.filter((o) => o.status === "neutral").length,
        no_edge:       allOutcomes.filter((o) => o.status === "no_edge").length,
        bet365_missing: allOutcomes.length === 0,
      };
      let message = "No Bet365 positive-edge markets found for the chosen filters.";
      if (allOutcomes.length === 0) {
        message = "No live games returned by The Odds API for the selected sport(s). Try a different sport or check back later.";
      } else if (stats.positive_edge === 0) {
        message = `Scanned ${stats.total_outcomes_scanned} markets — ${stats.neutral} were ~equal to market avg, ${stats.no_edge} had Bet365 below average, 0 had a Bet365 edge. Try 'All sports' or 'All markets'.`;
      }
      return new Response(
        JSON.stringify({
          picks: [], count: 0, params, stats,
          correct_score_table: correctScoreTable,
          message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build prompt context ─────────────────────────────────────────────────
    const candidatesContext = shortlist.map((o, i) => {
      const othersStr = o.others
        .slice(0, 6)
        .map((b) => `${b.title}: ${fmtAmerican(b.odds)}`)
        .join(" | ");
      return [
        `#${i + 1} ${o.away_team} @ ${o.home_team} [${o.league}] | ${o.commence_time}`,
        `   Market: ${o.market} → ${o.selection}`,
        `   Bet365: ${fmtAmerican(o.bet365!.odds)}  vs  Market Avg: ${fmtAmerican(o.avg_market_odds)}`,
        `   Edge: +${o.edge_pct}%  |  ImpliedProbDiff: +${(o.implied_prob_diff * 100).toFixed(2)}pp`,
        `   Other books: ${othersStr}`,
      ].join("\n");
    }).join("\n\n");

    const riskGuide = {
      conservative: "Only highest-edge, lowest variance picks. Favor moneyline favorites with ≥5% edge and confidence ≥70%.",
      balanced:     "Mix of value and safety. Edge ≥2%, confidence ≥55%.",
      aggressive:   "Accept higher variance for higher upside. Underdogs and totals welcome, edge ≥1%.",
    }[params.risk_level] ?? "Balanced risk.";

    const strategyGuide = {
      safest:   "Pick the lowest-variance bets. Prefer big favorites and unders in low-scoring matchups.",
      value:    "Pure expected-value hunt. Edge over the market is everything.",
      underdog: "Bias toward +odds selections with edge. Mid-range dogs (+120 to +250) preferred.",
      parlay:   "Choose picks that could be combined into a 2-3 leg parlay. Note correlations.",
    }[params.strategy] ?? "Value-focused.";

    const detailGuide = {
      brief:    "1-2 sentence reasoning, max 3 key_factors.",
      balanced: "2-3 sentence reasoning, 3-4 key_factors.",
      detailed: "4-5 sentence reasoning, 4-6 key_factors including stats if known.",
    }[params.explanation_detail] ?? "Balanced.";

    // ── Call Claude ──────────────────────────────────────────────────────────
    const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const system = `You are Engie, a value-focused sports betting analyst.
Bet365 is the reference sportsbook. Every candidate below already has Bet365 priced ABOVE the average of the other US/UK/EU books — that's the edge you exploit.
Your job: rank, validate, and reason about the strongest edges.

Risk profile: ${riskGuide}
Strategy: ${strategyGuide}
Reasoning length: ${detailGuide}

Hard rules:
- Output ONLY a JSON object — no markdown, no prose outside JSON.
- Never invent edges; the edge_pct is given.
- confidence_score must reflect your *calibrated* probability of the pick winning (40-95).
- If fewer than ${params.num_picks} candidates meet the bar, return fewer picks.
- Never recommend a Bet365 odds outside [${params.odds_min}, ${params.odds_max}].
- Minimum acceptable confidence: ${params.min_confidence}.`;

    const userMsg = `Return JSON of this exact shape:
{
  "picks": [
    {
      "candidate_index": <number from #N above>,
      "sport": "<sport_key>",
      "league": "<league>",
      "game": "<away> @ <home>",
      "market": "<e.g. Moneyline, Spread -3.5, Over 47.5>",
      "selection": "<exact selection text>",
      "odds": <bet365 american odds integer>,
      "confidence_score": <40-95>,
      "risk_level": "<low|medium|high>",
      "reasoning": "<short paragraph>",
      "key_factors": ["<factor 1>", "<factor 2>", ...],
      "recommended_stake_level": "<small|medium|large>",
      "warning": "<concise responsible-gambling caveat>"
    }
  ]
}

Maximum picks: ${params.num_picks}
${params.custom_prompt ? `\nUser instruction: ${params.custom_prompt}` : ""}

CANDIDATES (already pre-filtered for positive Bet365 edge):
${candidatesContext}`;

    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const responseContent = message.content[0];
    if (responseContent.type !== "text") throw new Error("Unexpected Claude response type");

    let parsed: any;
    try {
      const text = responseContent.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      throw new Error("Claude did not return valid JSON");
    }

    const rawPicks: any[] = Array.isArray(parsed.picks) ? parsed.picks : [];

    // ── Marshal picks for DB insert ──────────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const insertRows = rawPicks
      .filter((p) => Number(p.confidence_score ?? 0) >= params.min_confidence)
      .slice(0, params.num_picks)
      .map((p) => {
        const cand = shortlist[Number(p.candidate_index) - 1] ?? null;
        const odds_data = cand
          ? [
              { key: cand.bet365!.key, title: cand.bet365!.title, odds: cand.bet365!.odds },
              ...cand.others.slice(0, 6).map((b) => ({ key: b.key, title: b.title, odds: b.odds })),
            ]
          : [];

        const confidence = Math.min(95, Math.max(0, Number(p.confidence_score)));
        const valueRating = Math.max(
          1, Math.min(10, Math.round((cand?.edge_pct ?? 0) >= 5 ? 9 : (cand?.edge_pct ?? 0) >= 3 ? 8 : (cand?.edge_pct ?? 0) >= 1.5 ? 7 : 6)),
        );

        return {
          game_id:           cand?.game_id ?? p.game ?? "unknown",
          sport:             cand?.sport_key ?? p.sport ?? "unknown",
          league:            cand?.league ?? p.league ?? null,
          home_team:         cand?.home_team ?? "",
          away_team:         cand?.away_team ?? "",
          commence_time:     cand?.commence_time ?? now.toISOString(),
          selection:         String(p.selection ?? cand?.selection ?? ""),
          bet_type:          cand?.market_type ?? "moneyline",
          market:            cand?.market ?? p.market ?? null,
          recommended_odds:  Number(p.odds ?? cand?.bet365?.odds ?? 0),
          bookmaker_key:     "bet365",
          value_rating:      valueRating,
          confidence_pct:    confidence,
          risk_level:        String(p.risk_level ?? params.risk_level),
          key_factors:       Array.isArray(p.key_factors) ? p.key_factors : [],
          stake_level:       String(p.recommended_stake_level ?? "small"),
          warning:           String(p.warning ?? "Past performance doesn't predict future results. Bet responsibly."),
          reasoning:         String(p.reasoning ?? ""),
          bet365_odds:       cand?.bet365?.odds ?? null,
          avg_market_odds:   cand?.avg_market_odds ?? null,
          edge_pct:          cand?.edge_pct ?? null,
          implied_prob_diff: cand?.implied_prob_diff ?? null,
          prompt_params:     params,
          model_version:     "claude-sonnet-4-6",
          expires_at:        expiresAt.toISOString(),
          odds_data:         JSON.stringify(odds_data),
        };
      });

    let inserted: any[] = [];
    if (insertRows.length > 0) {
      const { data, error } = await supabase
        .from("ai_picks")
        .insert(insertRows)
        .select();
      if (error) throw error;
      inserted = data ?? [];
    }

    if (userId) {
      await supabase
        .from("profiles")
        .update({ last_ai_request: now.toISOString() })
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        picks: inserted,
        count: inserted.length,
        params,
        stats: {
          total_outcomes_scanned: allOutcomes.length,
          positive_edge: allOutcomes.filter((o) => o.status === "edge").length,
          neutral:       allOutcomes.filter((o) => o.status === "neutral").length,
          no_edge:       allOutcomes.filter((o) => o.status === "no_edge").length,
        },
        correct_score_table: correctScoreTable,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-ai-picks error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

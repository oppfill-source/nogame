import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.3";

const RATE_LIMIT_MINUTES = 15;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// 7 major sports covered every run
const MAJOR_SPORTS = [
  "americanfootball_nfl",
  "basketball_nba",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_usa_mls",
  "soccer_epl",
  "mma_mixed_martial_arts",
];

// Sports where recent scores are useful for form analysis
const SCORED_SPORTS = [
  "americanfootball_nfl",
  "basketball_nba",
  "baseball_mlb",
  "icehockey_nhl",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type BookmakerOdds = { key: string; title: string; odds: number };

type GameOddsData = {
  bestHome: BookmakerOdds[];
  bestAway: BookmakerOdds[];
  bestOver: BookmakerOdds[];
  bestUnder: BookmakerOdds[];
  homeSpread: { spread: number; books: BookmakerOdds[] } | null;
  awaySpread: { spread: number; books: BookmakerOdds[] } | null;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function sortOddsDesc(a: BookmakerOdds, b: BookmakerOdds) {
  return b.odds - a.odds;
}

function extractOddsData(game: any): GameOddsData {
  const result: GameOddsData = {
    bestHome: [],
    bestAway: [],
    bestOver: [],
    bestUnder: [],
    homeSpread: null,
    awaySpread: null,
  };

  const homeSpreadBooks: BookmakerOdds[] = [];
  const awaySpreadBooks: BookmakerOdds[] = [];
  let homeSpreadValue: number | null = null;
  let awaySpreadValue: number | null = null;

  for (const bm of game.bookmakers ?? []) {
    for (const market of bm.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        const entry: BookmakerOdds = { key: bm.key, title: bm.title, odds: outcome.price };

        if (market.key === "h2h") {
          if (outcome.name === game.home_team) result.bestHome.push(entry);
          else if (outcome.name === game.away_team) result.bestAway.push(entry);
        } else if (market.key === "spreads") {
          if (outcome.name === game.home_team) {
            homeSpreadValue ??= outcome.point;
            homeSpreadBooks.push(entry);
          } else if (outcome.name === game.away_team) {
            awaySpreadValue ??= outcome.point;
            awaySpreadBooks.push(entry);
          }
        } else if (market.key === "totals") {
          if (outcome.name === "Over") result.bestOver.push(entry);
          else if (outcome.name === "Under") result.bestUnder.push(entry);
        }
      }
    }
  }

  result.bestHome.sort(sortOddsDesc);
  result.bestAway.sort(sortOddsDesc);
  result.bestOver.sort(sortOddsDesc);
  result.bestUnder.sort(sortOddsDesc);
  homeSpreadBooks.sort(sortOddsDesc);
  awaySpreadBooks.sort(sortOddsDesc);

  if (homeSpreadValue !== null && homeSpreadBooks.length) {
    result.homeSpread = { spread: homeSpreadValue, books: homeSpreadBooks };
  }
  if (awaySpreadValue !== null && awaySpreadBooks.length) {
    result.awaySpread = { spread: awaySpreadValue, books: awaySpreadBooks };
  }

  return result;
}

function impliedProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

function fmtOdds(odds: number): string {
  return `${odds > 0 ? "+" : ""}${odds}`;
}

function fmtBooks(books: BookmakerOdds[], limit = 5): string {
  return books
    .slice(0, limit)
    .map((b) => `${b.title}: ${fmtOdds(b.odds)}`)
    .join(" | ");
}

// ─── main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: cron call (x-cron-secret) OR signed-in user (Authorization)
    const cronSecret = req.headers.get("x-cron-secret");
    const isCronCall = CRON_SECRET.length > 0 && cronSecret === CRON_SECRET;
    let userId: string | null = null;

    if (!isCronCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const { data: { user }, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      userId = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("last_ai_request")
        .eq("id", userId)
        .single();

      if (profile?.last_ai_request) {
        const minutesSince =
          (Date.now() - new Date(profile.last_ai_request).getTime()) / 60_000;
        if (minutesSince < RATE_LIMIT_MINUTES) {
          const retryAfter = Math.ceil(RATE_LIMIT_MINUTES - minutesSince);
          return new Response(
            JSON.stringify({ error: "rate_limited", retry_after: retryAfter }),
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(retryAfter * 60) },
            }
          );
        }
      }
    }

    const oddsApiKey = Deno.env.get("ODDS_API_KEY");
    if (!oddsApiKey) throw new Error("ODDS_API_KEY not configured");

    // ── Step 1: Fetch live odds (h2h + spreads + totals) for all major sports ──
    type EnrichedGame = {
      id: string;
      sport_key: string;
      home_team: string;
      away_team: string;
      commence_time: string;
      oddsData: GameOddsData;
    };

    const allGames: EnrichedGame[] = [];

    await Promise.allSettled(
      MAJOR_SPORTS.map(async (sport) => {
        const resp = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?` +
            `apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals` +
            `&oddsFormat=american&dateFormat=iso`
        );
        if (!resp.ok) return;
        const games: any[] = await resp.json();
        for (const g of games.slice(0, 3)) {
          const oddsData = extractOddsData(g);
          if (!oddsData.bestHome.length || !oddsData.bestAway.length) continue;
          allGames.push({
            id: g.id,
            sport_key: sport,
            home_team: g.home_team,
            away_team: g.away_team,
            commence_time: g.commence_time,
            oddsData,
          });
        }
      })
    );

    if (allGames.length === 0) throw new Error("No games available from Odds API");

    // ── Step 2: Fetch recent scores for team form (last 3 days) ───────────────
    const teamForm: Record<string, string> = {};

    await Promise.allSettled(
      SCORED_SPORTS.map(async (sport) => {
        const resp = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/scores/?daysFrom=3&apiKey=${oddsApiKey}`
        );
        if (!resp.ok) return;
        const results: any[] = await resp.json();
        const teamResults: Record<string, ("W" | "L")[]> = {};

        for (const game of results.filter((g) => g.completed && g.scores?.length === 2)) {
          const homeScore = parseInt(
            game.scores.find((s: any) => s.name === game.home_team)?.score ?? "0"
          );
          const awayScore = parseInt(
            game.scores.find((s: any) => s.name === game.away_team)?.score ?? "0"
          );
          if (isNaN(homeScore) || isNaN(awayScore)) continue;
          (teamResults[game.home_team] ??= []).push(homeScore >= awayScore ? "W" : "L");
          (teamResults[game.away_team] ??= []).push(awayScore >= homeScore ? "W" : "L");
        }

        for (const [team, res] of Object.entries(teamResults)) {
          teamForm[team] = res.join("-");
        }
      })
    );

    // ── Step 3: Build rich context for Claude ─────────────────────────────────
    const gamesContext = allGames
      .slice(0, 12)
      .map((g) => {
        const o = g.oddsData;
        const homeForm = teamForm[g.home_team] ? ` [form: ${teamForm[g.home_team]}]` : "";
        const awayForm = teamForm[g.away_team] ? ` [form: ${teamForm[g.away_team]}]` : "";

        // Average implied probability across all books
        const homeAvgImplied = o.bestHome.length
          ? Math.round(
              (o.bestHome.reduce((s, b) => s + impliedProb(b.odds), 0) / o.bestHome.length) * 100
            )
          : null;
        const awayAvgImplied = o.bestAway.length
          ? Math.round(
              (o.bestAway.reduce((s, b) => s + impliedProb(b.odds), 0) / o.bestAway.length) * 100
            )
          : null;

        // Line-shopping gap: best vs worst odds (higher = more value to grab)
        const homeGap =
          o.bestHome.length >= 2 ? o.bestHome[0].odds - o.bestHome[o.bestHome.length - 1].odds : 0;
        const awayGap =
          o.bestAway.length >= 2 ? o.bestAway[0].odds - o.bestAway[o.bestAway.length - 1].odds : 0;

        const lines: string[] = [
          `GAME: ${g.away_team}${awayForm} @ ${g.home_team}${homeForm} | ${g.sport_key}`,
          `Time: ${g.commence_time}`,
          `MONEYLINE (best→worst):`,
          `  ${g.home_team}${homeAvgImplied ? ` (${homeAvgImplied}% avg implied)` : ""}: ${fmtBooks(o.bestHome)}`,
          `  ${g.away_team}${awayAvgImplied ? ` (${awayAvgImplied}% avg implied)` : ""}: ${fmtBooks(o.bestAway)}`,
        ];

        if (homeGap > 0 || awayGap > 0) {
          lines.push(`  Line-shop gap: HOME +${homeGap}pts | AWAY +${awayGap}pts`);
        }
        if (o.homeSpread) {
          lines.push(
            `SPREAD: ${g.home_team} ${o.homeSpread.spread > 0 ? "+" : ""}${o.homeSpread.spread}: ${fmtBooks(o.homeSpread.books, 3)}`
          );
        }
        if (o.bestOver.length) {
          lines.push(
            `TOTALS: Over best: ${fmtBooks(o.bestOver, 3)} | Under best: ${fmtBooks(o.bestUnder, 3)}`
          );
        }

        return lines.join("\n");
      })
      .join("\n\n");

    // ── Step 4: Call Claude ───────────────────────────────────────────────────
    const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3500,
      system: `You are Engie, a sharp sports betting analyst. Find bets with genuine positive expected value by exploiting:
1. Line-shopping gaps — when one book's odds are meaningfully better than the consensus
2. Mispriced totals — books underestimating or overestimating scoring pace
3. Spread hooks — key numbers (3, 7 in NFL; 6, 7, 10 in NBA) and half-point value
4. Contrarian spots — fading inflated public favorites where implied prob exceeds true win probability
5. Form mismatches — recent results not yet reflected in the opening line

Be data-driven and skeptical. Don't invent edges — cite the specific number that creates it.`,
      messages: [
        {
          role: "user",
          content: `Analyze these upcoming games and return exactly 5 value bets as a JSON array.

Each object must have these exact fields:
- game_id: "AWAY_HOME_SPORT" using snake_case team names (spaces → underscores, lowercase)
- sport: the sport_key string
- home_team: exact home team name from the data
- away_team: exact away team name from the data
- commence_time: ISO timestamp from the data
- selection: exact team name, or "Over X.X" / "Under X.X" for totals
- bet_type: "moneyline" | "spread" | "total"
- recommended_odds: best available American odds integer
- bookmaker_key: lowercase snake_case sportsbook key (e.g. "draftkings", "fanduel", "betmgm", "caesars", "bet365", "betrivers")
- value_rating: 1-10 integer (8-10 = strong edge, 7 = good value, 6 = marginal — be honest)
- confidence_pct: your estimated win probability 0-100 (calibrated, not optimistic)
- reasoning: 3-4 sentences citing the specific data point that creates the edge

Return ONLY the JSON array. No markdown, no text outside the array.

GAMES:
${gamesContext}`,
        },
      ],
    });

    const responseContent = message.content[0];
    if (responseContent.type !== "text") throw new Error("Unexpected Claude response type");

    let picks: any[];
    try {
      const jsonMatch = responseContent.text.match(/\[[\s\S]*\]/);
      picks = JSON.parse(jsonMatch ? jsonMatch[0] : responseContent.text);
      if (!Array.isArray(picks)) throw new Error("Not an array");
    } catch {
      throw new Error("Failed to parse Claude response as JSON");
    }

    // ── Step 5: Store picks with odds comparison data ─────────────────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const insertData = picks.slice(0, 5).map((p: any) => {
      const game = allGames.find(
        (g) => g.home_team === p.home_team && g.away_team === p.away_team
      );

      let oddsData: BookmakerOdds[] | null = null;
      if (game) {
        const o = game.oddsData;
        if (p.bet_type === "total") {
          const isOver = String(p.selection).toLowerCase().startsWith("over");
          oddsData = isOver ? o.bestOver : o.bestUnder;
        } else {
          oddsData = p.selection === p.home_team ? o.bestHome : o.bestAway;
        }
        oddsData = (oddsData ?? []).slice(0, 6).map((b) => ({
          key: b.key,
          title: b.title,
          odds: b.odds,
        }));
      }

      return {
        game_id: p.game_id,
        sport: p.sport,
        home_team: p.home_team,
        away_team: p.away_team,
        commence_time: p.commence_time,
        selection: p.selection,
        bet_type: p.bet_type ?? "moneyline",
        recommended_odds: Number(p.recommended_odds),
        bookmaker_key: (p.bookmaker_key ?? "draftkings").toLowerCase().replace(/\s+/g, "_"),
        value_rating: Math.min(10, Math.max(1, Number(p.value_rating))),
        confidence_pct: Math.min(100, Math.max(0, Number(p.confidence_pct ?? 50))),
        reasoning: p.reasoning,
        model_version: "claude-sonnet-4-6",
        expires_at: expiresAt.toISOString(),
        odds_data: oddsData ? JSON.stringify(oddsData) : null,
      };
    });

    const { data: inserted, error: insertErr } = await supabase
      .from("ai_picks")
      .insert(insertData)
      .select();

    if (insertErr) throw insertErr;

    if (userId) {
      await supabase
        .from("profiles")
        .update({ last_ai_request: now.toISOString() })
        .eq("id", userId);
    }

    const highValue = (inserted ?? []).filter((p: any) => p.value_rating >= 8);
    if (highValue.length > 0) {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "Engie found a value bet",
          body: `${highValue.length} high-value pick${highValue.length > 1 ? "s" : ""} — tap to view`,
          data: { screen: "/(tabs)/ai-picks" },
        },
      });
    }

    return new Response(
      JSON.stringify({ picks: inserted, count: inserted?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-ai-picks error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

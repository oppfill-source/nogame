import type { OddsGame, Bookmaker, Market } from "./odds-api";
import type { NormalizedGame } from "../types";
import { format } from "date-fns";

// ─── Odds formatting ──────────────────────────────────────────────────────────

export type OddsFormat = "american" | "decimal";

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatOddsAs(odds: number, format: OddsFormat): string {
  if (format === "decimal") {
    return americanToDecimal(odds).toFixed(2);
  }
  return formatOdds(odds);
}

export function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

export function impliedProbability(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

// ─── Payout calculation ───────────────────────────────────────────────────────

export function calcPayout(stake: number, odds: number): number {
  if (odds > 0) return stake + (stake * odds) / 100;
  return stake + (stake * 100) / Math.abs(odds);
}

// ─── Kelly Criterion ──────────────────────────────────────────────────────────

/** Returns the recommended stake as a fraction of bankroll (quarter Kelly by default) */
export function kellyFraction(
  winProbability: number,
  americanOdds: number,
  fraction = 0.25
): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1;
  const p = winProbability;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, kelly * fraction); // never negative
}

// ─── Best odds detection ──────────────────────────────────────────────────────

export function findBestOdds(
  bookmakers: Bookmaker[],
  market: "h2h" | "spreads",
  teamName: string
): { bookmakerKey: string; odds: number } | null {
  let best: { bookmakerKey: string; odds: number } | null = null;

  for (const bm of bookmakers) {
    const mkt = bm.markets.find((m: Market) => m.key === market);
    if (!mkt) continue;
    const outcome = mkt.outcomes.find((o) => o.name === teamName);
    if (!outcome) continue;
    if (!best || outcome.price > best.odds) {
      best = { bookmakerKey: bm.key, odds: outcome.price };
    }
  }

  return best;
}

// ─── Game normalization ───────────────────────────────────────────────────────

export function normalizeOddsGame(game: OddsGame): NormalizedGame {
  const homeBest = findBestOdds(game.bookmakers, "h2h", game.home_team);
  const awayBest = findBestOdds(game.bookmakers, "h2h", game.away_team);

  let spread = 0;
  for (const bm of game.bookmakers) {
    const spreads = bm.markets.find((m: Market) => m.key === "spreads");
    const homeSpread = spreads?.outcomes.find((o) => o.name === game.home_team);
    if (homeSpread?.point !== undefined) {
      spread = homeSpread.point;
      break;
    }
  }

  let total = 0;
  for (const bm of game.bookmakers) {
    const totals = bm.markets.find((m: Market) => m.key === "totals");
    if (totals?.outcomes[0]?.point !== undefined) {
      total = totals.outcomes[0].point;
      break;
    }
  }

  return {
    id: game.id,
    sport: game.sport_title,
    sportKey: game.sport_key,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    time: formatGameTime(game.commence_time),
    commenceTime: game.commence_time,
    homeOdds: homeBest?.odds ?? 0,
    awayOdds: awayBest?.odds ?? 0,
    spread,
    total,
  };
}

export function formatGameTime(isoString: string): string {
  try {
    return format(new Date(isoString), "h:mm a 'ET'");
  } catch {
    return isoString;
  }
}

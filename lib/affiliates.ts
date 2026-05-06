import { Linking } from "react-native";
import { BOOKMAKERS, BOOKMAKER_BY_KEY } from "../constants/affiliates";
import type { BookmakerConfig } from "../types";
import type { OddsGame } from "./odds-api";
import { findBestOdds } from "./odds-utils";

export { BOOKMAKERS, BOOKMAKER_BY_KEY };

// ─── Build a tracked affiliate URL ───────────────────────────────────────────

export function buildAffiliateUrl(
  bookmakerKey: string,
  context?: { gameId?: string; sport?: string }
): string {
  const bm = BOOKMAKER_BY_KEY[bookmakerKey];
  if (!bm) return "";

  let url = bm.webUrl;
  if (context?.gameId) {
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}game=${context.gameId}`;
  }
  return url;
}

// ─── Open a bookmaker (native app → web fallback) ────────────────────────────

export async function openBookmaker(
  bookmakerKey: string,
  context?: { gameId?: string; sport?: string }
): Promise<void> {
  const bm = BOOKMAKER_BY_KEY[bookmakerKey];
  if (!bm) return;

  // Try native app deep link first
  const canOpenDeep = await Linking.canOpenURL(bm.deepLink).catch(() => false);
  if (canOpenDeep) {
    await Linking.openURL(bm.deepLink);
    return;
  }

  // Fall back to affiliate web URL
  const webUrl = buildAffiliateUrl(bookmakerKey, context);
  await Linking.openURL(webUrl);
}

// ─── Per-game best-odds summary ───────────────────────────────────────────────

export type BookmakerOddsRow = {
  bookmaker: BookmakerConfig;
  homeOdds: number;
  awayOdds: number;
  spread: number;
  isBestHome: boolean;
  isBestAway: boolean;
};

export function getBookmakerOddsRows(game: OddsGame): BookmakerOddsRow[] {
  const bestHome = findBestOdds(game.bookmakers, "h2h", game.home_team);
  const bestAway = findBestOdds(game.bookmakers, "h2h", game.away_team);

  return game.bookmakers
    .map((bm) => {
      const config = BOOKMAKER_BY_KEY[bm.key];
      if (!config) return null;

      const h2h = bm.markets.find((m) => m.key === "h2h");
      const spreads = bm.markets.find((m) => m.key === "spreads");

      const homeOdds = h2h?.outcomes.find((o) => o.name === game.home_team)?.price ?? 0;
      const awayOdds = h2h?.outcomes.find((o) => o.name === game.away_team)?.price ?? 0;
      const spreadPoint =
        spreads?.outcomes.find((o) => o.name === game.home_team)?.point ?? 0;

      return {
        bookmaker: config,
        homeOdds,
        awayOdds,
        spread: spreadPoint,
        isBestHome: homeOdds !== 0 && homeOdds === bestHome?.odds,
        isBestAway: awayOdds !== 0 && awayOdds === bestAway?.odds,
      };
    })
    .filter(Boolean) as BookmakerOddsRow[];
}

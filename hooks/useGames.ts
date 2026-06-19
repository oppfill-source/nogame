import { useQuery } from "@tanstack/react-query";
import { getUpcomingGames } from "../lib/odds-api";
import { normalizeOddsGame } from "../lib/odds-utils";
import { ALL_SPORTS_KEY, SPORTS } from "../constants/sports";
import type { NormalizedGame } from "../types";

// Sports with the most active games on any given day
const ALL_SPORTS_FETCH = [
  "basketball_nba",
  "baseball_mlb",
  "icehockey_nhl",
  "americanfootball_nfl",
  "soccer_fifa_world_cup",
  "soccer_usa_mls",
  "soccer_epl",
];

const MOCK_GAMES: NormalizedGame[] = [
  { id: "mock-1", sport: "NBA", sportKey: "basketball_nba", homeTeam: "Los Angeles Lakers", awayTeam: "Boston Celtics", time: "7:30 PM ET", commenceTime: new Date().toISOString(), homeOdds: -110, awayOdds: -110, spread: 3.5, total: 224.5 },
  { id: "mock-2", sport: "MLB", sportKey: "baseball_mlb", homeTeam: "New York Yankees", awayTeam: "Houston Astros", time: "1:05 PM ET", commenceTime: new Date().toISOString(), homeOdds: -130, awayOdds: 110, spread: 1.5, total: 8.5 },
  { id: "mock-3", sport: "NHL", sportKey: "icehockey_nhl", homeTeam: "Toronto Maple Leafs", awayTeam: "Montreal Canadiens", time: "8:00 PM ET", commenceTime: new Date().toISOString(), homeOdds: -150, awayOdds: 130, spread: 1.5, total: 6.0 },
  { id: "mock-4", sport: "NFL", sportKey: "americanfootball_nfl", homeTeam: "Kansas City Chiefs", awayTeam: "Buffalo Bills", time: "4:25 PM ET", commenceTime: new Date().toISOString(), homeOdds: -165, awayOdds: 145, spread: 3.0, total: 47.5 },
  { id: "mock-5", sport: "MLS", sportKey: "soccer_usa_mls", homeTeam: "LA Galaxy", awayTeam: "Portland Timbers", time: "10:30 PM ET", commenceTime: new Date().toISOString(), homeOdds: -120, awayOdds: 100, spread: 0.5, total: 2.5 },
  { id: "mock-6", sport: "UFC", sportKey: "mma_mixed_martial_arts", homeTeam: "Jon Jones", awayTeam: "Stipe Miocic", time: "10:00 PM ET", commenceTime: new Date().toISOString(), homeOdds: -300, awayOdds: 250, spread: 0, total: 0 },
];

/** Returns true if the ISO timestamp falls within today (local calendar day) */
function isToday(iso: string): boolean {
  const gameDate = new Date(iso);
  const now = new Date();
  return (
    gameDate.getFullYear() === now.getFullYear() &&
    gameDate.getMonth() === now.getMonth() &&
    gameDate.getDate() === now.getDate()
  );
}

export function useGames(sportKey: string) {
  const apiKey = process.env.EXPO_PUBLIC_ODDS_API_KEY;

  return useQuery<NormalizedGame[]>({
    queryKey: ["games", sportKey],
    queryFn: async (): Promise<NormalizedGame[]> => {
      if (!apiKey) return getMockGamesForSport(sportKey);

      let raw: NormalizedGame[] = [];

      if (sportKey === ALL_SPORTS_KEY) {
        const results = await Promise.allSettled(
          ALL_SPORTS_FETCH.map(getUpcomingGames)
        );
        raw = results.flatMap((r) =>
          r.status === "fulfilled" ? r.value.map(normalizeOddsGame) : []
        );
      } else {
        const games = await getUpcomingGames(sportKey);
        raw = games.map(normalizeOddsGame);
      }

      // Keep only today's games, sort soonest first
      const todaysGames = raw
        .filter((g) => isToday(g.commenceTime))
        .sort(
          (a, b) =>
            new Date(a.commenceTime).getTime() -
            new Date(b.commenceTime).getTime()
        );

      // Fall back to the next 48h if nothing today (off-season / early morning)
      if (todaysGames.length === 0) {
        return raw
          .filter((g) => new Date(g.commenceTime).getTime() > Date.now())
          .sort(
            (a, b) =>
              new Date(a.commenceTime).getTime() -
              new Date(b.commenceTime).getTime()
          )
          .slice(0, 20);
      }

      return todaysGames;
    },
    staleTime: 5 * 60_000,
    placeholderData: getMockGamesForSport(sportKey),
  });
}

function getMockGamesForSport(sportKey: string): NormalizedGame[] {
  if (sportKey === ALL_SPORTS_KEY) return MOCK_GAMES;
  const sport = SPORTS.find((s) => s.key === sportKey);
  if (!sport) return MOCK_GAMES;
  return MOCK_GAMES.filter((g) =>
    g.sport.toLowerCase().includes(sport.short.toLowerCase())
  );
}

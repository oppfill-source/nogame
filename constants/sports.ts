export type SportConfig = {
  key: string;       // The Odds API key
  label: string;     // Full display name
  short: string;     // Short label for filter chips
  emoji: string;
  group: "american" | "soccer" | "combat" | "racket";
};

export const SPORTS: SportConfig[] = [
  // American sports
  { key: "americanfootball_nfl", label: "NFL", short: "NFL", emoji: "🏈", group: "american" },
  { key: "americanfootball_ncaaf", label: "College Football", short: "NCAAF", emoji: "🏈", group: "american" },
  { key: "basketball_nba", label: "NBA", short: "NBA", emoji: "🏀", group: "american" },
  { key: "basketball_ncaab", label: "College Basketball", short: "NCAAB", emoji: "🏀", group: "american" },
  { key: "baseball_mlb", label: "MLB", short: "MLB", emoji: "⚾", group: "american" },
  { key: "icehockey_nhl", label: "NHL", short: "NHL", emoji: "🏒", group: "american" },
  // Soccer
  { key: "soccer_fifa_world_cup", label: "World Cup", short: "World Cup", emoji: "⚽", group: "soccer" },
  { key: "soccer_usa_mls", label: "MLS", short: "MLS", emoji: "⚽", group: "soccer" },
  { key: "soccer_epl", label: "Premier League", short: "EPL", emoji: "⚽", group: "soccer" },
  { key: "soccer_uefa_champs_league", label: "Champions League", short: "UCL", emoji: "⚽", group: "soccer" },
  { key: "soccer_spain_la_liga", label: "La Liga", short: "La Liga", emoji: "⚽", group: "soccer" },
  { key: "soccer_germany_bundesliga", label: "Bundesliga", short: "Bundesliga", emoji: "⚽", group: "soccer" },
  { key: "soccer_italy_serie_a", label: "Serie A", short: "Serie A", emoji: "⚽", group: "soccer" },
  { key: "soccer_france_ligue_one", label: "Ligue 1", short: "Ligue 1", emoji: "⚽", group: "soccer" },
  // Combat
  { key: "mma_mixed_martial_arts", label: "UFC / MMA", short: "UFC", emoji: "🥊", group: "combat" },
  { key: "boxing_boxing", label: "Boxing", short: "Boxing", emoji: "🥊", group: "combat" },
  // Racket
  { key: "tennis_atp_french_open", label: "ATP Tennis", short: "ATP", emoji: "🎾", group: "racket" },
  { key: "tennis_wta_french_open", label: "WTA Tennis", short: "WTA", emoji: "🎾", group: "racket" },
];

export const ALL_SPORTS_KEY = "all";

export const SPORT_BY_KEY: Record<string, SportConfig> = Object.fromEntries(
  SPORTS.map((s) => [s.key, s])
);

export const DEFAULT_SPORT = SPORTS[0].key; // NFL as default

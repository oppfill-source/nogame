const API_KEY = process.env.EXPO_PUBLIC_ODDS_API_KEY ?? "";
const BASE_URL = "https://api.the-odds-api.com/v4";

export type OddsGame = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

export type Bookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
};

export type Market = {
  key: string;
  last_update: string;
  outcomes: Outcome[];
};

export type Outcome = {
  name: string;
  price: number;
  point?: number;
};

export async function getUpcomingGames(sport = "americanfootball_nfl"): Promise<OddsGame[]> {
  const url = `${BASE_URL}/sports/${sport}/odds?apiKey=${API_KEY}&regions=us&markets=h2h,spreads&oddsFormat=american`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Odds API error: ${response.status}`);
  return response.json();
}

export async function getSports() {
  const response = await fetch(`${BASE_URL}/sports?apiKey=${API_KEY}`);
  if (!response.ok) throw new Error(`Odds API error: ${response.status}`);
  return response.json();
}

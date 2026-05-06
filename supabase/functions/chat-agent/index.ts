import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.3";

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Sports API config (api-sports.io) ────────────────────────────────────────
// Set secret: supabase secrets set SPORTS_API_KEY=your_key
// Sign up at: https://api-sports.io (100 req/day free)
const SPORT_API_BASE: Record<string, string> = {
  nfl: "https://v1.american-football.api-sports.io",
  nba: "https://v2.nba.api-sports.io",
  mlb: "https://v1.baseball.api-sports.io",
  nhl: "https://v1.hockey.api-sports.io",
};

const CURRENT_SEASON: Record<string, string> = {
  nfl: "2024",
  nba: "2024-2025",
  mlb: "2025",
  nhl: "2024-2025",
};

// ─── Team keyword database ────────────────────────────────────────────────────
// Maps any natural mention → { sport, search term for API-Sports }
const TEAM_DB: Record<string, { sport: string; search: string; fullName: string }> = {
  // NFL
  "chiefs":     { sport: "nfl", search: "Kansas City",   fullName: "Kansas City Chiefs" },
  "eagles":     { sport: "nfl", search: "Philadelphia",  fullName: "Philadelphia Eagles" },
  "cowboys":    { sport: "nfl", search: "Dallas",        fullName: "Dallas Cowboys" },
  "bills":      { sport: "nfl", search: "Buffalo",       fullName: "Buffalo Bills" },
  "ravens":     { sport: "nfl", search: "Baltimore",     fullName: "Baltimore Ravens" },
  "49ers":      { sport: "nfl", search: "San Francisco", fullName: "San Francisco 49ers" },
  "niners":     { sport: "nfl", search: "San Francisco", fullName: "San Francisco 49ers" },
  "dolphins":   { sport: "nfl", search: "Miami",         fullName: "Miami Dolphins" },
  "bengals":    { sport: "nfl", search: "Cincinnati",    fullName: "Cincinnati Bengals" },
  "lions":      { sport: "nfl", search: "Detroit",       fullName: "Detroit Lions" },
  "packers":    { sport: "nfl", search: "Green Bay",     fullName: "Green Bay Packers" },
  "steelers":   { sport: "nfl", search: "Pittsburgh",    fullName: "Pittsburgh Steelers" },
  "browns":     { sport: "nfl", search: "Cleveland",     fullName: "Cleveland Browns" },
  "jets":       { sport: "nfl", search: "New York Jets", fullName: "New York Jets" },
  "giants":     { sport: "nfl", search: "New York Giants", fullName: "New York Giants" },
  "patriots":   { sport: "nfl", search: "New England",   fullName: "New England Patriots" },
  "raiders":    { sport: "nfl", search: "Las Vegas",     fullName: "Las Vegas Raiders" },
  "chargers":   { sport: "nfl", search: "Los Angeles Chargers", fullName: "Los Angeles Chargers" },
  "rams":       { sport: "nfl", search: "Los Angeles Rams", fullName: "Los Angeles Rams" },
  "seahawks":   { sport: "nfl", search: "Seattle",       fullName: "Seattle Seahawks" },
  "bears":      { sport: "nfl", search: "Chicago",       fullName: "Chicago Bears" },
  "vikings":    { sport: "nfl", search: "Minnesota",     fullName: "Minnesota Vikings" },
  "saints":     { sport: "nfl", search: "New Orleans",   fullName: "New Orleans Saints" },
  "falcons":    { sport: "nfl", search: "Atlanta",       fullName: "Atlanta Falcons" },
  "panthers":   { sport: "nfl", search: "Carolina",      fullName: "Carolina Panthers" },
  "buccaneers": { sport: "nfl", search: "Tampa Bay",     fullName: "Tampa Bay Buccaneers" },
  "bucs":       { sport: "nfl", search: "Tampa Bay",     fullName: "Tampa Bay Buccaneers" },
  "texans":     { sport: "nfl", search: "Houston",       fullName: "Houston Texans" },
  "colts":      { sport: "nfl", search: "Indianapolis",  fullName: "Indianapolis Colts" },
  "titans":     { sport: "nfl", search: "Tennessee",     fullName: "Tennessee Titans" },
  "jaguars":    { sport: "nfl", search: "Jacksonville",  fullName: "Jacksonville Jaguars" },
  "jags":       { sport: "nfl", search: "Jacksonville",  fullName: "Jacksonville Jaguars" },
  "broncos":    { sport: "nfl", search: "Denver",        fullName: "Denver Broncos" },
  "commanders": { sport: "nfl", search: "Washington",    fullName: "Washington Commanders" },
  "cardinals":  { sport: "nfl", search: "Arizona",       fullName: "Arizona Cardinals" },

  // NBA
  "lakers":     { sport: "nba", search: "Los Angeles Lakers",  fullName: "Los Angeles Lakers" },
  "celtics":    { sport: "nba", search: "Boston",              fullName: "Boston Celtics" },
  "warriors":   { sport: "nba", search: "Golden State",        fullName: "Golden State Warriors" },
  "gsw":        { sport: "nba", search: "Golden State",        fullName: "Golden State Warriors" },
  "heat":       { sport: "nba", search: "Miami",               fullName: "Miami Heat" },
  "knicks":     { sport: "nba", search: "New York",            fullName: "New York Knicks" },
  "bucks":      { sport: "nba", search: "Milwaukee",           fullName: "Milwaukee Bucks" },
  "nuggets":    { sport: "nba", search: "Denver",              fullName: "Denver Nuggets" },
  "clippers":   { sport: "nba", search: "Los Angeles Clippers", fullName: "Los Angeles Clippers" },
  "mavericks":  { sport: "nba", search: "Dallas",              fullName: "Dallas Mavericks" },
  "mavs":       { sport: "nba", search: "Dallas",              fullName: "Dallas Mavericks" },
  "suns":       { sport: "nba", search: "Phoenix",             fullName: "Phoenix Suns" },
  "bulls":      { sport: "nba", search: "Chicago",             fullName: "Chicago Bulls" },
  "nets":       { sport: "nba", search: "Brooklyn",            fullName: "Brooklyn Nets" },
  "76ers":      { sport: "nba", search: "Philadelphia",        fullName: "Philadelphia 76ers" },
  "sixers":     { sport: "nba", search: "Philadelphia",        fullName: "Philadelphia 76ers" },
  "hawks":      { sport: "nba", search: "Atlanta",             fullName: "Atlanta Hawks" },
  "grizzlies":  { sport: "nba", search: "Memphis",             fullName: "Memphis Grizzlies" },
  "grizz":      { sport: "nba", search: "Memphis",             fullName: "Memphis Grizzlies" },
  "pelicans":   { sport: "nba", search: "New Orleans",         fullName: "New Orleans Pelicans" },
  "thunder":    { sport: "nba", search: "Oklahoma City",       fullName: "Oklahoma City Thunder" },
  "okc":        { sport: "nba", search: "Oklahoma City",       fullName: "Oklahoma City Thunder" },
  "raptors":    { sport: "nba", search: "Toronto",             fullName: "Toronto Raptors" },
  "jazz":       { sport: "nba", search: "Utah",                fullName: "Utah Jazz" },
  "kings":      { sport: "nba", search: "Sacramento",          fullName: "Sacramento Kings" },
  "spurs":      { sport: "nba", search: "San Antonio",         fullName: "San Antonio Spurs" },
  "magic":      { sport: "nba", search: "Orlando",             fullName: "Orlando Magic" },
  "pistons":    { sport: "nba", search: "Detroit",             fullName: "Detroit Pistons" },
  "pacers":     { sport: "nba", search: "Indiana",             fullName: "Indiana Pacers" },
  "cavaliers":  { sport: "nba", search: "Cleveland",           fullName: "Cleveland Cavaliers" },
  "cavs":       { sport: "nba", search: "Cleveland",           fullName: "Cleveland Cavaliers" },
  "rockets":    { sport: "nba", search: "Houston",             fullName: "Houston Rockets" },
  "timberwolves": { sport: "nba", search: "Minnesota",         fullName: "Minnesota Timberwolves" },
  "wolves":     { sport: "nba", search: "Minnesota",           fullName: "Minnesota Timberwolves" },
  "wizards":    { sport: "nba", search: "Washington",          fullName: "Washington Wizards" },
  "hornets":    { sport: "nba", search: "Charlotte",           fullName: "Charlotte Hornets" },
  "trail blazers": { sport: "nba", search: "Portland",         fullName: "Portland Trail Blazers" },
  "blazers":    { sport: "nba", search: "Portland",            fullName: "Portland Trail Blazers" },

  // MLB
  "yankees":    { sport: "mlb", search: "New York Yankees",  fullName: "New York Yankees" },
  "dodgers":    { sport: "mlb", search: "Los Angeles Dodgers", fullName: "Los Angeles Dodgers" },
  "red sox":    { sport: "mlb", search: "Boston",            fullName: "Boston Red Sox" },
  "cubs":       { sport: "mlb", search: "Chicago Cubs",      fullName: "Chicago Cubs" },
  "mets":       { sport: "mlb", search: "New York Mets",     fullName: "New York Mets" },
  "astros":     { sport: "mlb", search: "Houston",           fullName: "Houston Astros" },
  "braves":     { sport: "mlb", search: "Atlanta",           fullName: "Atlanta Braves" },
  "phillies":   { sport: "mlb", search: "Philadelphia",      fullName: "Philadelphia Phillies" },
  "cardinals":  { sport: "mlb", search: "St. Louis",         fullName: "St. Louis Cardinals" },
  "giants":     { sport: "mlb", search: "San Francisco",     fullName: "San Francisco Giants" },
  "padres":     { sport: "mlb", search: "San Diego",         fullName: "San Diego Padres" },
  "mariners":   { sport: "mlb", search: "Seattle",           fullName: "Seattle Mariners" },
  "blue jays":  { sport: "mlb", search: "Toronto",           fullName: "Toronto Blue Jays" },
  "jays":       { sport: "mlb", search: "Toronto",           fullName: "Toronto Blue Jays" },
  "rays":       { sport: "mlb", search: "Tampa Bay",         fullName: "Tampa Bay Rays" },
  "tigers":     { sport: "mlb", search: "Detroit",           fullName: "Detroit Tigers" },
  "white sox":  { sport: "mlb", search: "Chicago White Sox", fullName: "Chicago White Sox" },
  "brewers":    { sport: "mlb", search: "Milwaukee",         fullName: "Milwaukee Brewers" },
  "reds":       { sport: "mlb", search: "Cincinnati",        fullName: "Cincinnati Reds" },
  "pirates":    { sport: "mlb", search: "Pittsburgh",        fullName: "Pittsburgh Pirates" },
  "orioles":    { sport: "mlb", search: "Baltimore",         fullName: "Baltimore Orioles" },
  "nationals":  { sport: "mlb", search: "Washington",        fullName: "Washington Nationals" },
  "nats":       { sport: "mlb", search: "Washington",        fullName: "Washington Nationals" },
  "athletics":  { sport: "mlb", search: "Oakland",           fullName: "Oakland Athletics" },
  "royals":     { sport: "mlb", search: "Kansas City",       fullName: "Kansas City Royals" },
  "angels":     { sport: "mlb", search: "Los Angeles Angels", fullName: "Los Angeles Angels" },
  "rangers":    { sport: "mlb", search: "Texas",             fullName: "Texas Rangers" },
  "rockies":    { sport: "mlb", search: "Colorado",          fullName: "Colorado Rockies" },
  "diamondbacks": { sport: "mlb", search: "Arizona",         fullName: "Arizona Diamondbacks" },
  "dbacks":     { sport: "mlb", search: "Arizona",           fullName: "Arizona Diamondbacks" },
  "twins":      { sport: "mlb", search: "Minnesota",         fullName: "Minnesota Twins" },

  // NHL
  "maple leafs": { sport: "nhl", search: "Toronto",        fullName: "Toronto Maple Leafs" },
  "leafs":       { sport: "nhl", search: "Toronto",        fullName: "Toronto Maple Leafs" },
  "rangers":     { sport: "nhl", search: "New York Rangers", fullName: "New York Rangers" },
  "bruins":      { sport: "nhl", search: "Boston",         fullName: "Boston Bruins" },
  "penguins":    { sport: "nhl", search: "Pittsburgh",     fullName: "Pittsburgh Penguins" },
  "pens":        { sport: "nhl", search: "Pittsburgh",     fullName: "Pittsburgh Penguins" },
  "blackhawks":  { sport: "nhl", search: "Chicago",        fullName: "Chicago Blackhawks" },
  "hawks":       { sport: "nhl", search: "Chicago",        fullName: "Chicago Blackhawks" },
  "canadiens":   { sport: "nhl", search: "Montreal",       fullName: "Montreal Canadiens" },
  "habs":        { sport: "nhl", search: "Montreal",       fullName: "Montreal Canadiens" },
  "capitals":    { sport: "nhl", search: "Washington",     fullName: "Washington Capitals" },
  "caps":        { sport: "nhl", search: "Washington",     fullName: "Washington Capitals" },
  "lightning":   { sport: "nhl", search: "Tampa Bay",      fullName: "Tampa Bay Lightning" },
  "bolts":       { sport: "nhl", search: "Tampa Bay",      fullName: "Tampa Bay Lightning" },
  "oilers":      { sport: "nhl", search: "Edmonton",       fullName: "Edmonton Oilers" },
  "golden knights": { sport: "nhl", search: "Vegas",       fullName: "Vegas Golden Knights" },
  "knights":     { sport: "nhl", search: "Vegas",          fullName: "Vegas Golden Knights" },
  "hurricanes":  { sport: "nhl", search: "Carolina",       fullName: "Carolina Hurricanes" },
  "canes":       { sport: "nhl", search: "Carolina",       fullName: "Carolina Hurricanes" },
  "avalanche":   { sport: "nhl", search: "Colorado",       fullName: "Colorado Avalanche" },
  "avs":         { sport: "nhl", search: "Colorado",       fullName: "Colorado Avalanche" },
  "flames":      { sport: "nhl", search: "Calgary",        fullName: "Calgary Flames" },
  "canucks":     { sport: "nhl", search: "Vancouver",      fullName: "Vancouver Canucks" },
  "flyers":      { sport: "nhl", search: "Philadelphia",   fullName: "Philadelphia Flyers" },
  "stars":       { sport: "nhl", search: "Dallas",         fullName: "Dallas Stars" },
  "red wings":   { sport: "nhl", search: "Detroit",        fullName: "Detroit Red Wings" },
  "wings":       { sport: "nhl", search: "Detroit",        fullName: "Detroit Red Wings" },
  "predators":   { sport: "nhl", search: "Nashville",      fullName: "Nashville Predators" },
  "preds":       { sport: "nhl", search: "Nashville",      fullName: "Nashville Predators" },
  "senators":    { sport: "nhl", search: "Ottawa",         fullName: "Ottawa Senators" },
  "jets":        { sport: "nhl", search: "Winnipeg",       fullName: "Winnipeg Jets" },
  "ducks":       { sport: "nhl", search: "Anaheim",        fullName: "Anaheim Ducks" },
  "sharks":      { sport: "nhl", search: "San Jose",       fullName: "San Jose Sharks" },
  "sabres":      { sport: "nhl", search: "Buffalo",        fullName: "Buffalo Sabres" },
  "wild":        { sport: "nhl", search: "Minnesota",      fullName: "Minnesota Wild" },
  "islanders":   { sport: "nhl", search: "New York Islanders", fullName: "New York Islanders" },
  "devils":      { sport: "nhl", search: "New Jersey",     fullName: "New Jersey Devils" },
  "blues":       { sport: "nhl", search: "St. Louis",      fullName: "St. Louis Blues" },
  "blue jackets": { sport: "nhl", search: "Columbus",      fullName: "Columbus Blue Jackets" },
  "kraken":      { sport: "nhl", search: "Seattle",        fullName: "Seattle Kraken" },
};

// ─── Team extraction ──────────────────────────────────────────────────────────
// Returns up to `limit` distinct teams mentioned in text (longest keyword wins to avoid
// "wings" matching before "red wings").
function extractMentionedTeams(
  text: string,
  limit = 2
): Array<{ sport: string; search: string; fullName: string }> {
  const lower = text.toLowerCase();
  const keys = Object.keys(TEAM_DB).sort((a, b) => b.length - a.length);
  const found: Array<{ sport: string; search: string; fullName: string }> = [];
  const seenNames = new Set<string>();
  for (const key of keys) {
    if (found.length >= limit) break;
    if (!lower.includes(key)) continue;
    const team = TEAM_DB[key];
    if (seenNames.has(team.fullName)) continue;
    seenNames.add(team.fullName);
    found.push(team);
  }
  return found;
}

// ─── Message flag detection ───────────────────────────────────────────────────
function detectMessageFlags(text: string): {
  hasParlay: boolean;
  parlayLegCount: number;
  hasLowOdds: boolean;
  lowOddsValue: number | null;
  hasRevengeNarrative: boolean;
  hasHotStreakMention: boolean;
  hasLossChasing: boolean;
  mentionedOdds: number | null; // positive American odds the user mentioned, e.g. +150
} {
  const lower = text.toLowerCase();
  const hasParlay = /parlay|multi.?leg|combo bet|teaser/.test(lower);

  let parlayLegCount = 0;
  if (hasParlay) {
    const legNumMatches = lower.match(/leg\s*\d/g);
    if (legNumMatches) {
      parlayLegCount = legNumMatches.length;
    } else {
      parlayLegCount = extractMentionedTeams(text, 10).length;
    }
    if (parlayLegCount < 2) parlayLegCount = 2;
  }

  const negOddsMatch = lower.match(/-(\d{3,})/);
  const lowOddsValue = negOddsMatch ? parseInt(negOddsMatch[1]) : null;
  const hasLowOdds = lowOddsValue !== null && lowOddsValue >= 200;

  // Positive odds the user mentioned (e.g. "+180", "plus 220")
  const posOddsMatch = text.match(/\+(\d{2,3})/);
  const mentionedOdds = posOddsMatch ? parseInt(posOddsMatch[1]) : null;

  const hasRevengeNarrative = /revenge|they owe|last time|embarrassed|blowout.*back/.test(lower);
  const hasHotStreakMention = /hot streak|on fire|can't lose|unbeatable|unstoppable|winning streak/.test(lower);
  const hasLossChasing = /get it back|make it back|chasing|dig out|make up for|down \$|lost (today|tonight|this week|yesterday)|need a win|recover/.test(lower);

  return {
    hasParlay,
    parlayLegCount,
    hasLowOdds,
    lowOddsValue,
    hasRevengeNarrative,
    hasHotStreakMention,
    hasLossChasing,
    mentionedOdds,
  };
}

// ─── Historical data fetcher (API-Sports) ─────────────────────────────────────
async function fetchTeamRecentGames(
  team: { sport: string; search: string; fullName: string },
  apiKey: string,
  count = 5
): Promise<string> {
  try {
    const base = SPORT_API_BASE[team.sport];
    if (!base) return "";

    // Step 1: Find team ID
    const teamResp = await fetch(
      `${base}/teams?search=${encodeURIComponent(team.search)}`,
      { headers: { "x-apisports-key": apiKey } }
    );
    if (!teamResp.ok) return "";
    const teamData = await teamResp.json();
    const teamId: number | undefined = teamData.response?.[0]?.id;
    if (!teamId) return "";

    // Step 2: Fetch recent finished games
    const season = CURRENT_SEASON[team.sport];
    const gamesResp = await fetch(
      `${base}/games?season=${season}&team=${teamId}&status=finished`,
      { headers: { "x-apisports-key": apiKey } }
    );
    if (!gamesResp.ok) return "";
    const gamesData = await gamesResp.json();
    if (!Array.isArray(gamesData.response) || gamesData.response.length === 0) return "";

    // Sort by date desc and take last N
    const sorted = gamesData.response.sort((a: any, b: any) => {
      const getDate = (g: any) =>
        new Date(g.game?.date?.date ?? g.game?.date ?? g.date ?? 0).getTime();
      return getDate(b) - getDate(a);
    });
    const recent = sorted.slice(0, count);

    // Parse scores — handle different response shapes per sport
    const lines = recent.map((g: any): string | null => {
      try {
        const homeTeam: string = g.teams?.home?.name ?? "Home";
        const awayTeam: string = g.teams?.away?.name ?? g.teams?.visitors?.name ?? "Away";

        let homeScore: number, awayScore: number;
        if (team.sport === "nba") {
          homeScore = g.scores?.home?.points;
          awayScore = g.scores?.visitors?.points;
        } else if (team.sport === "mlb") {
          homeScore = g.scores?.home?.runs?.total ?? g.scores?.home?.total;
          awayScore = g.scores?.away?.runs?.total ?? g.scores?.away?.total;
        } else if (team.sport === "nhl") {
          homeScore = typeof g.scores?.home === "number" ? g.scores.home : g.scores?.home?.total;
          awayScore = typeof g.scores?.away === "number" ? g.scores.away : g.scores?.away?.total;
        } else {
          // NFL
          homeScore = g.scores?.home?.total;
          awayScore = g.scores?.away?.total;
        }

        if (homeScore == null || awayScore == null) return null;

        const rawDate: string = g.game?.date?.date ?? g.game?.date ?? g.date ?? "";
        const date = rawDate.split("T")[0] || rawDate;
        const isHome = homeTeam.toLowerCase().includes(team.search.toLowerCase());
        const teamScore = isHome ? homeScore : awayScore;
        const oppScore = isHome ? awayScore : homeScore;
        const oppName = isHome ? awayTeam : homeTeam;
        const result = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T";

        return `  ${date} vs ${oppName}: ${result} ${teamScore}-${oppScore} (${isHome ? "Home" : "Away"})`;
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (lines.length === 0) return "";

    const wCount = lines.filter((l: any) => l?.includes(": W ")).length;
    const lCount = lines.filter((l: any) => l?.includes(": L ")).length;

    return `${team.fullName} — Last ${lines.length} games (${wCount}W-${lCount}L):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// ─── Live odds from The Odds API ─────────────────────────────────────────────
const ODDS_SPORT_KEY: Record<string, string> = {
  nfl: "americanfootball_nfl",
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl",
};

async function fetchLiveOddsForTeam(
  team: { sport: string; search: string; fullName: string },
  oddsApiKey: string
): Promise<string> {
  try {
    const sportKey = ODDS_SPORT_KEY[team.sport];
    if (!sportKey) return "";

    const resp = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?` +
        `apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`
    );
    if (!resp.ok) return "";

    const games: any[] = await resp.json();
    const game = games.find(
      (g) =>
        g.home_team.toLowerCase().includes(team.search.toLowerCase()) ||
        g.away_team.toLowerCase().includes(team.search.toLowerCase())
    );
    if (!game) return `No upcoming game found for ${team.fullName}.`;

    const gameTime = new Date(game.commence_time).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });

    const fmtLine = (odds: number) => `${odds > 0 ? "+" : ""}${odds}`;

    // Build odds rows per bookmaker
    const bmRows: string[] = [];
    for (const bm of (game.bookmakers ?? []).slice(0, 6)) {
      const h2h = bm.markets?.find((m: any) => m.key === "h2h");
      const spreads = bm.markets?.find((m: any) => m.key === "spreads");
      const totals = bm.markets?.find((m: any) => m.key === "totals");

      const homeML = h2h?.outcomes?.find((o: any) => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find((o: any) => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find((o: any) => o.name === game.home_team);
      const total = totals?.outcomes?.[0]?.point;

      const parts: string[] = [];
      if (awayML != null) parts.push(`Away ML: ${fmtLine(awayML)}`);
      if (homeML != null) parts.push(`Home ML: ${fmtLine(homeML)}`);
      if (homeSpread) parts.push(`Spread: ${fmtLine(homeSpread.point)} (${fmtLine(homeSpread.price)})`);
      if (total != null) parts.push(`O/U: ${total}`);

      if (parts.length) bmRows.push(`  ${bm.title}: ${parts.join(" | ")}`);
    }

    // Best moneyline for each side
    let bestHome: { book: string; odds: number } | null = null;
    let bestAway: { book: string; odds: number } | null = null;
    for (const bm of game.bookmakers ?? []) {
      const h2h = bm.markets?.find((m: any) => m.key === "h2h");
      const homeOdds = h2h?.outcomes?.find((o: any) => o.name === game.home_team)?.price;
      const awayOdds = h2h?.outcomes?.find((o: any) => o.name === game.away_team)?.price;
      if (homeOdds != null && (!bestHome || homeOdds > bestHome.odds))
        bestHome = { book: bm.title, odds: homeOdds };
      if (awayOdds != null && (!bestAway || awayOdds > bestAway.odds))
        bestAway = { book: bm.title, odds: awayOdds };
    }

    const lines = [
      `LIVE ODDS: ${game.away_team} @ ${game.home_team} (${gameTime} ET)`,
      bestAway ? `  Best ${game.away_team} ML: ${fmtLine(bestAway.odds)} @ ${bestAway.book}` : "",
      bestHome ? `  Best ${game.home_team} ML: ${fmtLine(bestHome.odds)} @ ${bestHome.book}` : "",
      "",
      "BY SPORTSBOOK:",
      ...bmRows,
    ].filter((l) => l !== undefined);

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ─── ESPN injury reports & news (no API key required) ────────────────────────
const ESPN_MAP: Record<string, { sport: string; league: string }> = {
  nfl: { sport: "football",   league: "nfl" },
  nba: { sport: "basketball", league: "nba" },
  mlb: { sport: "baseball",   league: "mlb" },
  nhl: { sport: "hockey",     league: "nhl" },
};

// Injury statuses that materially affect betting
const NOTABLE_STATUSES = ["out", "doubtful", "questionable", "day-to-day", "injured reserve", "ir"];

async function fetchEspnInjuries(
  team: { sport: string; search: string; fullName: string }
): Promise<string> {
  try {
    const espn = ESPN_MAP[team.sport];
    if (!espn) return "";

    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}/injuries`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; NoGame/1.0)" } }
    );
    if (!resp.ok) return "";

    const data = await resp.json();
    const allInjuries: any[] = data.injuries ?? [];

    // Match this team's players
    const searchLower = team.search.toLowerCase();
    const fullLower = team.fullName.toLowerCase();

    const teamInjuries = allInjuries.filter((inj: any) => {
      const name: string = (inj.athlete?.team?.displayName ?? inj.athlete?.team?.name ?? "").toLowerCase();
      const abbr: string = (inj.athlete?.team?.abbreviation ?? "").toLowerCase();
      return name.includes(searchLower) || fullLower.includes(abbr);
    });

    const notable = teamInjuries
      .map((inj: any) => {
        const player: string = inj.athlete?.displayName ?? "Unknown";
        const rawStatus: string = (
          inj.status ??
          inj.injuries?.[0]?.status ??
          ""
        ).toLowerCase();
        const injType: string =
          inj.type?.description ??
          inj.injuries?.[0]?.type?.description ??
          "";
        const isNotable = NOTABLE_STATUSES.some((s) => rawStatus.includes(s));
        return { player, rawStatus, injType, isNotable };
      })
      .filter((p) => p.isNotable);

    if (!notable.length) return `${team.fullName}: No notable injuries reported.`;

    const lines = notable.map(
      (p) =>
        `  ${p.player}: ${p.rawStatus.toUpperCase()}${p.injType ? ` (${p.injType})` : ""}`
    );
    return `${team.fullName} INJURY REPORT:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

async function fetchEspnNews(
  team: { sport: string; search: string; fullName: string }
): Promise<string> {
  try {
    const espn = ESPN_MAP[team.sport];
    if (!espn) return "";

    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espn.sport}/${espn.league}/news?limit=20`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; NoGame/1.0)" } }
    );
    if (!resp.ok) return "";

    const data = await resp.json();
    const articles: any[] = data.articles ?? [];

    // Filter for articles about this team from the last 48 hours
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const searchTerms = team.fullName
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 3);
    searchTerms.push(team.search.toLowerCase());

    const relevant = articles.filter((a: any) => {
      const pub = new Date(a.published ?? a.lastModified ?? 0).getTime();
      if (pub < cutoff) return false;
      const text = `${a.headline ?? ""} ${a.description ?? ""}`.toLowerCase();
      return searchTerms.some((t) => text.includes(t));
    });

    if (!relevant.length) return "";

    const headlines = relevant.slice(0, 5).map((a: any) => {
      const ageH = Math.round(
        (Date.now() - new Date(a.published ?? 0).getTime()) / 3_600_000
      );
      const ageStr = ageH < 1 ? "just now" : `${ageH}h ago`;
      return `  • [${ageStr}] ${a.headline}`;
    });

    return `${team.fullName} NEWS:\n${headlines.join("\n")}`;
  } catch {
    return "";
  }
}

// Fetch both injuries and news for a team, combined into one string
async function fetchInjuryAndNews(
  team: { sport: string; search: string; fullName: string }
): Promise<string> {
  const [injuries, news] = await Promise.all([
    fetchEspnInjuries(team),
    fetchEspnNews(team),
  ]);
  return [injuries, news].filter(Boolean).join("\n");
}

// ─── User pattern analysis ────────────────────────────────────────────────────
function analyzeUserPatterns(bets: any[]): string {
  const settled = [...bets.filter((b) => b.status === "won" || b.status === "lost")]
    .sort((a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime());

  if (settled.length < 4) return "Not enough settled bets to detect patterns yet.";

  const traps: string[] = [];

  // Per-team loss rate
  const byTeam: Record<string, { w: number; l: number }> = {};
  for (const b of settled) {
    const key = (b.selection ?? "").toLowerCase().trim();
    if (!key) continue;
    if (!byTeam[key]) byTeam[key] = { w: 0, l: 0 };
    b.status === "won" ? byTeam[key].w++ : byTeam[key].l++;
  }
  for (const [team, { w, l }] of Object.entries(byTeam)) {
    const total = w + l;
    if (total >= 3 && l / total >= 0.67) {
      traps.push(`Consistently losing on "${team}" (${l}L / ${w}W — ${Math.round((l / total) * 100)}% loss rate)`);
    }
  }

  // Per-sport loss rate
  const bySport: Record<string, { w: number; l: number }> = {};
  for (const b of settled) {
    const s = b.sport ?? "unknown";
    if (!bySport[s]) bySport[s] = { w: 0, l: 0 };
    b.status === "won" ? bySport[s].w++ : bySport[s].l++;
  }
  for (const [sport, { w, l }] of Object.entries(bySport)) {
    const total = w + l;
    if (total >= 5 && l / total >= 0.65) {
      traps.push(`${sport.toUpperCase()} bets are a money drain (${l}L / ${w}W — ${Math.round((l / total) * 100)}% loss rate)`);
    }
  }

  // Heavy-favourite moneyline trap
  const mlFavs = settled.filter((b) => b.bet_type === "moneyline" && b.odds < -180);
  if (mlFavs.length >= 3) {
    const wins = mlFavs.filter((b) => b.status === "won").length;
    const rate = wins / mlFavs.length;
    if (rate < 0.55) {
      traps.push(`Heavy-favourite moneylines are underperforming (${Math.round(rate * 100)}% hit rate on bets -180 or shorter, should be 64%+)`);
    }
  }

  // Loss-chasing: recent losing streak + stake escalation
  const recent = settled.slice(-6);
  const recentLosses = recent.filter((b) => b.status === "lost").length;
  if (recentLosses >= 4) {
    traps.push(`On a cold streak — ${recentLosses} losses in the last ${recent.length} settled bets. High loss-chasing risk right now.`);
  } else if (recentLosses >= 3) {
    // Check if stakes grew after losses
    let prevWasLoss = false;
    let stakeJumps = 0;
    for (let i = 1; i < recent.length; i++) {
      if (prevWasLoss && recent[i].stake > recent[i - 1].stake * 1.4) stakeJumps++;
      prevWasLoss = recent[i - 1].status === "lost";
    }
    if (stakeJumps >= 1) {
      traps.push(`Stake escalation detected after losses — possible loss-chasing pattern. Bankroll discipline needed.`);
    }
  }

  if (traps.length === 0) return "No consistent losing patterns detected yet. Clean record.";
  return `USER-SPECIFIC PATTERNS (reference these when the conversation is relevant):\n${traps.map((t) => `⚠ ${t}`).join("\n")}`;
}

// ─── Deep stats: per-type, per-sport, per-team ───────────────────────────────
type StatBucket = { w: number; l: number; staked: number; returned: number };

function computeDetailedStats(bets: any[]): {
  byType: Record<string, StatBucket>;
  bySport: Record<string, StatBucket>;
  byTeam: Record<string, { w: number; l: number }>;
  bestType: [string, StatBucket] | null;
  worstType: [string, StatBucket] | null;
  bestSport: [string, StatBucket] | null;
  worstSport: [string, StatBucket] | null;
  bestTeam: [string, { w: number; l: number }] | null;
  worstTeam: [string, { w: number; l: number }] | null;
} {
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");

  const byType: Record<string, StatBucket> = {};
  const bySport: Record<string, StatBucket> = {};
  const byTeam: Record<string, { w: number; l: number }> = {};

  for (const b of settled) {
    const type = b.bet_type ?? "moneyline";
    const sport = b.sport ?? "unknown";
    const team = (b.selection ?? "").toLowerCase().trim();

    if (!byType[type]) byType[type] = { w: 0, l: 0, staked: 0, returned: 0 };
    if (!bySport[sport]) bySport[sport] = { w: 0, l: 0, staked: 0, returned: 0 };
    if (team && !byTeam[team]) byTeam[team] = { w: 0, l: 0 };

    const isWin = b.status === "won";
    byType[type][isWin ? "w" : "l"]++;
    byType[type].staked += b.stake;
    bySport[sport][isWin ? "w" : "l"]++;
    bySport[sport].staked += b.stake;
    if (team) byTeam[team][isWin ? "w" : "l"]++;

    if (isWin) {
      byType[type].returned += b.potential_payout;
      bySport[sport].returned += b.potential_payout;
    }
  }

  function bucketROI(r: StatBucket): number {
    return r.staked > 0 ? ((r.returned - r.staked) / r.staked) * 100 : -999;
  }
  function teamWR(r: { w: number; l: number }): number {
    const t = r.w + r.l;
    return t > 0 ? r.w / t : 0;
  }

  const typeEntries = Object.entries(byType).filter(([, v]) => v.w + v.l >= 3);
  const sportEntries = Object.entries(bySport).filter(([, v]) => v.w + v.l >= 3);
  const teamEntries = Object.entries(byTeam).filter(([, v]) => v.w + v.l >= 3);

  const bestType = typeEntries.length
    ? typeEntries.sort((a, b) => bucketROI(b[1]) - bucketROI(a[1]))[0]
    : null;
  const worstType = typeEntries.length
    ? typeEntries.sort((a, b) => bucketROI(a[1]) - bucketROI(b[1]))[0]
    : null;
  const bestSport = sportEntries.length
    ? sportEntries.sort((a, b) => bucketROI(b[1]) - bucketROI(a[1]))[0]
    : null;
  const worstSport = sportEntries.length
    ? sportEntries.sort((a, b) => bucketROI(a[1]) - bucketROI(b[1]))[0]
    : null;
  const bestTeam = teamEntries.length
    ? teamEntries.sort((a, b) => teamWR(b[1]) - teamWR(a[1]))[0]
    : null;
  const worstTeam = teamEntries.filter(([, v]) => v.l > v.w).length
    ? teamEntries.filter(([, v]) => v.l > v.w)
        .sort((a, b) => teamWR(a[1]) - teamWR(b[1]))[0]
    : null;

  return { byType, bySport, byTeam, bestType, worstType, bestSport, worstSport, bestTeam, worstTeam };
}

// ─── Personality detection ────────────────────────────────────────────────────
type PersonalityType = "conservative" | "aggressive" | "chaser" | "data_driven" | "balanced";

function detectPersonality(
  bets: any[],
  profile: any
): { type: PersonalityType; toneGuidance: string; styleSummary: string } {
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const bankroll = profile?.bankroll ?? 1000;

  // Loss chasing signal: 4+ losses in last 6 settled
  const recent6 = [...settled].sort(
    (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
  ).slice(0, 6);
  const recentLosses = recent6.filter((b) => b.status === "lost").length;

  // Stake escalation after losses
  let stakeEscalations = 0;
  for (let i = 1; i < recent6.length; i++) {
    if (recent6[i - 1].status === "lost" && recent6[i].stake > recent6[i - 1].stake * 1.4) {
      stakeEscalations++;
    }
  }

  // Parlay rate
  const parlayRate = bets.length > 0
    ? bets.filter((b) => b.bet_type === "parlay").length / bets.length
    : 0;

  // Average stake as fraction of bankroll
  const avgStake = settled.length > 0
    ? settled.reduce((s, b) => s + b.stake, 0) / settled.length
    : 0;
  const stakeRatio = bankroll > 0 ? avgStake / bankroll : 0;

  // Underdog preference (positive odds)
  const underdogRate = settled.length > 0
    ? settled.filter((b) => b.odds > 0).length / settled.length
    : 0;

  const kellyFrac = profile?.kelly_fraction ?? 0.25;

  let type: PersonalityType;

  if (recentLosses >= 4 || stakeEscalations >= 2) {
    type = "chaser";
  } else if (stakeRatio > 0.08 || parlayRate > 0.3 || underdogRate > 0.55) {
    type = "aggressive";
  } else if (kellyFrac <= 0.15 || stakeRatio < 0.015) {
    type = "conservative";
  } else {
    type = "balanced";
  }

  // Build per-type/sport win rates for style summary
  const stats = computeDetailedStats(bets);
  const lines: string[] = [];

  if (stats.bestType) {
    const [t, v] = stats.bestType;
    const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
    const roi = v.staked > 0 ? ((v.returned - v.staked) / v.staked * 100).toFixed(1) : "?";
    lines.push(`Best bet type: ${t} — ${wr}% win rate, ${roi}% ROI (${v.w}W-${v.l}L)`);
  }
  if (stats.worstType && stats.worstType[0] !== stats.bestType?.[0]) {
    const [t, v] = stats.worstType;
    const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
    lines.push(`Worst bet type: ${t} — ${wr}% win rate (${v.w}W-${v.l}L)`);
  }
  if (stats.bestSport) {
    const [s, v] = stats.bestSport;
    const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
    const roi = v.staked > 0 ? ((v.returned - v.staked) / v.staked * 100).toFixed(1) : "?";
    lines.push(`Best sport: ${s} — ${wr}% win rate, ${roi}% ROI (${v.w}W-${v.l}L)`);
  }
  if (stats.worstSport && stats.worstSport[0] !== stats.bestSport?.[0]) {
    const [s, v] = stats.worstSport;
    const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
    lines.push(`Worst sport: ${s} — ${wr}% win rate (${v.w}W-${v.l}L)`);
  }
  if (stats.bestTeam) {
    const [team, v] = stats.bestTeam;
    const wr = Math.round((v.w / (v.w + v.l)) * 100);
    lines.push(`Top pick: "${team}" — ${wr}% win rate (${v.w}W-${v.l}L)`);
  }
  if (stats.worstTeam) {
    const [team, v] = stats.worstTeam;
    const wr = Math.round((v.w / (v.w + v.l)) * 100);
    lines.push(`Consistent loser: "${team}" — only ${wr}% win rate (${v.w}W-${v.l}L)`);
  }

  const styleSummary = lines.join("\n");

  const toneGuidance: Record<PersonalityType, string> = {
    chaser: `⚠ CHASER DETECTED. This user is on a cold streak and likely trying to recover losses.
TONE: Firm but supportive — like a friend pulling them back from the edge. Prioritize their bankroll health over any analysis.
LEAD with the pattern: "Hold up. You're down [X] this week — I see it in the data."
Only analyze the bet AFTER you've acknowledged the chasing pattern. Never enable chasing by jumping straight to analysis.
EXAMPLE OPENINGS: "Hold up.", "Nah, not right now.", "I need you to hear this first."`,

    aggressive: `AGGRESSIVE BETTOR. High-stake, action-heavy, underdog-chaser.
TONE: Match their energy — casual, direct, no hand-holding. But be honest when a bet is bad.
REFERENCE specific win rates to give them confidence or pump the brakes.
EXAMPLE OPENINGS: "Yo, this one's interesting.", "You're built for this kind of bet, but...", "Real talk —"`,

    conservative: `CONSERVATIVE BETTOR. Data-first, low-stakes, careful with bankroll.
TONE: Precise and analytical. Reference statistics directly. Explain the math behind decisions.
Use measured, professional language. No slang. They want facts, not hype.
EXAMPLE OPENINGS: "Based on your data...", "The numbers here show...", "Your historical edge on [type] bets is..."`,

    data_driven: `DATA-DRIVEN BETTOR. Wants the full analysis — every number, every edge.
TONE: Go deep on stats. They read every word. Reference their specific win rates in every analysis.
Include ROI, implied probability gaps, historical hit rates. Don't simplify — they can handle it.
EXAMPLE OPENINGS: "Looking at the data...", "Your win rate on [type] is X%, which tells us...", "The implied probability gap here is..."`,

    balanced: `BALANCED BETTOR. Mix of casual betting and data interest.
TONE: Conversational but informed. Data when it matters, casual when it doesn't. Adapt to their message tone.
EXAMPLE OPENINGS: "Solid question.", "Here's what I see:", "Let me check this for you."`,
  };

  return { type, toneGuidance: toneGuidance[type], styleSummary };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt$(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtOdds(o: number): string {
  return o > 0 ? `+${o}` : String(o);
}

function calcWinRate(bets: any[]): string {
  const s = bets.filter((b) => b.status === "won" || b.status === "lost");
  if (!s.length) return "no settled bets";
  const w = s.filter((b) => b.status === "won").length;
  return `${Math.round((w / s.length) * 100)}% (${w}W / ${s.length - w}L)`;
}

function calcROI(bets: any[]): string {
  const s = bets.filter((b) => b.status === "won" || b.status === "lost");
  if (!s.length) return "N/A";
  const staked = s.reduce((sum, b) => sum + b.stake, 0);
  const returned = s.filter((b) => b.status === "won").reduce((sum, b) => sum + b.potential_payout, 0);
  const roi = ((returned - staked) / staked) * 100;
  return `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
}

// ─── EV calculation helper ────────────────────────────────────────────────────
function impliedProbToOdds(prob: number): string {
  if (prob <= 0 || prob >= 1) return "N/A";
  if (prob >= 0.5) {
    const odds = Math.round(-(prob / (1 - prob)) * 100);
    return String(odds);
  }
  const odds = Math.round(((1 - prob) / prob) * 100);
  return `+${odds}`;
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(
  profile: any,
  bets: any[],
  aiPicks: any[],
  historicalData: string,
  liveOddsData: string,
  injuryNewsData: string,
  userPatterns: string,
  flags: ReturnType<typeof detectMessageFlags>,
  mentionedTeamNames: string[],
  personality: ReturnType<typeof detectPersonality>
): string {
  const bankroll = fmt$(profile?.bankroll ?? 0);
  const kellyPct = Math.round((profile?.kelly_fraction ?? 0.25) * 100);
  const kellyLabel =
    kellyPct <= 25 ? "Quarter-Kelly (conservative)" :
    kellyPct <= 50 ? "Half-Kelly (moderate risk)" : "Full-Kelly (aggressive — caution)";

  const openBets = bets.filter((b) => b.status === "pending");
  const recentSettled = bets.filter((b) => b.status !== "pending").slice(0, 8);

  const openBetsText = !openBets.length
    ? "None"
    : openBets.map((b) =>
        `• ${b.selection} ${fmtOdds(b.odds)} (${b.bet_type}) @ ${b.bookmaker_key ?? "?"} | ${fmt$(b.stake)} | ${b.game_description}`
      ).join("\n");

  const recentBetsText = !recentSettled.length
    ? "No settled bets yet"
    : recentSettled.map((b) => {
        const pnl = b.status === "won" ? `+${fmt$(b.potential_payout - b.stake)}` : `-${fmt$(b.stake)}`;
        return `• ${b.status === "won" ? "✓" : "✗"} ${b.selection} ${fmtOdds(b.odds)} | ${fmt$(b.stake)} stake | ${pnl} | ${b.game_description}`;
      }).join("\n");

  const picksText = !aiPicks.length
    ? "No active AI picks right now."
    : aiPicks.map((p, i) => {
        const conf = p.confidence_pct !== null && p.confidence_pct !== undefined
          ? ` | ${p.confidence_pct}% win est.`
          : "";
        const oddsRows = Array.isArray(p.odds_data) && p.odds_data.length > 1
          ? "\n   Odds: " + p.odds_data.slice(0, 4).map((o: any) => `${o.title}: ${fmtOdds(o.odds)}`).join(" | ")
          : "";
        return `${i + 1}. ${p.selection} ${fmtOdds(p.recommended_odds)} — ${p.sport} — Value: ${p.value_rating}/10${conf}\n   ${p.reasoning}\n   Best line @ ${p.bookmaker_key}${oddsRows}`;
      }).join("\n\n");

  // ── EV context: if user mentioned specific odds, compute fair-value reference ──
  let evContext = "";
  if (flags.mentionedOdds !== null) {
    const userOdds = flags.mentionedOdds;
    const impliedWinPct = Math.round((100 / (userOdds + 100)) * 100);
    evContext = `User mentioned +${userOdds} odds → implied win probability: ${impliedWinPct}%. Use historical data to judge if actual win rate backs this up.`;
  } else if (flags.lowOddsValue !== null) {
    const impliedWinPct = Math.round((flags.lowOddsValue / (flags.lowOddsValue + 100)) * 100);
    evContext = `User mentioned -${flags.lowOddsValue} odds → implied win probability: ${impliedWinPct}%. Check if historical results actually hit that rate.`;
  }

  // ── Active flags ──────────────────────────────────────────────────────────────
  const activeFlags: string[] = [];
  if (flags.hasParlay) {
    if (flags.parlayLegCount > 2) {
      activeFlags.push(`⚠ PARLAY OVER LIMIT — ${flags.parlayLegCount} legs described. Enforce the 2-leg max before any analysis.`);
    } else {
      activeFlags.push(`⚠ PARLAY DETECTED (${flags.parlayLegCount} legs) — run PARLAY PROTOCOL below, analyze each leg individually first.`);
    }
  }
  if (flags.hasLossChasing) activeFlags.push("⚠ LOSS CHASING — user language suggests they're trying to recover losses. Flag this before analyzing any bet. Remind them that chasing is how small losses become big ones.");
  if (flags.hasLowOdds) activeFlags.push(`⚠ LOW-ODDS TRAP — user mentioned -${flags.lowOddsValue}. The implied probability is ${Math.round((flags.lowOddsValue! / (flags.lowOddsValue! + 100)) * 100)}% — question whether historical results actually support that.`);
  if (flags.hasRevengeNarrative) activeFlags.push("⚠ REVENGE GAME NARRATIVE — emotional bet. Push back. What's the actual statistical edge?");
  if (flags.hasHotStreakMention) activeFlags.push("⚠ RECENCY BIAS / HOT STREAK — demand schedule-strength context before validating.");

  const username = profile?.username ?? "this user";

  // Per-type/sport stat references for embedding in analysis
  const stats = computeDetailedStats(bets);
  const typeStatRef = stats.bestType
    ? (() => {
        const [t, v] = stats.bestType;
        const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
        const roi = v.staked > 0 ? ((v.returned - v.staked) / v.staked * 100).toFixed(1) : null;
        return `${username} is ${wr}% on ${t} bets${roi ? ` (+${roi}% ROI)` : ""} (${v.w}W-${v.l}L)`;
      })()
    : null;
  const sportStatRef = stats.bestSport
    ? (() => {
        const [s, v] = stats.bestSport;
        const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
        return `${username} is ${wr}% win rate in ${s} (${v.w}W-${v.l}L)`;
      })()
    : null;
  const worstSportRef = stats.worstSport && stats.worstSport[0] !== stats.bestSport?.[0]
    ? (() => {
        const [s, v] = stats.worstSport!;
        const wr = v.w + v.l > 0 ? Math.round((v.w / (v.w + v.l)) * 100) : 0;
        return `${username} is only ${wr}% in ${s} — caution`;
      })()
    : null;
  const bestTeamRef = stats.bestTeam
    ? (() => {
        const [team, v] = stats.bestTeam;
        const wr = Math.round((v.w / (v.w + v.l)) * 100);
        return `${username} is ${v.w}-${v.l} (${wr}%) on ${team}`;
      })()
    : null;
  const worstTeamRef = stats.worstTeam
    ? (() => {
        const [team, v] = stats.worstTeam!;
        const wr = Math.round((v.w / (v.w + v.l)) * 100);
        return `${username} is ${v.w}-${v.l} (${wr}%) on ${team} — historically bad spot`;
      })()
    : null;

  return `You are Engie — a sharp sports betting analyst and ${username}'s personal advisor who knows their history cold.

━━━ IDENTITY ━━━
You're not a generic chatbot. You know ${username}'s record, their patterns, their best and worst bets. Every response references their specific data — never generic advice.

━━━ THIS USER'S PERSONALITY TYPE: ${personality.type.toUpperCase()} ━━━
${personality.toneGuidance}

━━━ THIS USER'S STAT REFERENCES (quote these directly in your analysis) ━━━
${personality.styleSummary || "Not enough betting history yet — work from their open bets and general analysis."}
${typeStatRef ? `→ ${typeStatRef}` : ""}
${sportStatRef ? `→ ${sportStatRef}` : ""}
${worstSportRef ? `→ ${worstSportRef}` : ""}
${bestTeamRef ? `→ ${bestTeamRef}` : ""}
${worstTeamRef ? `→ ${worstTeamRef}` : ""}

MANDATORY: When analyzing any bet, reference the relevant stat above directly by name. Say "You're 12-5 on overs like this" not "historically this bet type performs well." Use their actual numbers.

━━━ CORE PERSONA ━━━
Confident but not arrogant. You're in their corner, which is exactly why you call out bad bets. Keep responses tight unless they ask for depth. No filler, no disclaimers. Never condescending.

━━━ DECISION-MAKING PROCESS (run every time someone asks about a bet) ━━━

STEP 1 — PARSE THE REQUEST
What team/game? What bet type (moneyline, spread, total, parlay)? What odds?

STEP 2 — EVALUATE EXPECTED VALUE
- Historical win rate → implied fair-value odds: if win% ≥ 50%: -(win%/(1-win%))*100; else: ((1-win%)/win%)*100
- Compare to what the book offers. State gap explicitly: "+EV by ~X pts" or "-EV, overpaying"
- If no historical data, use live odds implied probability as a baseline
${evContext ? `\nEV CONTEXT: ${evContext}` : ""}

STEP 2.5 — INJURY & NEWS CHECK (MANDATORY — do this before EVERY verdict)
Look at INJURY REPORTS & NEWS below. For each team in this bet:

a) KEY PLAYER STATUS — check every player listed as OUT, DOUBTFUL, or QUESTIONABLE
   Impact scale:
   - Star/starter OUT → significant edge shift; reduce base confidence by 10-20 percentage points
   - Starter DOUBTFUL → treat as likely out; note uncertainty
   - Starter QUESTIONABLE → flag it; recommend waiting for official pregame report
   - Role player out → minor adjustment; note it but don't overweight

b) RECENT NEWS — scan headlines for anything affecting tonight's game:
   - Back-to-back schedule (fatigue)
   - Travel (away team on 3rd city in 5 days, etc.)
   - Coach changes, lineup shifts, trade disruptions
   - Any reporting that contradicts the betting line

c) ADJUST CONFIDENCE EXPLICITLY — always show the adjustment:
   - "Confidence: 58% (adjusted down from 72% — LeBron James: OUT)"
   - "Confidence: 65% (unchanged — no significant injuries reported for either team)"
   - "Confidence: HOLD — [Player] is Questionable; wait for pregame status before locking in"

d) IF INJURY DATA IS MISSING — say so: "I don't have current injury info for [Player] — check ESPN or the team's injury report before placing this."

STEP 3 — TRAP DETECTION (check all 9)
Lead with: "Yo, [TRAP NAME] — [reason]. Pass." or "Lean at best."
1. PUBLIC TRAP — inflated by square money; sharps may be on the other side
2. RECENCY BIAS — team looks hot but schedule was soft; regression incoming
3. NAME RECOGNITION — betting a brand (Cowboys, Lakers) not a performance edge
4. REVENGE GAME — emotional narrative, no statistical backing
5. LINE MOVEMENT — line moved your way but sharp money went opposite
6. LOW-ODDS TRAP — anything -200 or shorter; juice kills long-term EV
7. PARLAY TRAP — handled by PARLAY PROTOCOL below
8. USER PATTERN TRAP — user consistently loses on this team/sport/type
9. LOSS CHASING — language signals they're trying to recover losses

STEP 4 — PERSONAL HISTORY CHECK
- Win rate on this bet type / team / sport? (see USER PATTERNS)
- Stake proportionate to bankroll? Suggested max: ~$${Math.round((profile?.bankroll ?? 500) * (profile?.kelly_fraction ?? 0.25) * 0.5)}
- Loss-chasing signals right now?

STEP 5 — DELIVER THE VERDICT
Format every bet analysis exactly like this:

**YES / NO / MAYBE** — [one sharp sentence]
Confidence: [X]% win estimate[(adjusted note if injuries affected it)]
Key factors: [bullet list — injuries, form, odds edge, traps]
[If odds available: "Best line: BookA +X | BookB +Y | BookC +Z"]
[If trap: "⚠ [TRAP]: [specific callout]"]
[If injury uncertainty: "Recommendation: wait for [Player] pregame status / reduce stake to $X"]

YES = clear +EV. NO = -EV or trapped. MAYBE = marginal edge or injury uncertainty pending.

━━━ PARLAY ANALYSIS PROTOCOL (activate when parlay flag is set) ━━━

STEP 1 — ENFORCE 2-LEG MAXIMUM
If more than 2 legs: "Nah. I only break down 2-leg parlays max — more legs stacks juice for the house. Which 2 do you believe in most?" Stop here until they narrow it down.

STEP 2 — ANALYZE EACH LEG INDIVIDUALLY
"Let me check each leg:

Leg 1: [Team] [Bet Type] [Odds]
[Historical form + EV check]
[Any traps?]
Verdict: YES ✓ / NO ✗

Leg 2: [Team] [Bet Type] [Odds]
[Same analysis]
Verdict: YES ✓ / NO ✗

Parlay: [APPROVED / REJECTED]"

STEP 3 — PARLAY VERDICT RULES
- APPROVED only if both legs are YES. "Both legs hold up. Solid parlay — keep the stake small, variance compounds. Max [half Kelly] on this."
- REJECTED if any leg fails. "Nah. Leg [X] is [problem] — can't fix a bad bet by combining it. [If the other leg passed: Take [team] straight if you believe in it.]"

STEP 4 — ADDITIONAL PARLAY CHECKS
- SAME-GAME PARLAY: correlated legs = reduced payout, worse value than it looks
- JUICE STACKING: each leg's vig multiplies — a -110/-110 2-teamer pays less than it appears
- LOW-ODDS LEG: if either leg is -200 or shorter — "That leg barely moves the combined odds but doubles your ways to lose. Hard pass."

Teams mentioned in this message: ${mentionedTeamNames.length ? mentionedTeamNames.join(" | ") : "none identified"}

━━━ ACTIVE FLAGS FOR THIS MESSAGE ━━━
${activeFlags.length ? activeFlags.join("\n") : "No traps or flags detected in this message."}

━━━ INJURY REPORTS & NEWS (from ESPN — real-time) ━━━
${injuryNewsData || "No injury/news data retrieved for the mentioned team(s). Tell the user to check ESPN before placing — injury status can flip a bet entirely."}

━━━ LIVE ODDS (from The Odds API — real-time) ━━━
${liveOddsData || "No live odds for the mentioned team(s). Direct user to the Games tab for current lines."}

━━━ HISTORICAL GAME DATA (from API-Sports) ━━━
${historicalData || "No historical data for this query. Work from live odds and AI picks below."}

━━━ USER CONTEXT ━━━
Name: ${username} | Bankroll: ${bankroll} | Kelly: ${kellyPct}% (${kellyLabel})
Overall: ${calcWinRate(bets.slice(0, 30))} win rate | ROI: ${calcROI(bets.slice(0, 30))}
Open bets: ${openBets.length}

${Object.entries(stats.bySport).filter(([, v]) => v.w + v.l >= 2).map(([s, v]) => {
  const wr = Math.round((v.w / (v.w + v.l)) * 100);
  const roi = v.staked > 0 ? ((v.returned - v.staked) / v.staked * 100).toFixed(1) : "?";
  return `${s}: ${wr}% (${v.w}W-${v.l}L, ${roi}% ROI)`;
}).join(" | ") || "No sport breakdown yet"}

${Object.entries(stats.byType).filter(([, v]) => v.w + v.l >= 2).map(([t, v]) => {
  const wr = Math.round((v.w / (v.w + v.l)) * 100);
  const roi = v.staked > 0 ? ((v.returned - v.staked) / v.staked * 100).toFixed(1) : "?";
  return `${t}: ${wr}% (${v.w}W-${v.l}L, ${roi}% ROI)`;
}).join(" | ") || "No type breakdown yet"}

OPEN BETS:
${openBetsText}

RECENT SETTLED (last 8):
${recentBetsText}

━━━ USER BETTING PATTERNS ━━━
${userPatterns}

━━━ TODAY'S AI PICKS (Engie's active recommendations) ━━━
${picksText}

━━━ HARD LIMITS ━━━
- Live odds and injury reports are provided above when available. If a section is empty, say so and direct to the Games tab / ESPN.
- Don't invent stats — say "I don't have that data" and point them where to look.
- Never guarantee outcomes. Even +EV bets lose. Variance is always real.
- Always run the injury check (Step 2.5) before delivering a verdict — no exceptions.`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth — optional (guests get picks context only, no personal data)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const messages: { role: string; content: string }[] = body.messages ?? [];
    const newChat: boolean = body.newChat ?? false;
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400, headers: corsHeaders });
    }

    // Analyse the latest user message for traps and team mentions
    const latestUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const flags = detectMessageFlags(latestUserMsg);
    const mentionedTeams = extractMentionedTeams(latestUserMsg, flags.hasParlay ? 2 : 1);
    const sportsApiKey = Deno.env.get("SPORTS_API_KEY");
    const oddsApiKey = Deno.env.get("ODDS_API_KEY");

    // Fetch all context in parallel
    const historicalFetches = sportsApiKey && mentionedTeams.length > 0
      ? mentionedTeams.map((t) => fetchTeamRecentGames(t, sportsApiKey, 5))
      : [Promise.resolve("")];

    const liveOddsFetches = oddsApiKey && mentionedTeams.length > 0
      ? mentionedTeams.map((t) => fetchLiveOddsForTeam(t, oddsApiKey))
      : [Promise.resolve("")];

    // ESPN injury + news fetches run for every mentioned team (no API key needed)
    const injuryNewsFetches = mentionedTeams.length > 0
      ? mentionedTeams.map((t) => fetchInjuryAndNews(t))
      : [Promise.resolve("")];

    const [profileResult, betsResult, picksResult, ...restParts] = await Promise.all([
      userId
        ? supabase.from("profiles").select("bankroll, kelly_fraction, username").eq("id", userId).single()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("bets").select("*").eq("user_id", userId).order("placed_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [] }),
      supabase.from("ai_picks").select("*").gt("expires_at", new Date().toISOString()).order("value_rating", { ascending: false }).limit(5),
      ...historicalFetches,
      ...liveOddsFetches,
      ...injuryNewsFetches,
    ]);

    // restParts = [...historicalResults, ...liveOddsResults, ...injuryNewsResults]
    const hLen = historicalFetches.length;
    const oLen = liveOddsFetches.length;
    const historicalRaw    = restParts.slice(0, hLen).filter(Boolean).join("\n\n");
    const liveOddsRaw      = restParts.slice(hLen, hLen + oLen).filter(Boolean).join("\n\n");
    const injuryNewsRaw    = restParts.slice(hLen + oLen).filter(Boolean).join("\n\n");

    const bets = betsResult.data ?? [];
    const userPatterns = analyzeUserPatterns(bets);
    const personality = detectPersonality(bets, profileResult.data);

    // Upsert user_patterns for future sessions / analytics
    if (userId) {
      const stats = computeDetailedStats(bets);
      const settled = bets.filter((b: any) => b.status === "won" || b.status === "lost");
      const won = settled.filter((b: any) => b.status === "won").length;
      const winRate = settled.length > 0 ? (won / settled.length) * 100 : null;
      const staked = settled.reduce((s: number, b: any) => s + b.stake, 0);
      const returned = settled.filter((b: any) => b.status === "won")
        .reduce((s: number, b: any) => s + b.potential_payout, 0);
      const roi = staked > 0 ? ((returned - staked) / staked) * 100 : null;

      await supabase.from("user_patterns").upsert({
        user_id: userId,
        personality: personality.type,
        total_settled: settled.length,
        win_rate_overall: winRate ? Math.round(winRate * 10) / 10 : null,
        roi_overall: roi ? Math.round(roi * 10) / 10 : null,
        best_sport: stats.bestSport?.[0] ?? null,
        best_bet_type: stats.bestType?.[0] ?? null,
        worst_sport: stats.worstSport?.[0] ?? null,
        worst_team: stats.worstTeam?.[0] ?? null,
        style_summary: personality.styleSummary,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    const systemPrompt = buildSystemPrompt(
      profileResult.data,
      bets,
      picksResult.data ?? [],
      historicalRaw,
      liveOddsRaw,
      injuryNewsRaw,
      userPatterns,
      flags,
      mentionedTeams.map((t) => t.fullName),
      personality
    );

    // Call Claude
    const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const reply = response.content[0];
    if (reply.type !== "text") throw new Error("Unexpected response type from Claude");

    // Persist conversation to DB (keep last 40 messages to cap storage)
    if (userId) {
      const fullHistory = [
        ...messages,
        { role: "assistant", content: reply.text },
      ].slice(-40);

      await supabase.from("conversations").upsert(
        {
          user_id: userId,
          messages: fullHistory,
          message_count: fullHistory.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    return new Response(
      JSON.stringify({
        reply: reply.text,
        personalityType: personality.type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("chat-agent error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

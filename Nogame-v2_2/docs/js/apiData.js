// ── API Data Layer ──────────────────────────────────────────────────────────
// Fetches real sports data from The Odds API via Supabase Edge Function proxy.
// Falls back to mock data if the API is unavailable.
//
// Architecture:
//   Browser → Supabase Edge Function (odds-proxy) → The Odds API
//   The API key never leaves the server.
//
// Quota management:
//   - The Odds API free tier = 500 requests/month
//   - Edge function caches responses (scores: 60s, odds: 120s, sports: 1hr)
//   - Browser-side cache prevents redundant calls on tab switches / re-renders
//   - Only fetch odds for the sport the user is currently viewing

// ── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://axlybeznzibovvqkllzq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dN_eqVSKcdgwZCb1QEyHkA_vnmF7qS0';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/odds-proxy`;

// ── Sport key mapping (The Odds API sport keys) ─────────────────────────────

export const SPORT_KEYS = {
  nfl:        'americanfootball_nfl',
  ncaaf:      'americanfootball_ncaaf',
  nba:        'basketball_nba',
  ncaab:      'basketball_ncaab',
  wnba:       'basketball_wnba',
  mlb:        'baseball_mlb',
  nhl:        'icehockey_nhl',
  soccer:     'soccer_usa_mls',
  epl:        'soccer_epl',
  laliga:     'soccer_spain_la_liga',
  seriea:     'soccer_italy_serie_a',
  bundesliga: 'soccer_germany_bundesliga',
  ligue1:     'soccer_france_ligue_one',
  mma:        'mma_mixed_martial_arts',
  tennis:     'tennis_atp_french_open',
  golf:       'golf_pga_championship',
  boxing:     'boxing_boxing',
};

// Map our internal sport IDs to arrays of Odds API sport keys to fetch
export const SPORT_GROUPS = {
  nfl:    ['americanfootball_nfl'],
  nba:    ['basketball_nba'],
  mlb:    ['baseball_mlb'],
  nhl:    ['icehockey_nhl'],
  ncaaf:  ['americanfootball_ncaaf'],
  ncaab:  ['basketball_ncaab'],
  soccer: ['soccer_usa_mls', 'soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a', 'soccer_germany_bundesliga', 'soccer_france_ligue_one'],
  tennis: ['tennis_atp_french_open', 'tennis_atp_wimbledon', 'tennis_wta_french_open'],
  mma:    ['mma_mixed_martial_arts'],
  golf:   ['golf_pga_championship', 'golf_masters_tournament'],
  boxing: ['boxing_boxing'],
};

// ── Browser-side cache ──────────────────────────────────────────────────────

const _cache = new Map();
const BROWSER_CACHE_TTL = {
  sports:  600000,   // 10 minutes
  scores:  30000,    // 30 seconds
  odds:    60000,    // 1 minute
  events:  120000,   // 2 minutes
};

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  _cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ── Core fetch function ─────────────────────────────────────────────────────

async function fetchFromProxy(endpoint, params = '') {
  const url = `${EDGE_FUNCTION_URL}?endpoint=${encodeURIComponent(endpoint)}&params=${encodeURIComponent(params)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  // Log quota usage for monitoring
  const remaining = response.headers.get('X-Requests-Remaining');
  const used = response.headers.get('X-Requests-Used');
  const cacheHit = response.headers.get('X-Cache');
  if (remaining) {
    console.log(`[Odds API] Quota: ${used} used, ${remaining} remaining | Cache: ${cacheHit}`);
  }

  return response.json();
}

// ── Public API functions ────────────────────────────────────────────────────

/**
 * Get list of available sports from The Odds API
 * Free endpoint — doesn't count against quota
 */
export async function fetchSports() {
  const cacheKey = 'sports';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchFromProxy('sports');
    // Filter to active sports only
    const active = data.filter(s => s.active);
    setCache(cacheKey, active, BROWSER_CACHE_TTL.sports);
    return active;
  } catch (err) {
    console.warn('[API] fetchSports failed, using fallback:', err.message);
    return [];
  }
}

/**
 * Get live scores for a sport
 * Cost: 1 request per sport
 * @param {string} sportKey — The Odds API sport key (e.g., 'baseball_mlb')
 * @param {number} daysFrom — How many days back to include completed games (1-3)
 */
export async function fetchScores(sportKey, daysFrom = 1) {
  const cacheKey = `scores:${sportKey}:${daysFrom}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = `daysFrom=${daysFrom}&dateFormat=iso`;
    const data = await fetchFromProxy(`sports/${sportKey}/scores`, params);
    setCache(cacheKey, data, BROWSER_CACHE_TTL.scores);
    return data;
  } catch (err) {
    console.warn(`[API] fetchScores(${sportKey}) failed:`, err.message);
    return [];
  }
}

/**
 * Get odds for a sport (moneyline, spreads, totals)
 * Cost: depends on markets × regions (typically 1-3 per call)
 * @param {string} sportKey — The Odds API sport key
 * @param {string} markets — Comma-separated markets (default: h2h,spreads,totals)
 * @param {string} regions — Bookmaker regions (default: us,us2)
 */
export async function fetchOdds(sportKey, markets = 'h2h,spreads,totals', regions = 'us,us2') {
  const cacheKey = `odds:${sportKey}:${markets}:${regions}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = `regions=${regions}&markets=${markets}&oddsFormat=american&dateFormat=iso`;
    const data = await fetchFromProxy(`sports/${sportKey}/odds`, params);
    setCache(cacheKey, data, BROWSER_CACHE_TTL.odds);
    return data;
  } catch (err) {
    console.warn(`[API] fetchOdds(${sportKey}) failed:`, err.message);
    return [];
  }
}

/**
 * Get event list for a sport (free — doesn't count against quota)
 * @param {string} sportKey — The Odds API sport key
 */
export async function fetchEvents(sportKey) {
  const cacheKey = `events:${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = 'dateFormat=iso';
    const data = await fetchFromProxy(`sports/${sportKey}/events`, params);
    setCache(cacheKey, data, BROWSER_CACHE_TTL.events);
    return data;
  } catch (err) {
    console.warn(`[API] fetchEvents(${sportKey}) failed:`, err.message);
    return [];
  }
}

/**
 * Get odds for a specific event (more markets available)
 * Cost: depends on markets × regions
 * @param {string} sportKey — The Odds API sport key
 * @param {string} eventId — The event ID
 * @param {string} markets — Comma-separated markets
 */
export async function fetchEventOdds(sportKey, eventId, markets = 'h2h,spreads,totals') {
  const cacheKey = `event-odds:${eventId}:${markets}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = `regions=us,us2&markets=${markets}&oddsFormat=american&dateFormat=iso`;
    const data = await fetchFromProxy(`sports/${sportKey}/events/${eventId}/odds`, params);
    setCache(cacheKey, data, BROWSER_CACHE_TTL.odds);
    return data;
  } catch (err) {
    console.warn(`[API] fetchEventOdds(${eventId}) failed:`, err.message);
    return null;
  }
}


// ── Data transformation ─────────────────────────────────────────────────────
// Transform The Odds API response into our internal format used by the UI

/**
 * Resolve our internal sport ID to Odds API sport keys
 * @param {string} sportId — Our internal sport ID (e.g., 'nba', 'mlb', 'all')
 * @returns {string[]} — Array of Odds API sport keys
 */
export function getSportKeys(sportId) {
  if (sportId === 'all') {
    // For "All Sports", only fetch the most popular to conserve quota
    return [
      'americanfootball_nfl',
      'basketball_nba',
      'baseball_mlb',
      'icehockey_nhl',
      'basketball_ncaab',
      'soccer_epl',
      'soccer_usa_mls',
    ];
  }
  return SPORT_GROUPS[sportId] || [];
}

/**
 * Map an Odds API sport key back to our internal sport ID
 */
export function sportKeyToId(sportKey) {
  for (const [id, keys] of Object.entries(SPORT_GROUPS)) {
    if (keys.includes(sportKey)) return id;
  }
  // Try to infer from the key
  if (sportKey.startsWith('americanfootball_nfl')) return 'nfl';
  if (sportKey.startsWith('basketball_nba')) return 'nba';
  if (sportKey.startsWith('baseball_mlb')) return 'mlb';
  if (sportKey.startsWith('icehockey_nhl')) return 'nhl';
  if (sportKey.startsWith('soccer_')) return 'soccer';
  if (sportKey.startsWith('mma_')) return 'mma';
  if (sportKey.startsWith('tennis_')) return 'tennis';
  if (sportKey.startsWith('golf_')) return 'golf';
  if (sportKey.startsWith('boxing_')) return 'boxing';
  return 'other';
}

/**
 * Get a human-readable league name from an Odds API sport key
 */
export function sportKeyToLeagueName(sportKey) {
  const map = {
    'americanfootball_nfl':      'NFL',
    'americanfootball_ncaaf':    'NCAA Football',
    'basketball_nba':            'NBA',
    'basketball_ncaab':          'NCAA Basketball',
    'basketball_wnba':           'WNBA',
    'baseball_mlb':              'MLB',
    'icehockey_nhl':             'NHL',
    'soccer_usa_mls':            'MLS',
    'soccer_epl':                'Premier League',
    'soccer_spain_la_liga':      'La Liga',
    'soccer_italy_serie_a':      'Serie A',
    'soccer_germany_bundesliga': 'Bundesliga',
    'soccer_france_ligue_one':   'Ligue 1',
    'mma_mixed_martial_arts':    'MMA',
    'tennis_atp_french_open':    'ATP French Open',
    'tennis_atp_wimbledon':      'ATP Wimbledon',
    'tennis_wta_french_open':    'WTA French Open',
    'golf_pga_championship':     'PGA Championship',
    'golf_masters_tournament':   'Masters',
    'boxing_boxing':             'Boxing',
  };
  return map[sportKey] || sportKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get the country for a sport key (for league headers)
 */
export function sportKeyToCountry(sportKey) {
  if (sportKey.startsWith('americanfootball_') || sportKey.startsWith('basketball_') || 
      sportKey.startsWith('baseball_') || sportKey.startsWith('icehockey_') ||
      sportKey === 'soccer_usa_mls') return 'USA';
  if (sportKey === 'soccer_epl') return 'ENGLAND';
  if (sportKey === 'soccer_spain_la_liga') return 'SPAIN';
  if (sportKey === 'soccer_italy_serie_a') return 'ITALY';
  if (sportKey === 'soccer_germany_bundesliga') return 'GERMANY';
  if (sportKey === 'soccer_france_ligue_one') return 'FRANCE';
  return 'INTERNATIONAL';
}

/**
 * Transform Odds API game data into our internal Game format
 * @param {Object} apiGame — Raw game from The Odds API
 * @param {string} sportKey — The sport key this game belongs to
 * @returns {Object} — Game in our internal format
 */
export function transformGame(apiGame, sportKey) {
  const now = new Date();
  const commence = new Date(apiGame.commence_time);
  const isLive = apiGame.completed === false && commence <= now;
  const isCompleted = apiGame.completed === true;

  let status = 'scheduled';
  if (isCompleted) status = 'final';
  else if (isLive) status = 'live';

  // Extract scores if available
  let homeScore = null;
  let awayScore = null;
  if (apiGame.scores) {
    for (const s of apiGame.scores) {
      if (s.name === apiGame.home_team) homeScore = parseInt(s.score, 10);
      if (s.name === apiGame.away_team) awayScore = parseInt(s.score, 10);
    }
  }

  return {
    id: apiGame.id,
    sportId: sportKeyToId(sportKey),
    sportKey: sportKey,
    leagueId: sportKey,
    leagueName: sportKeyToLeagueName(sportKey),
    country: sportKeyToCountry(sportKey),
    homeTeam: {
      name: apiGame.home_team,
      abbr: abbreviateTeam(apiGame.home_team),
    },
    awayTeam: {
      name: apiGame.away_team,
      abbr: abbreviateTeam(apiGame.away_team),
    },
    startTime: apiGame.commence_time,
    status,
    homeScore,
    awayScore,
    clock: null,        // Odds API doesn't provide game clock
    period: null,       // Odds API doesn't provide period info
    hasOdds: false,     // Will be set to true when odds are loaded
    venue: '',
    last_update: apiGame.last_update || null,
  };
}

/**
 * Transform Odds API odds data into our internal OddsMarket format
 * @param {Object} apiGame — Raw game from The Odds API /odds endpoint
 * @returns {Object[]} — Array of OddsMarket objects
 */
export function transformOdds(apiGame) {
  if (!apiGame.bookmakers || apiGame.bookmakers.length === 0) return [];
  
  const markets = [];

  for (const bookmaker of apiGame.bookmakers) {
    const bookId = normalizeBookmakerId(bookmaker.key);
    
    for (const market of bookmaker.markets) {
      const marketType = normalizeMarketType(market.key);
      if (!marketType) continue;

      for (const outcome of market.outcomes) {
        const selection = normalizeSelection(outcome.name, apiGame.home_team, apiGame.away_team, marketType);
        if (!selection) continue;

        markets.push({
          gameId: apiGame.id,
          sportsbookId: bookId,
          sportsbookName: bookmaker.title,
          marketType,
          selection,
          line: outcome.point ?? null,
          oddsAmerican: outcome.price,
          updatedAt: market.last_update || bookmaker.last_update || new Date().toISOString(),
        });
      }
    }
  }

  return markets;
}

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Create a short abbreviation from a team name
 */
function abbreviateTeam(name) {
  if (!name) return '???';
  // Common abbreviations
  const abbrs = {
    // NFL
    'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
    'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
    'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
    'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
    'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
    'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
    'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
    'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
    'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
    'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
    'Tennessee Titans': 'TEN', 'Washington Commanders': 'WSH',
    // NBA
    'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
    'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
    'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC',
    'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
    'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS',
    'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
    // MLB
    'Arizona Diamondbacks': 'ARI', 'Atlanta Braves': 'ATL', 'Baltimore Orioles': 'BAL',
    'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
    'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL',
    'Detroit Tigers': 'DET', 'Houston Astros': 'HOU', 'Kansas City Royals': 'KC',
    'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD', 'Miami Marlins': 'MIA',
    'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
    'New York Yankees': 'NYY', 'Oakland Athletics': 'OAK', 'Philadelphia Phillies': 'PHI',
    'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SF',
    'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
    'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH',
    // NHL
    'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF',
    'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI',
    'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL',
    'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA',
    'Los Angeles Kings': 'LAK', 'Minnesota Wild': 'MIN', 'Montreal Canadiens': 'MTL',
    'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJD', 'New York Islanders': 'NYI',
    'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI',
    'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJS', 'Seattle Kraken': 'SEA',
    'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TBL', 'Toronto Maple Leafs': 'TOR',
    'Utah Hockey Club': 'UTA', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK',
    'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG',
  };

  if (abbrs[name]) return abbrs[name];

  // Fallback: first 3 characters of last word
  const words = name.split(' ');
  return words[words.length - 1].substring(0, 3).toUpperCase();
}

/**
 * Normalize bookmaker key from The Odds API to our internal ID
 */
function normalizeBookmakerId(key) {
  const map = {
    'draftkings':     'dk',
    'fanduel':        'fd',
    'betmgm':         'mgm',
    'williamhill_us': 'czr',     // Caesars was formerly William Hill
    'caesars':        'czr',
    'espnbet':        'espn',
    'fanatics':       'fan',
    'bet365':         'b365',
    'betrivers':      'br',
    'hardrockbet':    'hr',
    'ballybet':       'bally',
    'pointsbetus':    'pbu',
    'bovada':         'bov',
    'betonlineag':    'bol',
    'lowvig':         'lv',
    'mybookieag':     'myb',
    'superbook':      'sb',
    'twinspires':     'ts',
    'unibet_us':      'uni',
    'wynnbet':        'wynn',
    'betparx':        'bpx',
    'fliff':          'flf',
    'windcreek':      'wc',
  };
  return map[key] || key;
}

/**
 * Normalize market type from The Odds API
 */
function normalizeMarketType(key) {
  const map = {
    'h2h':      'moneyline',
    'spreads':  'spread',
    'totals':   'total',
  };
  return map[key] || null; // Only support these 3 for now
}

/**
 * Normalize selection name
 */
function normalizeSelection(outcomeName, homeTeam, awayTeam, marketType) {
  if (marketType === 'total') {
    if (outcomeName === 'Over') return 'over';
    if (outcomeName === 'Under') return 'under';
    return null;
  }
  if (outcomeName === homeTeam) return 'home';
  if (outcomeName === awayTeam) return 'away';
  // Draw in soccer
  if (outcomeName === 'Draw') return 'draw';
  return null;
}

// ── High-level data fetching functions ───────────────────────────────────────
// These are the main functions called by the UI

/**
 * Fetch all games (scores + odds) for a given sport selection
 * This is the main entry point for the game feed.
 *
 * @param {string} sportId — Our internal sport ID ('all', 'nba', 'mlb', etc.)
 * @returns {{ games: Object[], odds: Map<string, Object[]> }}
 */
export async function fetchGamesAndOdds(sportId) {
  const sportKeys = getSportKeys(sportId);
  if (sportKeys.length === 0) return { games: [], odds: new Map() };

  // Fetch scores and odds in parallel for each sport key
  const results = await Promise.allSettled(
    sportKeys.map(async (key) => {
      // Fetch odds endpoint (includes game info + odds — most efficient)
      const oddsData = await fetchOdds(key);
      // Fetch scores for live/completed data
      const scoresData = await fetchScores(key, 1);
      return { key, oddsData, scoresData };
    })
  );

  const allGames = new Map(); // gameId → Game
  const allOdds = new Map();  // gameId → OddsMarket[]

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { key, oddsData, scoresData } = result.value;

    // Process scores first (has live status + scores)
    for (const scoreGame of scoresData) {
      const game = transformGame(scoreGame, key);
      allGames.set(game.id, game);
    }

    // Process odds data (has odds + game info)
    for (const oddsGame of oddsData) {
      const gameId = oddsGame.id;

      // Merge with existing game data from scores
      if (allGames.has(gameId)) {
        const existing = allGames.get(gameId);
        existing.hasOdds = true;
      } else {
        const game = transformGame(oddsGame, key);
        game.hasOdds = true;
        allGames.set(gameId, game);
      }

      // Transform odds
      const odds = transformOdds(oddsGame);
      if (odds.length > 0) {
        allOdds.set(gameId, odds);
      }
    }
  }

  // Sort games: live first, then by start time
  const games = [...allGames.values()].sort((a, b) => {
    const statusOrder = { live: 0, halftime: 0, scheduled: 1, final: 2 };
    const oa = statusOrder[a.status] ?? 9;
    const ob = statusOrder[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  return { games, odds: allOdds };
}

/**
 * Fetch detailed odds for a specific game
 * @param {string} sportKey — The Odds API sport key
 * @param {string} eventId — The game/event ID
 * @returns {Object[]} — Array of OddsMarket objects
 */
export async function fetchGameOdds(sportKey, eventId) {
  const data = await fetchEventOdds(sportKey, eventId);
  if (!data) return [];
  return transformOdds(data);
}

// ── Quota monitoring ────────────────────────────────────────────────────────

/**
 * Get estimated API quota usage
 * Call this to monitor how many requests have been used
 */
export function getQuotaEstimate() {
  // This is just a client-side estimate based on cache misses
  // Real quota is tracked by the Edge Function headers
  return {
    cacheSize: _cache.size,
    cacheEntries: [..._cache.keys()],
  };
}

/**
 * Clear all cached data (forces fresh fetch on next request)
 */
export function clearCache() {
  _cache.clear();
  console.log('[API] Cache cleared');
}

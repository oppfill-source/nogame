// ── Mock data layer ─────────────────────────────────────────────────────────
// Shaped to match the API contract documented in the project brief:
//   Sport, League, Team, Game, Sportsbook, OddsMarket
//
// All times are ISO-8601 strings. The data layer below is deterministic
// (seeded by date offset) so the UI looks alive across reloads without
// needing a real backend yet. Replace `getGames()` etc. with real API calls;
// the shapes are stable.

import { SPORTSBOOKS } from './sportsbooks.js';

// ── Sports ──────────────────────────────────────────────────────────────────
export const SPORTS = [
  { id: 'nfl',     name: 'NFL',         slug: 'nfl',        icon: '🏈', group: 'us' },
  { id: 'nba',     name: 'NBA',         slug: 'nba',        icon: '🏀', group: 'us' },
  { id: 'mlb',     name: 'MLB',         slug: 'mlb',        icon: '⚾', group: 'us' },
  { id: 'nhl',     name: 'NHL',         slug: 'nhl',        icon: '🏒', group: 'us' },
  { id: 'ncaaf',   name: 'NCAAF',       slug: 'ncaaf',      icon: '🏈', group: 'us' },
  { id: 'ncaab',   name: 'NCAAB',       slug: 'ncaab',      icon: '🏀', group: 'us' },
  { id: 'soccer',  name: 'Soccer',      slug: 'soccer',     icon: '⚽', group: 'intl' },
  { id: 'tennis',  name: 'Tennis',      slug: 'tennis',     icon: '🎾', group: 'intl' },
  { id: 'mma',     name: 'MMA',         slug: 'mma',        icon: '🥊', group: 'combat' },
  { id: 'golf',    name: 'Golf',        slug: 'golf',       icon: '⛳', group: 'intl' },
  { id: 'box',     name: 'Boxing',      slug: 'boxing',     icon: '🥊', group: 'combat' },
  { id: 'motor',   name: 'Motorsports', slug: 'motorsports',icon: '🏁', group: 'intl' },
];

// ── Leagues ─────────────────────────────────────────────────────────────────
export const LEAGUES = [
  { id: 'nfl',         sportId: 'nfl',     name: 'NFL',                country: 'USA',   season: '2025-26' },
  { id: 'nba',         sportId: 'nba',     name: 'NBA',                country: 'USA',   season: '2025-26' },
  { id: 'mlb',         sportId: 'mlb',     name: 'MLB',                country: 'USA',   season: '2026'    },
  { id: 'nhl',         sportId: 'nhl',     name: 'NHL',                country: 'USA',   season: '2025-26' },
  { id: 'ncaaf',       sportId: 'ncaaf',   name: 'NCAA Football',      country: 'USA',   season: '2025'    },
  { id: 'ncaab-m',     sportId: 'ncaab',   name: 'NCAA Men\'s Basketball', country: 'USA', season: '2025-26' },
  { id: 'fifa-wc',     sportId: 'soccer',  name: 'World Cup',          country: 'Intl',  season: '2026'    },
  { id: 'epl',         sportId: 'soccer',  name: 'Premier League',     country: 'England', season: '2025-26' },
  { id: 'laliga',      sportId: 'soccer',  name: 'La Liga',            country: 'Spain', season: '2025-26' },
  { id: 'ucl',         sportId: 'soccer',  name: 'Champions League',   country: 'Europe',season: '2025-26' },
  { id: 'mls',         sportId: 'soccer',  name: 'MLS',                country: 'USA',   season: '2026'    },
  { id: 'atp',         sportId: 'tennis',  name: 'ATP Tour',           country: 'Intl',  season: '2026'    },
  { id: 'ufc',         sportId: 'mma',     name: 'UFC',                country: 'Intl',  season: '2026'    },
  { id: 'pga',         sportId: 'golf',    name: 'PGA Tour',           country: 'USA',   season: '2026'    },
];

const LEAGUES_BY_ID = LEAGUES.reduce(function(acc, l) { acc[l.id] = l; return acc; }, {});

// ── Teams (compact subset; production data would ship from API) ─────────────
export const TEAMS = [
  // NFL
  { id:'kc',   leagueId:'nfl',    name:'Kansas City Chiefs',   abbr:'KC',  city:'Kansas City' },
  { id:'phi',  leagueId:'nfl',    name:'Philadelphia Eagles',  abbr:'PHI', city:'Philadelphia' },
  { id:'sf',   leagueId:'nfl',    name:'San Francisco 49ers',  abbr:'SF',  city:'San Francisco' },
  { id:'buf',  leagueId:'nfl',    name:'Buffalo Bills',        abbr:'BUF', city:'Buffalo' },
  { id:'bal',  leagueId:'nfl',    name:'Baltimore Ravens',     abbr:'BAL', city:'Baltimore' },
  { id:'dal',  leagueId:'nfl',    name:'Dallas Cowboys',       abbr:'DAL', city:'Dallas' },

  // NBA
  { id:'bos',  leagueId:'nba',    name:'Boston Celtics',       abbr:'BOS', city:'Boston' },
  { id:'lal',  leagueId:'nba',    name:'Los Angeles Lakers',   abbr:'LAL', city:'Los Angeles' },
  { id:'gsw',  leagueId:'nba',    name:'Golden State Warriors',abbr:'GSW', city:'San Francisco' },
  { id:'mil',  leagueId:'nba',    name:'Milwaukee Bucks',      abbr:'MIL', city:'Milwaukee' },
  { id:'den',  leagueId:'nba',    name:'Denver Nuggets',       abbr:'DEN', city:'Denver' },
  { id:'mia',  leagueId:'nba',    name:'Miami Heat',           abbr:'MIA', city:'Miami' },

  // MLB
  { id:'lad',  leagueId:'mlb',    name:'Los Angeles Dodgers',  abbr:'LAD', city:'Los Angeles' },
  { id:'nyy',  leagueId:'mlb',    name:'New York Yankees',     abbr:'NYY', city:'New York' },
  { id:'hou',  leagueId:'mlb',    name:'Houston Astros',       abbr:'HOU', city:'Houston' },
  { id:'atl',  leagueId:'mlb',    name:'Atlanta Braves',       abbr:'ATL', city:'Atlanta' },

  // NHL
  { id:'edm',  leagueId:'nhl',    name:'Edmonton Oilers',      abbr:'EDM', city:'Edmonton' },
  { id:'col',  leagueId:'nhl',    name:'Colorado Avalanche',   abbr:'COL', city:'Denver' },
  { id:'tor',  leagueId:'nhl',    name:'Toronto Maple Leafs',  abbr:'TOR', city:'Toronto' },
  { id:'fla',  leagueId:'nhl',    name:'Florida Panthers',     abbr:'FLA', city:'Sunrise' },

  // NCAAF
  { id:'uga',  leagueId:'ncaaf',  name:'Georgia Bulldogs',     abbr:'UGA', city:'Athens' },
  { id:'ala',  leagueId:'ncaaf',  name:'Alabama Crimson Tide', abbr:'ALA', city:'Tuscaloosa' },

  // NCAAB
  { id:'duke', leagueId:'ncaab-m',name:'Duke Blue Devils',     abbr:'DUKE', city:'Durham' },
  { id:'unc',  leagueId:'ncaab-m',name:'North Carolina',       abbr:'UNC',  city:'Chapel Hill' },
  { id:'kan',  leagueId:'ncaab-m',name:'Kansas Jayhawks',      abbr:'KAN',  city:'Lawrence' },
  { id:'pur',  leagueId:'ncaab-m',name:'Purdue Boilermakers',  abbr:'PUR',  city:'West Lafayette' },

  // EPL
  { id:'ars',  leagueId:'epl',    name:'Arsenal',              abbr:'ARS', city:'London' },
  { id:'liv',  leagueId:'epl',    name:'Liverpool',            abbr:'LIV', city:'Liverpool' },
  { id:'mci',  leagueId:'epl',    name:'Manchester City',      abbr:'MCI', city:'Manchester' },
  { id:'che',  leagueId:'epl',    name:'Chelsea',              abbr:'CHE', city:'London' },

  // La Liga
  { id:'rma',  leagueId:'laliga', name:'Real Madrid',          abbr:'RMA', city:'Madrid' },
  { id:'bar',  leagueId:'laliga', name:'Barcelona',            abbr:'BAR', city:'Barcelona' },

  // UCL
  { id:'psg',  leagueId:'ucl',    name:'Paris Saint-Germain',  abbr:'PSG', city:'Paris' },
  { id:'bay',  leagueId:'ucl',    name:'Bayern München',       abbr:'BAY', city:'Munich' },
];

const TEAMS_BY_ID = TEAMS.reduce(function(acc, t) { acc[t.id] = t; return acc; }, {});

// ── Deterministic mock-game generator ───────────────────────────────────────
// Same input (date offset) → same output. Live games tick via Date.now()
// inside the renderer, not here.

function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFromSeed(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function intBetween(rng, lo, hi) { return Math.floor(rng() * (hi - lo + 1)) + lo; }

// Schedule template — which leagues play on which day-of-week (rough approximation).
// Used only to make the mock feed feel realistic.
const LEAGUE_SCHEDULE = {
  nfl:    { days: [0, 1, 4],     gamesPerDay: 4 },  // Sun/Mon/Thu
  nba:    { days: [1, 2, 3, 4, 5, 6], gamesPerDay: 6 },
  mlb:    { days: [0, 1, 2, 3, 4, 5, 6], gamesPerDay: 8 },
  nhl:    { days: [1, 2, 3, 4, 5, 6], gamesPerDay: 5 },
  ncaaf:  { days: [5, 6],        gamesPerDay: 4 },
  'ncaab-m': { days: [1, 2, 3, 4, 5, 6], gamesPerDay: 6 },
  epl:    { days: [0, 6],        gamesPerDay: 4 },
  laliga: { days: [0, 5, 6],     gamesPerDay: 3 },
  ucl:    { days: [2, 3],        gamesPerDay: 4 },
  mls:    { days: [3, 6],        gamesPerDay: 3 },
};

// Status weights — most games are "scheduled" for far-future dates,
// mostly "final" for past dates, mixed for today.
function pickStatus(rng, dayOffset) {
  if (dayOffset < 0) return 'final';
  if (dayOffset > 0) return 'scheduled';
  // Today: spread across statuses — roughly a 1/4 each but skewed toward
  // live/scheduled to make the feed feel alive without being unrealistic.
  const r = rng();
  if (r < 0.30) return 'live';
  if (r < 0.40) return 'halftime';
  if (r < 0.60) return 'final';
  return 'scheduled';
}

function teamsForLeague(leagueId) {
  return TEAMS.filter(t => t.leagueId === leagueId);
}

/**
 * Generate the deterministic game list for the date `dayOffset` days from
 * today. Returns Game[] shaped per the API contract.
 */
function generateGamesForOffset(dayOffset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  const dow = date.getDay();
  const dateKey = date.toISOString().slice(0, 10);

  const games = [];
  for (const league of LEAGUES) {
    const schedule = LEAGUE_SCHEDULE[league.id];
    if (!schedule) continue;
    if (!schedule.days.includes(dow)) continue;

    const pool = teamsForLeague(league.id);
    if (pool.length < 2) continue;

    const seed = seedFromString(`${dateKey}::${league.id}`);
    const rng = rngFromSeed(seed);
    const usedTeams = new Set();
    const numGames = Math.min(schedule.gamesPerDay, Math.floor(pool.length / 2));

    for (let i = 0; i < numGames; i++) {
      const available = pool.filter(t => !usedTeams.has(t.id));
      if (available.length < 2) break;
      const home = pick(rng, available);
      usedTeams.add(home.id);
      const remaining = available.filter(t => t.id !== home.id);
      const away = pick(rng, remaining);
      usedTeams.add(away.id);

      const startHour = intBetween(rng, 12, 22);
      const startMinute = pick(rng, [0, 15, 30, 45]);
      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);

      const status = pickStatus(rng, dayOffset);
      const game = {
        id: `${league.id}-${dateKey}-${i}`,
        sportId: league.sportId,
        leagueId: league.id,
        homeTeam: home,
        awayTeam: away,
        startTime: startTime.toISOString(),
        status,
        clock: null,
        period: null,
        homeScore: null,
        awayScore: null,
        venue: `${home.city} Arena`,
        hasOdds: rng() > 0.05,
      };

      // Fill in score / period based on status
      if (status === 'final') {
        game.homeScore = scoreFor(league.sportId, rng);
        game.awayScore = scoreFor(league.sportId, rng);
        game.period = finalPeriodLabel(league.sportId);
      } else if (status === 'halftime') {
        game.homeScore = Math.floor(scoreFor(league.sportId, rng) / 2);
        game.awayScore = Math.floor(scoreFor(league.sportId, rng) / 2);
        game.period = halftimeLabel(league.sportId);
        game.clock = '—';
      } else if (status === 'live') {
        game.homeScore = Math.floor(scoreFor(league.sportId, rng) * (0.4 + rng() * 0.5));
        game.awayScore = Math.floor(scoreFor(league.sportId, rng) * (0.4 + rng() * 0.5));
        game.period = livePeriodLabel(league.sportId, rng);
        game.clock = liveClock(league.sportId, rng);
      }

      games.push(game);
    }
  }
  return games;
}

function scoreFor(sportId, rng) {
  switch (sportId) {
    case 'nfl':    return intBetween(rng, 13, 38);
    case 'ncaaf':  return intBetween(rng, 14, 45);
    case 'nba':    return intBetween(rng, 95, 130);
    case 'ncaab':  return intBetween(rng, 60, 90);
    case 'mlb':    return intBetween(rng, 0, 9);
    case 'nhl':    return intBetween(rng, 1, 6);
    case 'soccer': return intBetween(rng, 0, 4);
    default:       return intBetween(rng, 0, 5);
  }
}

function finalPeriodLabel(sportId) {
  if (sportId === 'mlb') return 'Final';
  return 'Final';
}
function halftimeLabel(sportId) {
  if (sportId === 'mlb' || sportId === 'nhl') return 'Intermission';
  return 'Halftime';
}
function livePeriodLabel(sportId, rng) {
  switch (sportId) {
    case 'nfl':
    case 'ncaaf':
    case 'nba':
    case 'ncaab':  return `Q${intBetween(rng, 1, 4)}`;
    case 'mlb':    return `${pick(rng, ['Top','Bot'])} ${intBetween(rng, 1, 9)}`;
    case 'nhl':    return `P${intBetween(rng, 1, 3)}`;
    case 'soccer': return `${intBetween(rng, 5, 88)}'`;
    default:       return 'Live';
  }
}
function liveClock(sportId, rng) {
  if (sportId === 'mlb' || sportId === 'soccer') return null;
  const min = intBetween(rng, 0, 14);
  const sec = intBetween(rng, 0, 59);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

// ── Odds generator (deterministic per game) ─────────────────────────────────

function generateOddsForGame(game) {
  if (!game.hasOdds) return [];
  const seed = seedFromString(`${game.id}::odds`);
  const rng = rngFromSeed(seed);
  const odds = [];
  const updatedAt = new Date(Date.now() - intBetween(rng, 30, 600) * 1000).toISOString();

  // Establish a "true" market the books vary slightly around.
  // ML based on a notional home-favorite probability. Soccer is a 3-way
  // market (home / draw / away), so it also gets a draw line.
  const isSoccer = game.sportId === 'soccer';
  let homeProb, baseHomeML, baseAwayML, baseDrawML = null;
  if (isSoccer) {
    const drawProb  = 0.24 + rng() * 0.08;   // ~0.24–0.32
    const homeShare = 0.35 + rng() * 0.40;   // home's share of the decisive (non-draw) result
    const rest      = 1 - drawProb;
    baseHomeML = probToAmerican(rest * homeShare + 0.03);        // +~3% vig per line
    baseAwayML = probToAmerican(rest * (1 - homeShare) + 0.03);
    baseDrawML = probToAmerican(drawProb + 0.03);
    homeProb   = homeShare;                  // notional favouritism for the spread line
  } else {
    homeProb   = 0.35 + rng() * 0.3;         // 0.35–0.65
    baseHomeML = probToAmerican(homeProb);
    baseAwayML = probToAmerican(1 - homeProb - 0.04); // small vig
  }

  // Spread: integer/half centered on the implied edge
  const baseSpread = Math.round((americanFavToSpread(homeProb)) * 2) / 2;

  // Total: sport-dependent
  const baseTotal = baseTotalForSport(game.sportId, rng);

  for (const book of SPORTSBOOKS) {
    const mlJitter = () => intBetween(rng, -8, 8);
    odds.push(makeOdd(game, book, 'moneyline', 'home', null, baseHomeML + mlJitter(), updatedAt));
    odds.push(makeOdd(game, book, 'moneyline', 'away', null, baseAwayML + mlJitter(), updatedAt));
    if (isSoccer) odds.push(makeOdd(game, book, 'moneyline', 'draw', null, baseDrawML + mlJitter(), updatedAt));

    // Some books offer a slightly different spread line — mostly the same.
    const spreadLine = rng() > 0.85 ? baseSpread + (rng() > 0.5 ? 0.5 : -0.5) : baseSpread;
    const sJitter = () => intBetween(rng, -10, 10);
    odds.push(makeOdd(game, book, 'spread', 'home', -spreadLine, -110 + sJitter(), updatedAt));
    odds.push(makeOdd(game, book, 'spread', 'away',  spreadLine, -110 + sJitter(), updatedAt));

    const totalLine = rng() > 0.85 ? baseTotal + (rng() > 0.5 ? 0.5 : -0.5) : baseTotal;
    const tJitter = () => intBetween(rng, -10, 10);
    odds.push(makeOdd(game, book, 'total', 'over',  totalLine, -110 + tJitter(), updatedAt));
    odds.push(makeOdd(game, book, 'total', 'under', totalLine, -110 + tJitter(), updatedAt));
  }
  return odds;
}

function makeOdd(game, book, marketType, selection, line, oddsAmerican, updatedAt) {
  return {
    gameId: game.id,
    sportsbookId: book.id,
    marketType,        // 'moneyline' | 'spread' | 'total'
    selection,         // 'home' | 'away' | 'over' | 'under'
    line,              // null for ML
    oddsAmerican,
    updatedAt,
  };
}

function probToAmerican(p) {
  if (p >= 0.5) return Math.round(-100 * p / (1 - p));
  return Math.round(100 * (1 - p) / p);
}

function americanFavToSpread(homeProb) {
  // Rough mapping: probability → spread points. Approximate but plausible.
  const edge = (homeProb - 0.5) * 2; // -1..1
  return -edge * 10; // negative because home favorite = -X
}

function baseTotalForSport(sportId, rng) {
  switch (sportId) {
    case 'nfl':    return 41 + intBetween(rng, 0, 14) + 0.5;
    case 'ncaaf':  return 50 + intBetween(rng, 0, 18) + 0.5;
    case 'nba':    return 215 + intBetween(rng, 0, 20) + 0.5;
    case 'ncaab':  return 130 + intBetween(rng, 0, 30) + 0.5;
    case 'mlb':    return 7 + intBetween(rng, 0, 5) + 0.5;
    case 'nhl':    return 5.5 + intBetween(rng, 0, 1);
    case 'soccer': return 2.5;
    default:       return 5.5;
  }
}

// ── Public API (matches the spec in the project brief) ─────────────────────

const _gamesCache = new Map();
function gamesForOffset(offset) {
  if (!_gamesCache.has(offset)) {
    _gamesCache.set(offset, generateGamesForOffset(offset));
  }
  return _gamesCache.get(offset);
}

const _oddsCache = new Map();
function oddsForGame(game) {
  if (!_oddsCache.has(game.id)) {
    _oddsCache.set(game.id, generateOddsForGame(game));
  }
  return _oddsCache.get(game.id);
}

// Allow the API layer to populate real games into the cache.
// Falls back to the deterministic mock generator if real data never arrives.
export function injectGames(offset, games) {
  _gamesCache.set(offset, games);
}

export function getSports()        { return SPORTS.slice(); }
export function getLeagues(sportId){ return sportId ? LEAGUES.filter(l => l.sportId === sportId) : LEAGUES.slice(); }
export function getLeague(id)      { return LEAGUES_BY_ID[id] || null; }
export function getTeam(id)        { return TEAMS_BY_ID[id] || null; }

/**
 * Filter games by sport / dayOffset / status / leagueId.
 */
export function getGames({ sport, dayOffset = 0, status, league } = {}) {
  let games = gamesForOffset(dayOffset);
  if (sport)   games = games.filter(g => g.sportId === sport);
  if (status)  games = games.filter(g => g.status === status);
  if (league)  games = games.filter(g => g.leagueId === league);
  return games;
}

export function getGameById(gameId) {
  // Search across a small window
  for (let off = -7; off <= 7; off++) {
    const found = gamesForOffset(off).find(g => g.id === gameId);
    if (found) return found;
  }
  return null;
}

export function getOddsForGame(gameId) {
  const game = getGameById(gameId);
  if (!game) return [];
  return oddsForGame(game);
}

/**
 * Get the date object corresponding to a given offset.
 */
export function dateForOffset(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

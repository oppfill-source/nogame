// js/detailApi.js — Async data fetching for game detail tabs
// All functions return empty/null on failure so callers can fall back to mock data.

const PROXY   = 'https://axlybeznzibovvqkllzq.supabase.co/functions/v1/odds-proxy';
const ESPN    = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports';

// ── Sport / league mappings ───────────────────────────────────────────────────

const ODDS_SPORT = {
  nfl:       'americanfootball_nfl',
  nba:       'basketball_nba',
  mlb:       'baseball_mlb',
  nhl:       'icehockey_nhl',
  ncaaf:     'americanfootball_ncaaf',
  ncaab:     'basketball_ncaab',
  'ncaab-m': 'basketball_ncaab',
  epl:       'soccer_epl',
  laliga:    'soccer_spain_la_liga',
  ucl:       'soccer_uefa_champs_league',
  mls:       'soccer_usa_mls',
  'fifa-wc': 'soccer_fifa_world_cup',
};

const ESPN_PATH = {
  nfl:       'football/nfl',
  nba:       'basketball/nba',
  mlb:       'baseball/mlb',
  nhl:       'hockey/nhl',
  ncaaf:     'football/college-football',
  ncaab:     'basketball/mens-college-basketball',
  'ncaab-m': 'basketball/mens-college-basketball',
  epl:       'soccer/eng.1',
  laliga:    'soccer/esp.1',
  ucl:       'soccer/uefa.champions',
  mls:       'soccer/usa.1',
  'fifa-wc': 'soccer/fifa.world',
};

// Player prop market keys per sport
const PROP_MARKETS = {
  nba:  'player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals',
  nfl:  'player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_receptions',
  mlb:  'batter_home_runs,batter_hits,pitcher_strikeouts',
  nhl:  'player_points,player_shots_on_goal',
};

// Market types available per sport
function getMarketsForSport(sportOrLeagueId) {
  const base = 'h2h,spreads,totals';
  const playerProps = {
    nfl:  ',player_pass_tds,player_pass_yards,player_rush_yards,player_receptions,player_reception_yards',
    nba:  ',player_points,player_rebounds,player_assists,player_threes',
    mlb:  ',batter_home_runs,batter_hits,pitcher_strikeouts',
    nhl:  ',player_points,player_shots_on_goal',
  };
  return base + (playerProps[sportOrLeagueId] || '');
}

// Odds API bookmaker key → our internal sportsbook ID
const BOOK_ID = {
  draftkings:      'dk',
  fanduel:         'fd',
  betmgm:          'mgm',
  caesars:         'czr',
  williamhill_us:  'czr',
  espnbet:         'espn',
  fanatics:        'fan',
  bet365:          'b365',
  betrivers:       'br',
  hardrockbet:     'hr',
  ballybet:        'bally',
  pointsbetus:     'pb',
  bovada:          'bovada',
  superbook:       'superbook',
  wynnbet:         'wynnbet',
  betonlineag:     'betonline',
  playnow:         'pn',
  mybookieag:      'mybookie',
  lowvig:          'lowvig',
};

export const PROP_LABEL = {
  player_points:        'Points',
  player_rebounds:      'Rebounds',
  player_assists:       'Assists',
  player_threes:        '3-Pointers',
  player_blocks:        'Blocks',
  player_steals:        'Steals',
  player_pass_tds:      'Pass TDs',
  player_pass_yds:      'Pass Yards',
  player_rush_yds:      'Rush Yards',
  player_reception_yds: 'Rec Yards',
  player_receptions:    'Receptions',
  batter_home_runs:     'Home Runs',
  batter_hits:          'Hits',
  pitcher_strikeouts:   'Strikeouts',
  player_shots_on_goal: 'Shots on Goal',
};

// ── In-memory cache ───────────────────────────────────────────────────────────

const _cache  = new Map();
const _stamp  = new Map();
const TTL     = 120000; // 2 minutes

async function cached(key, fn) {
  const now = Date.now();
  if (_cache.has(key) && now - (_stamp.get(key) ?? 0) < TTL) return _cache.get(key);
  const val = await fn();
  _cache.set(key, val);
  _stamp.set(key, now);
  return val;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function proxyFetch(endpoint, params = {}) {
  const paramStr = new URLSearchParams(params).toString();
  const url = `${PROXY}?endpoint=${encodeURIComponent(endpoint)}&params=${encodeURIComponent(paramStr)}`;
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error(`odds-proxy ${res.status}`);
  return res.json();
}

function norm(name) {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function teamMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  const naParts = na.split(' '), nbParts = nb.split(' ');
  const la = naParts[naParts.length - 1], lb = nbParts[nbParts.length - 1];
  if (la && lb && la === lb) return true;
  return naParts.some(function(w) { return w.length > 3 && nb.includes(w); });
}

// "espn-401671869" → "401671869", or null for mock IDs
function espnId(gameId) { return /^espn-/.test(gameId ?? '') ? gameId.replace('espn-', '') : null; }
function espnTeamId(teamId) { return /^espn-/.test(teamId ?? '') ? teamId.replace('espn-', '') : null; }

// ESPN schedule endpoint returns score as { value:107, displayValue:"107" };
// scoreboard endpoint returns it as a plain string "107". Handle both.
function parseScore(score) {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  if (typeof score === 'string') return Number(score) || 0;
  if (typeof score === 'object') {
    if (typeof score.value === 'number') return score.value;
    if (score.displayValue != null) return Number(score.displayValue) || 0;
  }
  return 0;
}

// ── Real Odds ─────────────────────────────────────────────────────────────────

/**
 * Fetch live h2h/spread/total odds for one game from The Odds API via the proxy.
 * Matches the game by team names + date proximity.
 * @returns {{ odds: OddsMarket[], eventId: string|null }}
 */
export async function fetchRealOdds(game) {
  const sportKey = ODDS_SPORT[game.leagueId] ?? ODDS_SPORT[game.sportId];
  if (!sportKey) return { odds: [], eventId: null };

  try {
    const markets = getMarketsForSport(game.sportId || game.leagueId);
    const events = await cached(`odds:${sportKey}`, () =>
      proxyFetch(`sports/${sportKey}/odds`, {
        regions:    'us',
        markets:    markets,
        oddsFormat: 'american',
      })
    );

    if (!Array.isArray(events)) return { odds: [], eventId: null };

    const gameTime = new Date(game.startTime).getTime();
    const event = events.find(ev => {
      if (!teamMatch(ev.home_team, game.homeTeam.name)) return false;
      if (!teamMatch(ev.away_team, game.awayTeam.name)) return false;
      return Math.abs(new Date(ev.commence_time).getTime() - gameTime) < 86400000;
    });

    if (!event) return { odds: [], eventId: null };

    const odds = [];
    const ts   = new Date().toISOString();

    for (const book of event.bookmakers ?? []) {
      const sbId = BOOK_ID[book.key] ?? book.key;
      for (const mkt of book.markets ?? []) {
        const mType = mkt.key === 'h2h' ? 'moneyline'
                    : mkt.key === 'spreads' ? 'spread'
                    : mkt.key === 'totals'  ? 'total'
                    : null;
        if (!mType) continue;
        for (const out of mkt.outcomes ?? []) {
          const sel = mType === 'total'
            ? (out.name?.toLowerCase() === 'over' ? 'over' : 'under')
            : teamMatch(out.name, event.home_team) ? 'home'
            : teamMatch(out.name, event.away_team) ? 'away'
            : out.name?.toLowerCase() === 'draw' ? 'draw'
            : null;
          if (!sel) continue;
          odds.push({
            gameId:       game.id,
            sportsbookId: sbId,
            marketType:   mType,
            selection:    sel,
            line:         out.point ?? null,
            oddsAmerican: out.price,
            updatedAt:    mkt.last_update ?? ts,
          });
        }
      }
    }

    return { odds, eventId: event.id };
  } catch (err) {
    console.warn('[detailApi] fetchRealOdds:', err.message);
    return { odds: [], eventId: null };
  }
}

// ── Player Props ──────────────────────────────────────────────────────────────

/**
 * Fetch player prop odds for a specific Odds API event.
 * @returns {PropGroup[]}  PropGroup = { marketKey, label, players: [{name, over, under}] }
 *   where over/under = [{ book, bookKey, line, odds }]
 */
export async function fetchPlayerProps(eventId, game) {
  const sportKey = ODDS_SPORT[game.leagueId] ?? ODDS_SPORT[game.sportId];
  const markets  = PROP_MARKETS[game.sportId] ?? PROP_MARKETS[game.leagueId];
  if (!sportKey || !eventId || !markets) return [];

  try {
    const data = await cached(`props:${eventId}`, () =>
      proxyFetch(`sports/${sportKey}/events/${eventId}/odds`, {
        regions:    'us',
        markets,
        oddsFormat: 'american',
      })
    );

    if (!Array.isArray(data?.bookmakers) || !data.bookmakers.length) return [];

    // propKey → { label, players: playerName → { name, over[], under[] } }
    const byProp = new Map();

    for (const book of data.bookmakers) {
      for (const mkt of book.markets) {
        const label = PROP_LABEL[mkt.key];
        if (!label) continue;
        if (!byProp.has(mkt.key)) byProp.set(mkt.key, { label, players: new Map() });
        const players = byProp.get(mkt.key).players;
        for (const out of mkt.outcomes) {
          const player = out.description;
          if (!player) continue;
          if (!players.has(player)) players.set(player, { name: player, over: [], under: [] });
          const side = out.name?.toLowerCase().includes('under') ? 'under' : 'over';
          players.get(player)[side].push({
            book:    book.title,
            bookKey: BOOK_ID[book.key] ?? book.key,
            line:    out.point,
            odds:    out.price,
          });
        }
      }
    }

    return [...byProp.entries()].map(([key, { label, players }]) => ({
      marketKey: key,
      label,
      players: [...players.values()].sort((a, b) => {
        // Highest line first (most prestigious stat threshold)
        const al = a.over[0]?.line ?? a.under[0]?.line ?? 0;
        const bl = b.over[0]?.line ?? b.under[0]?.line ?? 0;
        return bl - al;
      }),
    }));
  } catch (err) {
    console.warn('[detailApi] fetchPlayerProps:', err.message);
    return [];
  }
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

function timedFetch(url, ms) {
  var controller = new AbortController();
  var id = setTimeout(function() { controller.abort(); }, ms);
  return fetch(url, { signal: controller.signal }).then(
    function(r) { clearTimeout(id); return r; },
    function(e) { clearTimeout(id); throw e; }
  );
}

// ── ESPN Stats (box score) ────────────────────────────────────────────────────

/**
 * Fetch ESPN game summary which includes the box score.
 * @returns {object|null}  Raw ESPN summary response
 */
export async function fetchGameStats(game) {
  const path    = ESPN_PATH[game.leagueId];
  const eventId = espnId(game.id);
  if (!path || !eventId) return null;

  try {
    return await cached(`stats:${game.id}`, async () => {
      const res = await timedFetch(`${ESPN}/${path}/summary?event=${eventId}`, 8000);
      if (!res.ok) throw new Error(`ESPN summary ${res.status}`);
      return res.json();
    });
  } catch (err) {
    console.warn('[detailApi] fetchGameStats:', err.message);
    return null;
  }
}

// ── ESPN H2H ──────────────────────────────────────────────────────────────────

/**
 * Fetch last 10 games for each team + direct matchup history.
 * @returns {{ meetings: Meeting[], homeForm: FormGame[], awayForm: FormGame[] }}
 */
export async function fetchH2H(game) {
  const path       = ESPN_PATH[game.leagueId];
  const homeEspnId = espnTeamId(game.homeTeam.id);
  const awayEspnId = espnTeamId(game.awayTeam.id);
  const empty      = { meetings: [], homeForm: [], awayForm: [] };
  if (!path || !homeEspnId) return empty;

  try {
    return await cached(`h2h2:${game.homeTeam.id}:${game.awayTeam.id}`, async () => {
      const getSchedule = async (teamId) => {
        const r = await timedFetch(`${ESPN}/${path}/teams/${teamId}/schedule`, 8000);
        if (!r.ok) return { events: [] };
        return r.json();
      };

      const [homeData, awayData] = await Promise.all([
        getSchedule(homeEspnId),
        awayEspnId ? getSchedule(awayEspnId) : Promise.resolve({ events: [] }),
      ]);

      const isFinished = (ev) => {
        const n = ev.competitions?.[0]?.status?.type?.name ?? '';
        return n.includes('FINAL') || n.includes('END');
      };

      const parseForm = (events, ourName, theirName) =>
        (events ?? []).filter(isFinished).slice(-10).map(ev => {
          const comp = ev.competitions[0];
          const home = comp.competitors.find(c => c.homeAway === 'home') ?? comp.competitors[0];
          const away = comp.competitors.find(c => c.homeAway === 'away') ?? comp.competitors[1];
          const hs   = parseScore(home?.score);
          const as_  = parseScore(away?.score);
          const ourIsHome = teamMatch(home?.team?.displayName ?? '', ourName);
          const ourScore  = ourIsHome ? hs : as_;
          const oppScore  = ourIsHome ? as_ : hs;
          const oppName   = ourIsHome ? (away?.team?.displayName ?? '?') : (home?.team?.displayName ?? '?');
          const oppAbbr   = ourIsHome ? (away?.team?.abbreviation ?? '?') : (home?.team?.abbreviation ?? '?');
          // Use ESPN's authoritative winner flag; fall back to score comparison
          const ourWinner = ourIsHome ? (home?.winner === true) : (away?.winner === true);
          return {
            date:     ev.date,
            opponent: oppName,
            oppAbbr,
            isHome:   ourIsHome,
            ourScore,
            oppScore,
            won:      ourWinner || ourScore > oppScore,
            isH2H:    teamMatch(oppName, theirName),
          };
        });

      const meetings = (homeData.events ?? [])
        .filter(ev => {
          if (!isFinished(ev)) return false;
          const comps = ev.competitions?.[0]?.competitors ?? [];
          return comps.some(c => teamMatch(c.team?.displayName ?? '', game.awayTeam.name));
        })
        .slice(-6).slice(0, 5).reverse()
        .map(ev => {
          const comp = ev.competitions[0];
          const home = comp.competitors.find(c => c.homeAway === 'home') ?? comp.competitors[0];
          const away = comp.competitors.find(c => c.homeAway === 'away') ?? comp.competitors[1];
          const hs   = parseScore(home?.score);
          const as_  = parseScore(away?.score);
          const ourTeamIsHome = teamMatch(home?.team?.displayName ?? '', game.homeTeam.name);
          const homeWon = home?.winner === true;
          const awayWon = away?.winner === true;
          return {
            date:       ev.date,
            homeTeam:   home?.team?.displayName ?? '?',
            homeAbbr:   home?.team?.abbreviation ?? '?',
            awayTeam:   away?.team?.displayName ?? '?',
            awayAbbr:   away?.team?.abbreviation ?? '?',
            homeScore:  hs,
            awayScore:  as_,
            ourTeamWon: ourTeamIsHome ? (homeWon || hs > as_) : (awayWon || as_ > hs),
          };
        });

      return {
        meetings,
        homeForm: parseForm(homeData.events, game.homeTeam.name, game.awayTeam.name),
        awayForm: parseForm(awayData.events, game.awayTeam.name, game.homeTeam.name),
      };
    });
  } catch (err) {
    console.warn('[detailApi] fetchH2H:', err.message);
    return empty;
  }
}

// ── ESPN Standings ────────────────────────────────────────────────────────────

/**
 * Fetch current league standings.
 * @returns {object|null}  Raw ESPN standings response
 */
export async function fetchStandings(game) {
  const path = ESPN_PATH[game.leagueId];
  if (!path) return null;

  try {
    return await cached(`standings:${game.leagueId}`, async () => {
      const res = await timedFetch(`${ESPN_V2}/${path}/standings`, 8000);
      if (!res.ok) throw new Error(`ESPN standings ${res.status}`);
      return res.json();
    });
  } catch (err) {
    console.warn('[detailApi] fetchStandings:', err.message);
    return null;
  }
}

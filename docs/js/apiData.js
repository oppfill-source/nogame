// ESPN public scoreboard API — no API key required, CORS-safe in browser
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';

// leagueId → ESPN sport/league path
const LEAGUE_PATHS = {
  nfl:       'football/nfl',
  nba:       'basketball/nba',
  mlb:       'baseball/mlb',
  nhl:       'hockey/nhl',
  ncaaf:     'football/college-football',
  'ncaab-m': 'basketball/mens-college-basketball',
  epl:       'soccer/eng.1',
  laliga:    'soccer/esp.1',
  ucl:       'soccer/uefa.champions',
  mls:       'soccer/usa.1',
  'fifa-wc': 'soccer/fifa.world',
};

const PATH_TO_SPORT = {
  'football/nfl':                       'nfl',
  'basketball/nba':                     'nba',
  'baseball/mlb':                       'mlb',
  'hockey/nhl':                         'nhl',
  'football/college-football':          'ncaaf',
  'basketball/mens-college-basketball': 'ncaab',
  'soccer/eng.1':                       'soccer',
  'soccer/esp.1':                       'soccer',
  'soccer/uefa.champions':              'soccer',
  'soccer/usa.1':                       'soccer',
  'soccer/fifa.world':                  'soccer',
};

const _cache     = new Map(); // cacheKey → Game[]
const _fetchedAt = new Map(); // cacheKey → timestamp
const CACHE_TTL  = 60000;    // refresh live data every 60 s

function offsetToDateStr(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
}

function espnStatusToInternal(typeName = '') {
  if (typeName.includes('FINAL') || typeName.includes('END')) return 'final';
  if (typeName.includes('HALFTIME') || typeName.includes('INTERMISSION')) return 'halftime';
  if (typeName.includes('PROGRESS')) return 'live';
  return 'scheduled';
}

function buildPeriodLabel(sportId, statusType, period) {
  const name   = statusType?.name ?? '';
  const detail = statusType?.shortDetail ?? statusType?.detail ?? '';
  if (name.includes('FINAL'))     return 'Final';
  if (name.includes('HALFTIME'))  return (sportId === 'nhl' || sportId === 'mlb') ? 'Intermission' : 'Halftime';
  if (!name.includes('PROGRESS')) return null;
  switch (sportId) {
    case 'nfl': case 'ncaaf': case 'nba': case 'ncaab':
      return period ? `Q${period}` : (detail || 'Live');
    case 'nhl':
      return period ? `P${period}` : (detail || 'Live');
    default:
      return detail || 'Live';
  }
}

function buildTeam(competitor, leagueId) {
  const t = competitor?.team ?? {};
  return {
    id:       `espn-${t.id ?? competitor.id}`,
    leagueId,
    name:     t.displayName ?? t.shortDisplayName ?? 'TBD',
    abbr:     t.abbreviation ?? '???',
    city:     t.location ?? '',
  };
}

async function fetchLeague(leagueId, dateStr) {
  const key = `${leagueId}:${dateStr}`;
  const now = Date.now();
  if (_cache.has(key) && now - (_fetchedAt.get(key) ?? 0) < CACHE_TTL) {
    return _cache.get(key);
  }

  const path    = LEAGUE_PATHS[leagueId];
  const sportId = PATH_TO_SPORT[path];
  const url     = `${ESPN}/${path}/scoreboard?dates=${dateStr}&limit=50`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(function() { controller.abort(); }, 6000);
  const res = await fetch(url, { signal: controller.signal }).finally(function() {
    clearTimeout(timeoutId);
  });
  if (!res.ok) throw new Error(`ESPN ${leagueId}: HTTP ${res.status}`);

  const { events = [] } = await res.json();
  const games = [];

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const st     = ev.status ?? {};
    const status = espnStatusToInternal(st.type?.name);
    const active = status === 'live' || status === 'halftime';
    const done   = status === 'final';

    games.push({
      id:        `espn-${ev.id}`,
      sportId,
      leagueId,
      homeTeam:  buildTeam(home, leagueId),
      awayTeam:  buildTeam(away, leagueId),
      startTime: ev.date,
      status,
      clock:     active && st.displayClock && st.displayClock !== '0:00' ? st.displayClock : null,
      period:    buildPeriodLabel(sportId, st.type, st.period),
      homeScore: (active || done) ? Number(home.score ?? 0) : null,
      awayScore: (active || done) ? Number(away.score ?? 0) : null,
      venue:     comp.venue?.fullName ?? '',
      hasOdds:   true, // mock odds engine seeds from game.id, works for any id
    });
  }

  _cache.set(key, games);
  _fetchedAt.set(key, now);
  return games;
}

/**
 * Fetch real games for a given day offset from ESPN.
 * Returns an empty array on network failure (caller falls back to mock data).
 */
export async function fetchGamesForOffset(dayOffset) {
  const dateStr = offsetToDateStr(dayOffset);
  const results = await Promise.all(
    Object.keys(LEAGUE_PATHS).map(function(id) {
      return fetchLeague(id, dateStr).catch(function() { return []; });
    })
  );
  return results.reduce(function(acc, arr) { return acc.concat(arr); }, []);
}

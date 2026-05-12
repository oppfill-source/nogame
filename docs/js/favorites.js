// ── Favorites store ─────────────────────────────────────────────────────────
// Backed by localStorage. Single key, JSON-encoded { games:[], teams:[] }.

const KEY = 'nogame.favorites.v1';
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { games: [], teams: [] };
    const parsed = JSON.parse(raw);
    return {
      games: Array.isArray(parsed.games) ? parsed.games : [],
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
    };
  } catch (_e) {
    return { games: [], teams: [] };
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_e) {}
  for (const l of listeners) l(state);
}

export function getFavorites()           { return read(); }
export function isGameFavorited(gameId)  { return read().games.includes(gameId); }
export function isTeamFavorited(teamId)  { return read().teams.includes(teamId); }

export function toggleFavoriteGame(gameId) {
  const s = read();
  const i = s.games.indexOf(gameId);
  if (i >= 0) s.games.splice(i, 1); else s.games.push(gameId);
  write(s);
  return s.games.includes(gameId);
}

export function toggleFavoriteTeam(teamId) {
  const s = read();
  const i = s.teams.indexOf(teamId);
  if (i >= 0) s.teams.splice(i, 1); else s.teams.push(teamId);
  write(s);
  return s.teams.includes(teamId);
}

export function onFavoritesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

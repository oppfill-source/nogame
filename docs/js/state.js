// ── Centralized app state ────────────────────────────────────────────────────
// Single source of truth. Loaded from localStorage where applicable.
// Use setState() to mutate — triggers all registered listeners.

const PREFS_KEY = 'nogame.prefs.v1';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch { return {}; }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      oddsFormat: state.oddsFormat,
      userState: state.userState,
      pinnedLeagues: state.pinnedLeagues,
      preferredBooks: state.preferredBooks,
      themeMode: state.themeMode,
    }));
  } catch { /* storage unavailable */ }
}

const prefs = loadPrefs();

export const state = {
  // ── Feed / homepage ──────────────────────────────────────────────────────
  sport: 'all',
  dayOffset: 0,
  tab: 'all',
  expandedGameId: null,
  searchQuery: '',

  // ── Routing ──────────────────────────────────────────────────────────────
  route: { view: 'home', params: {} },

  // ── User preferences (persisted) ─────────────────────────────────────────
  oddsFormat: prefs.oddsFormat || 'american', // 'american' | 'decimal' | 'fractional'
  userState: prefs.userState || null,          // 'NJ' | 'NY' | null
  pinnedLeagues: prefs.pinnedLeagues || ['nfl', 'nba', 'mlb'],
  preferredBooks: prefs.preferredBooks || [],
  themeMode: prefs.themeMode || 'dark',

  // ── UI ────────────────────────────────────────────────────────────────────
  leftSidebarOpen: false,   // mobile: overlay open
  searchOpen: false,
  detailTab: 'odds',        // active tab on game detail page
  detailMarket: 'moneyline',
};

const _listeners = new Set();

/**
 * Merge patch into state and notify all listeners.
 * Pass `persist: true` to save user prefs to localStorage.
 */
export function setState(patch, { persist = false } = {}) {
  Object.assign(state, patch);
  if (persist) savePrefs();
  for (const fn of _listeners) fn(state);
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 */
export function onStateChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

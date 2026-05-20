// ── Hash-based SPA router ────────────────────────────────────────────────────
// Routes:
//   (empty)          → home
//   game/{id}        → gameDetail
//   league/{id}      → league
//   team/{id}        → team
//   user/{id}        → userProfile (public view)

const ROUTES = [
  { pattern: /^$/, view: 'home', param: null },
  { pattern: /^game\/(.+)$/, view: 'gameDetail', param: 'id' },
  { pattern: /^league\/(.+)$/, view: 'league', param: 'id' },
  { pattern: /^team\/(.+)$/, view: 'team', param: 'id' },
  { pattern: /^user\/(.+)$/, view: 'userProfile', param: 'id' },
];

/**
 * Parse window.location.hash into { view, params }.
 */
export function parseRoute(hash) {
  const path = (hash || '').replace(/^#\/?/, '').trim();
  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) {
      const params = {};
      if (route.param) params[route.param] = decodeURIComponent(m[1]);
      return { view: route.view, params };
    }
  }
  return { view: 'home', params: {} };
}

/**
 * Navigate to a hash path.
 * Pass '' or '/' to go home.
 */
export function navigate(path) {
  const hash = path ? `#${path.replace(/^#/, '')}` : '#';
  window.location.hash = hash;
}

/**
 * Go back in history, or fallback to home.
 */
export function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate('');
  }
}

/**
 * Register a callback that fires on every route change and on initial load.
 * Returns an unsubscribe function.
 */
export function initRouter(onRoute) {
  const handle = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle(); // fire immediately for initial URL
  return () => window.removeEventListener('hashchange', handle);
}

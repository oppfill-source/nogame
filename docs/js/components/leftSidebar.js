// ── Left sidebar component ───────────────────────────────────────────────────
// Renders sport tree, favorites shortcut, and pinned leagues.
// Pure render function — returns HTML string.

import { getSports, getLeagues, getGames } from '../mockData.js';
import { getFavorites } from '../favorites.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

const PINNABLE_LEAGUES = [
  { id: 'nfl', name: 'NFL', icon: '🏈' },
  { id: 'nba', name: 'NBA', icon: '🏀' },
  { id: 'mlb', name: 'MLB', icon: '⚾' },
  { id: 'nhl', name: 'NHL', icon: '🏒' },
  { id: 'ncaaf', name: 'NCAAF', icon: '🏈' },
  { id: 'ncaab-m', name: 'NCAAB', icon: '🏀' },
  { id: 'epl', name: 'Premier League', icon: '⚽' },
  { id: 'laliga', name: 'La Liga', icon: '⚽' },
  { id: 'ucl', name: 'Champions League', icon: '⚽' },
  { id: 'mls', name: 'MLS', icon: '⚽' },
  { id: 'ufc', name: 'UFC', icon: '🥊' },
  { id: 'atp', name: 'ATP Tour', icon: '🎾' },
];

export function renderLeftSidebar() {
  const sports = getSports();
  const favs = getFavorites();
  const favCount = favs.games.length;

  // Live game count per sport
  const liveGames = getGames({ dayOffset: 0 }).filter(
    g => g.status === 'live' || g.status === 'halftime'
  );
  const liveCountBySport = {};
  for (const g of liveGames) {
    liveCountBySport[g.sportId] = (liveCountBySport[g.sportId] || 0) + 1;
  }
  const totalLive = liveGames.length;

  const pinnedIds = new Set(state.pinnedLeagues);

  return `
    <div class="lsb">

      <!-- Favorites -->
      <div class="lsb__section">
        <button class="lsb__item${state.tab === 'favorites' && state.route.view === 'home' ? ' lsb__item--active' : ''}"
                data-action="lsb-favorites">
          <span class="lsb__item-icon">⭐</span>
          <span class="lsb__item-name">My Favorites</span>
          ${favCount > 0 ? `<span class="lsb__item-badge lsb__item-badge--green">${favCount}</span>` : ''}
        </button>
      </div>

      <!-- Pinned leagues -->
      ${state.pinnedLeagues.length > 0 ? `
        <div class="lsb__section">
          <div class="lsb__label">📌 Pinned</div>
          ${state.pinnedLeagues.map(lid => {
            const league = PINNABLE_LEAGUES.find(l => l.id === lid);
            if (!league) return '';
            const isActive = state.route.view === 'league' && state.route.params.id === lid;
            return `
              <button class="lsb__item${isActive ? ' lsb__item--active' : ''}"
                      data-action="lsb-league" data-league="${lid}">
                <span class="lsb__item-icon">${league.icon}</span>
                <span class="lsb__item-name">${league.name}</span>
                <button class="lsb__pin-btn lsb__pin-btn--pinned"
                        data-action="lsb-unpin" data-league="${lid}"
                        aria-label="Unpin ${league.name}" type="button">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                  </svg>
                </button>
              </button>`;
          }).join('')}
        </div>
      ` : ''}

      <!-- All sports / Live now -->
      <div class="lsb__section">
        <div class="lsb__label">Sports</div>

        <button class="lsb__item${state.sport === 'all' && state.route.view === 'home' ? ' lsb__item--active' : ''}"
                data-action="lsb-sport" data-sport="all">
          <span class="lsb__item-icon">🏆</span>
          <span class="lsb__item-name">All Sports</span>
          ${totalLive > 0 ? `<span class="lsb__item-badge lsb__item-badge--live">${totalLive} live</span>` : ''}
        </button>

        ${sports.map(sport => {
          const liveCount = liveCountBySport[sport.id] || 0;
          const isActive = state.sport === sport.id && state.route.view === 'home';
          return `
            <button class="lsb__item${isActive ? ' lsb__item--active' : ''}"
                    data-action="lsb-sport" data-sport="${sport.id}">
              <span class="lsb__item-icon">${sport.icon}</span>
              <span class="lsb__item-name">${sport.name}</span>
              ${liveCount > 0 ? `<span class="lsb__item-badge lsb__item-badge--live">${liveCount}</span>` : ''}
            </button>`;
        }).join('')}
      </div>

      <!-- Leagues for selected sport (if not "all") -->
      ${state.sport !== 'all' && state.route.view === 'home' ? (() => {
        const leagues = getLeagues(state.sport);
        if (!leagues.length) return '';
        return `
          <div class="lsb__section">
            <div class="lsb__label">Leagues</div>
            ${leagues.map(league => {
              const meta = PINNABLE_LEAGUES.find(l => l.id === league.id);
              const isPinned = pinnedIds.has(league.id);
              const isActive = state.route.view === 'league' && state.route.params.id === league.id;
              return `
                <button class="lsb__item${isActive ? ' lsb__item--active' : ''}"
                        data-action="lsb-league" data-league="${league.id}">
                  <span class="lsb__item-icon">${meta?.icon || '🏆'}</span>
                  <span class="lsb__item-name">${league.name}</span>
                  <button class="lsb__pin-btn${isPinned ? ' lsb__pin-btn--pinned' : ''}"
                          data-action="${isPinned ? 'lsb-unpin' : 'lsb-pin'}"
                          data-league="${league.id}"
                          aria-label="${isPinned ? 'Unpin' : 'Pin'} ${league.name}"
                          type="button">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                    </svg>
                  </button>
                </button>`;
            }).join('')}
          </div>`;
      })() : ''}

    </div>`;
}

/**
 * Bind click events inside the left sidebar.
 * Call once after mounting.
 */
export function bindLeftSidebar(el, { onSportChange, onLeagueChange, onFavoritesClick, onPinChange }) {
  if (!el) return;
  el.addEventListener('click', e => {
    // Pin/unpin (must check before lsb-league to avoid bubbling)
    const pinBtn = e.target.closest('[data-action="lsb-pin"]');
    if (pinBtn) {
      e.stopPropagation();
      onPinChange(pinBtn.dataset.league, true);
      return;
    }
    const unpinBtn = e.target.closest('[data-action="lsb-unpin"]');
    if (unpinBtn) {
      e.stopPropagation();
      onPinChange(unpinBtn.dataset.league, false);
      return;
    }

    const favBtn = e.target.closest('[data-action="lsb-favorites"]');
    if (favBtn) { onFavoritesClick(); return; }

    const sportBtn = e.target.closest('[data-action="lsb-sport"]');
    if (sportBtn) { onSportChange(sportBtn.dataset.sport); return; }

    const leagueBtn = e.target.closest('[data-action="lsb-league"]');
    if (leagueBtn) { onLeagueChange(leagueBtn.dataset.league); return; }
  });
}

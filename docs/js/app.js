// ── Main app controller ──────────────────────────────────────────────────────
// Boots the SPA: initializes router, mounts views, wires all events.

import { getSports, getGames, getLeague, getGameById, injectGames } from './mockData.js';
import { getOddsForGame } from './mockData.js';
import { fetchGamesForOffset } from './apiData.js';
import { renderGameCard, renderExpandedOdds, renderOddsTable } from './gameCard.js';
import { toggleFavoriteGame, isGameFavorited, getFavorites, onFavoritesChange } from './favorites.js';
import { state, setState } from './state.js';
import { initRouter, navigate, parseRoute } from './router.js';
import { renderLeftSidebar, bindLeftSidebar } from './components/leftSidebar.js';
import { renderRightSidebar } from './components/rightSidebar.js';
import {
  renderHomeView, renderStatusFilter,
  renderFeed, getFilteredGames
} from './views/homeView.js';
import { renderGameDetailView, bindDetailView } from './views/gameDetailView.js';

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderSportsNav();
  bindSportsNav();
  mountLeftSidebar();
  mountRightSidebar();
  bindOddsFormat();
  bindSearch();
  bindBurger();

  // Router: mounts the correct view on every hash change
  initRouter(route => {
    setState({ route });
    mountView(route);
    // Refresh sidebars on route change so active states update
    mountLeftSidebar();
  });

  // Load real ESPN scores for today ± 1 day; silently falls back to mock data
  loadRealData([0, -1, 1]);

  // Live tick: re-fetch real data + re-render every 30s when live games exist
  const syncEl = document.getElementById('liveSyncIndicator');
  setInterval(() => {
    const hasLive = getGames({ dayOffset: state.dayOffset })
      .some(g => g.status === 'live' || g.status === 'halftime');
    if (syncEl) syncEl.hidden = !hasLive;
    if (hasLive) loadRealData([state.dayOffset]);
    if (state.route.view === 'home' && (state.tab === 'live' || hasLive)) {
      renderHomeFeed();
    }
    mountRightSidebar(); // refresh live counts
  }, 30000);

  // Re-render favorites tab when localStorage changes (other tabs)
  onFavoritesChange(() => {
    if (state.tab === 'favorites' && state.route.view === 'home') renderHomeFeed();
    mountLeftSidebar();
  });
});

// ── Real data loader ───────────────────────────────────────────────────────

async function loadRealData(offsets) {
  for (const offset of offsets) {
    try {
      const games = await fetchGamesForOffset(offset);
      if (games.length > 0) {
        injectGames(offset, games);
        if (offset === state.dayOffset && state.route.view === 'home') {
          renderHomeFeed();
          mountRightSidebar();
        }
      }
    } catch (_e) {
      // network error — mock data remains in place
    }
  }
}

// ── Router: view mounting ──────────────────────────────────────────────────

function mountView(route) {
  const main = document.getElementById('pageMain');
  if (!main) return;

  switch (route.view) {
    case 'home':
      mountHomeView(main);
      break;
    case 'gameDetail':
      mountDetailView(main, route.params.id);
      break;
    case 'league':
      mountLeaguePlaceholder(main, route.params.id);
      break;
    case 'team':
      mountTeamPlaceholder(main, route.params.id);
      break;
    default:
      mountHomeView(main);
  }
}

// ── Home view ──────────────────────────────────────────────────────────────

function mountHomeView(main) {
  main.innerHTML = renderHomeView();
  bindDateSelector();
  bindStatusFilter();
  bindFeedEvents();
  renderHomeFeed();
}

function renderHomeFeed() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const games = getFilteredGames();

  // Update game count badge
  const summary = document.getElementById('feedSummary');
  if (summary) {
    const liveCount = games.filter(g => g.status === 'live' || g.status === 'halftime').length;
    summary.textContent = liveCount > 0
      ? `${games.length} games · ${liveCount} live`
      : `${games.length} game${games.length === 1 ? '' : 's'}`;
  }

  feed.innerHTML = renderFeed(games);

  // Restore expanded game if one was open
  if (state.expandedGameId) {
    const card = feed.querySelector(`[data-game-id="${state.expandedGameId}"]`);
    if (card) {
      openExpand(card);
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
    }
  }
}

// ── Game detail view ───────────────────────────────────────────────────────

function mountDetailView(main, gameId) {
  // Reset detail tab to odds when navigating to a new game
  if (state.route.params?.id !== gameId) {
    setState({ detailTab: 'odds', detailMarket: 'moneyline' });
  }
  main.innerHTML = renderGameDetailView(gameId);
  bindDetailView(main, () => {
    main.innerHTML = renderGameDetailView(gameId);
    bindDetailView(main, null);
  });
}

// ── League placeholder ─────────────────────────────────────────────────────

function mountLeaguePlaceholder(main, leagueId) {
  const league = getLeague(leagueId);
  const games = getGames({ dayOffset: state.dayOffset }).filter(g => g.leagueId === leagueId);

  main.innerHTML = `
    <div style="padding:20px 16px">
      <a class="detail-back" href="#">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All Scores
      </a>
      <div style="padding:16px 0 8px">
        <h1 style="font-size:1.4rem;font-weight:800;color:var(--text)">${league?.name ?? leagueId}</h1>
        <p style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${league?.season ?? ''} · ${league?.country ?? ''}</p>
      </div>

      <div style="margin-bottom:12px;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">
        Today's Games (${games.length})
      </div>
      <div class="feed">
        ${games.length > 0
          ? games.map(g => renderGameCard(g)).join('')
          : `<div class="empty"><div class="empty__icon">📭</div><div class="empty__title">No games today</div><div class="empty__sub">Try a different date.</div></div>`
        }
      </div>
    </div>`;

  // Bind game card events
  bindFeedEventsIn(main.querySelector('.feed'));
}

// ── Team placeholder ───────────────────────────────────────────────────────

function mountTeamPlaceholder(main, teamId) {
  main.innerHTML = `
    <div style="padding:20px 16px">
      <a class="detail-back" href="#">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All Scores
      </a>
      <div style="padding:32px 0;text-align:center">
        <div style="font-size:2rem;margin-bottom:10px">🏆</div>
        <div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px">Team pages coming soon</div>
        <div style="font-size:.82rem;color:var(--text-muted)">Full team schedules, stats, and odds will appear here.</div>
      </div>
    </div>`;
}

// ── Sports navigation ──────────────────────────────────────────────────────

function renderSportsNav() {
  const el = document.getElementById('sportsNav');
  if (!el) return;
  const sports = getSports();
  const pinned = ['all', 'nfl', 'nba', 'mlb', 'nhl', 'ncaab', 'soccer'];
  const more = sports.filter(s => !pinned.includes(s.id));
  const allItems = [{ id: 'all', name: 'All', icon: '⭐' }, ...sports.filter(s => pinned.includes(s.id))];

  el.innerHTML = `
    ${allItems.map(s => `
      <button class="sport-pill${state.sport === s.id ? ' sport-pill--active' : ''}"
              data-sport="${s.id}" type="button">
        <span class="sport-pill__icon">${s.icon}</span>
        <span class="sport-pill__name">${s.name}</span>
      </button>
    `).join('')}
    <div class="sport-dropdown">
      <button class="sport-pill" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="sport-pill__icon">⋯</span>
        <span class="sport-pill__name">More</span>
      </button>
      <div class="sport-dropdown__menu" hidden>
        ${more.map(s => `
          <button class="sport-dropdown__item${state.sport === s.id ? ' sport-dropdown__item--active' : ''}"
                  data-sport="${s.id}" type="button">
            <span>${s.icon} ${s.name}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
}

function bindSportsNav() {
  const el = document.getElementById('sportsNav');
  if (!el) return;
  el.addEventListener('click', e => {
    const moreBtn = e.target.closest('.sport-dropdown > button');
    if (moreBtn) {
      const menu = moreBtn.closest('.sport-dropdown').querySelector('.sport-dropdown__menu');
      const opening = menu.hidden; // true when we're about to open it
      menu.hidden = !opening;
      moreBtn.setAttribute('aria-expanded', String(opening));
      return;
    }
    const btn = e.target.closest('[data-sport]');
    if (!btn) return;
    setState({ sport: btn.dataset.sport, expandedGameId: null });
    const menu = el.querySelector('.sport-dropdown__menu');
    if (menu) menu.hidden = true;
    el.querySelector('.sport-dropdown > button')?.setAttribute('aria-expanded', false);
    renderSportsNav();
    mountLeftSidebar(); // refresh sport highlights in sidebar
    if (state.route.view === 'home') renderHomeFeed();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const menu = el.querySelector('.sport-dropdown__menu');
      if (menu && !menu.hidden) {
        menu.hidden = true;
        el.querySelector('.sport-dropdown > button')?.setAttribute('aria-expanded', false);
      }
    }
  });
}

// ── Left sidebar ───────────────────────────────────────────────────────────

function mountLeftSidebar() {
  const el = document.getElementById('leftSidebarContent');
  if (!el) return;
  el.innerHTML = renderLeftSidebar();
  bindLeftSidebar(el, {
    onSportChange(sportId) {
      setState({ sport: sportId, expandedGameId: null });
      renderSportsNav();
      mountLeftSidebar();
      if (state.route.view === 'home') {
        renderHomeFeed();
      } else {
        navigate('');
      }
    },
    onLeagueChange(leagueId) {
      navigate(`league/${leagueId}`);
      closeMobileSidebar();
    },
    onFavoritesClick() {
      setState({ tab: 'favorites', expandedGameId: null });
      if (state.route.view !== 'home') {
        navigate('');
      } else {
        syncStatusFilter();
        renderHomeFeed();
      }
      closeMobileSidebar();
    },
    onPinChange(leagueId, pin) {
      const current = [...state.pinnedLeagues];
      const updated = pin
        ? [...new Set([...current, leagueId])]
        : current.filter(id => id !== leagueId);
      setState({ pinnedLeagues: updated }, { persist: true });
      mountLeftSidebar();
    },
  });
}

// ── Right sidebar ──────────────────────────────────────────────────────────

function mountRightSidebar() {
  const el = document.getElementById('rightSidebarContent');
  if (!el) return;
  el.innerHTML = renderRightSidebar();

  // "See all live" shortcut
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="rsb-see-live"]');
    if (btn) {
      e.preventDefault();
      setState({ tab: 'live' });
      if (state.route.view !== 'home') navigate('');
      else { syncStatusFilter(); renderHomeFeed(); }
    }
  });
}

// ── Date selector ──────────────────────────────────────────────────────────

function bindDateSelector() {
  const main = document.getElementById('pageMain');
  if (!main) return;
  main.addEventListener('click', e => {
    const btn = e.target.closest('[data-offset]');
    if (!btn || !btn.closest('.home-dates')) return;
    setState({ dayOffset: parseInt(btn.dataset.offset, 10), expandedGameId: null });
    // Re-render date buttons active state
    main.querySelectorAll('[data-offset]').forEach(b => {
      const active = parseInt(b.dataset.offset, 10) === state.dayOffset;
      b.classList.toggle('home-date-btn--active', active);
      b.querySelectorAll('.home-date-btn__label, .home-date-btn__sub').forEach(s => {
        s.style.color = active ? '#000' : '';
      });
    });
    renderHomeFeed();
    mountRightSidebar();
    loadRealData([state.dayOffset]);
  });
}

// ── Status filter tabs ─────────────────────────────────────────────────────

function bindStatusFilter() {
  const main = document.getElementById('pageMain');
  if (!main) return;
  main.addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn || !btn.closest('.home-filter-tabs')) return;
    setState({ tab: btn.dataset.tab, expandedGameId: null });
    syncStatusFilter();
    renderHomeFeed();
  });
}

function syncStatusFilter() {
  document.querySelectorAll('.home-filter-tab').forEach(b => {
    const active = b.dataset.tab === state.tab;
    b.classList.toggle('home-filter-tab--active', active);
    b.setAttribute('aria-selected', active);
  });
}

// ── Feed event delegation ──────────────────────────────────────────────────

function bindFeedEvents() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  bindFeedEventsIn(feed);
}

function bindFeedEventsIn(feed) {
  if (!feed) return;
  feed.addEventListener('click', e => {
    // League collapse
    if (e.target.closest('[data-action="toggle-league"]')) {
      e.target.closest('.lg')?.classList.toggle('lg--collapsed');
      return;
    }

    // Navigate to league page via league name link
    const leagueLink = e.target.closest('[data-action="league-link"]');
    if (leagueLink) return; // let href handle it

    // Favorite toggle
    const favBtn = e.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      e.stopPropagation();
      const id = favBtn.closest('[data-game-id]')?.dataset.gameId;
      if (!id) return;
      toggleFavoriteGame(id);
      const on = isGameFavorited(id);
      favBtn.classList.toggle('gc__fav--on', on);
      favBtn.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none');
      mountLeftSidebar(); // update fav count in sidebar
      return;
    }

    // Odds expand toggle (quick view)
    const oddsToggle = e.target.closest('[data-action="toggle-odds"]') ||
                       e.target.closest('.gc__odds-toggle');
    if (oddsToggle) {
      e.stopPropagation();
      const card = oddsToggle.closest('[data-game-id]');
      if (card) toggleExpand(card);
      return;
    }

    // Odds market tab in the expanded panel
    const oddsTab = e.target.closest('.odds-tab');
    if (oddsTab) {
      e.stopPropagation();
      const wrap = oddsTab.closest('.odds-expand');
      wrap.querySelectorAll('.odds-tab').forEach(t => t.classList.remove('odds-tab--active'));
      oddsTab.classList.add('odds-tab--active');
      const tableEl = wrap.querySelector('.odds-expand__table');
      const game = getGameById(tableEl?.dataset.gameId);
      if (game) {
        const odds = getOddsForGame(game.id);
        tableEl.innerHTML = renderOddsTable(game, odds, oddsTab.dataset.market);
      }
      return;
    }

    // Click row → navigate to game detail
    const card = e.target.closest('.gc');
    if (card && !e.target.closest('button') && !e.target.closest('a')) {
      const gameId = card.dataset.gameId;
      if (gameId) navigate(`game/${gameId}`);
    }
  });
}

// ── Expand / collapse odds panel ───────────────────────────────────────────

function toggleExpand(card) {
  const id = card.dataset.gameId;
  if (state.expandedGameId === id) {
    closeExpand(card);
    setState({ expandedGameId: null });
  } else {
    if (state.expandedGameId) {
      const prev = document.querySelector(`[data-game-id="${state.expandedGameId}"]`);
      if (prev) closeExpand(prev);
    }
    openExpand(card);
    setState({ expandedGameId: id });
  }
}

function openExpand(card) {
  const game = getGameById(card.dataset.gameId);
  if (!game) return;
  const slot = card.querySelector('.gc__expand');
  if (!slot) return;
  slot.innerHTML = `<div class="odds-expand" style="padding:16px;text-align:center;color:var(--text-muted)">Loading odds…</div>`;
  slot.hidden = false;
  card.classList.add('gc--expanded');
  setTimeout(() => { slot.innerHTML = renderExpandedOdds(game); }, 150);
}

function closeExpand(card) {
  const slot = card.querySelector('.gc__expand');
  if (!slot) return;
  slot.hidden = true;
  slot.innerHTML = '';
  card.classList.remove('gc--expanded');
}

// ── Odds format toggle ─────────────────────────────────────────────────────

function bindOddsFormat() {
  const pill = document.getElementById('oddsFormatPill');
  if (!pill) return;
  pill.addEventListener('click', e => {
    const btn = e.target.closest('[data-format]');
    if (!btn) return;
    const fmt = btn.dataset.format;
    setState({ oddsFormat: fmt }, { persist: true });
    pill.querySelectorAll('[data-format]').forEach(b => {
      b.classList.toggle('odds-format-btn--active', b.dataset.format === fmt);
    });
    // Refresh detail view if on odds tab
    if (state.route.view === 'gameDetail') {
      mountView(state.route);
    }
  });
}

// ── Search ─────────────────────────────────────────────────────────────────

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      setState({ searchQuery: (e.target.value || '').trim().toLowerCase() });
      if (state.route.view === 'home') renderHomeFeed();
    }, 150);
  });
}

// ── Mobile sidebar (burger) ────────────────────────────────────────────────

function bindBurger() {
  document.getElementById('appbarBurger')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobileSidebar);
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebarLeft');
  const overlay = document.getElementById('sidebarOverlay');
  const open = sidebar?.classList.toggle('sidebar-left--open');
  if (overlay) overlay.hidden = !open;
  setState({ leftSidebarOpen: !!open });
}

function closeMobileSidebar() {
  document.getElementById('sidebarLeft')?.classList.remove('sidebar-left--open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.hidden = true;
  setState({ leftSidebarOpen: false });
}


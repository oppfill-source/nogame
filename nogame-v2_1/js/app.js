// ── Main app controller ─────────────────────────────────────────────────────

import {
  getSports, getGames, getLeague, dateForOffset, getGameById, getOddsForGame
} from './mockData.js';
import { renderGameCard, renderExpandedOdds, renderOddsTable } from './gameCard.js';
import {
  toggleFavoriteGame, isGameFavorited, getFavorites, onFavoritesChange
} from './favorites.js';

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  sport: 'all',          // sport id or 'all'
  dayOffset: 0,          // -7 .. +7
  tab: 'all',            // all | live | odds | finished | scheduled | favorites
  expandedGameId: null,  // currently-open odds expand
  searchQuery: '',
};

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderSportsNav();
  bindSportsNav();
  renderDateStrip();
  bindDateStrip();
  bindTabs();
  bindGlobalEvents();
  bindSearch();
  render();

  // Live tick: re-render every 30s so live game clocks/scores feel alive
  // and "last updated" strings advance.
  const syncIndicator = document.querySelector('.live-sync-indicator');
  let isPolling = false;
  const pollInterval = setInterval(() => {
    const hasLive = hasLiveGames();
    if (syncIndicator) {
      syncIndicator.hidden = !hasLive;
      if (hasLive && !isPolling) {
        isPolling = true;
        syncIndicator.classList.add('live-sync-indicator--active');
      }
    }
    if (state.tab === 'live' || hasLive) {
      render();
      setTimeout(() => {
        isPolling = false;
        if (syncIndicator) syncIndicator.classList.remove('live-sync-indicator--active');
      }, 1000);
    }
  }, 30000);

  // React to favorites changes from any source (other tabs, etc.)
  onFavoritesChange(() => {
    if (state.tab === 'favorites') render();
  });
});

// ── Sports navigation ──────────────────────────────────────────────────────

function renderSportsNav() {
  const el = document.getElementById('sportsNav');
  if (!el) return;
  const sports = getSports();
  
  // Pinned: All, NFL, NBA, MLB, NHL, NCAAB, Soccer
  // More: NCAAF, Tennis, MMA, Golf, Boxing, Motorsports
  const pinned = ['all', 'nfl', 'nba', 'mlb', 'nhl', 'ncaab', 'soccer'];
  const more = sports.filter(s => !pinned.includes(s.id));
  
  const allItems = [
    { id: 'all', name: 'All', icon: '⭐' },
    ...sports.filter(s => pinned.includes(s.id)),
  ];
  
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
    // Handle More dropdown toggle
    const moreBtn = e.target.closest('.sport-dropdown > button');
    if (moreBtn) {
      const dropdown = moreBtn.closest('.sport-dropdown');
      const menu = dropdown.querySelector('.sport-dropdown__menu');
      const isOpen = !menu.hidden;
      menu.hidden = !isOpen;
      moreBtn.setAttribute('aria-expanded', !isOpen);
      if (!isOpen) menu.querySelector('.sport-dropdown__item').focus();
      return;
    }

    // Handle sport pill selection (regular or from dropdown)
    const btn = e.target.closest('[data-sport]');
    if (!btn) return;
    state.sport = btn.dataset.sport;
    state.expandedGameId = null;
    
    // Close dropdown if open
    const dropdown = el.querySelector('.sport-dropdown__menu');
    if (dropdown) dropdown.hidden = true;
    const moreBtnElem = el.querySelector('.sport-dropdown > button');
    if (moreBtnElem) moreBtnElem.setAttribute('aria-expanded', false);
    
    renderSportsNav();
    render();
  });

  // Keyboard support
  el.addEventListener('keydown', e => {
    // Escape closes dropdown
    if (e.key === 'Escape') {
      const dropdown = el.querySelector('.sport-dropdown__menu');
      if (dropdown && !dropdown.hidden) {
        dropdown.hidden = true;
        const moreBtnElem = el.querySelector('.sport-dropdown > button');
        if (moreBtnElem) moreBtnElem.setAttribute('aria-expanded', false);
      }
    }
  });
}

// ── Date strip ─────────────────────────────────────────────────────────────

function renderDateStrip() {
  const el = document.getElementById('dateStrip');
  if (!el) return;
  const offsets = [-2, -1, 0, 1, 2, 3, 4, 5, 6];

  el.innerHTML = offsets.map(off => {
    const d = dateForOffset(off);
    const isActive = state.dayOffset === off;
    const isToday = off === 0;
    const day = d.toLocaleDateString([], { weekday: 'short' });
    const num = d.getDate();
    const mon = d.toLocaleDateString([], { month: 'short' });
    return `
      <button class="date-pill${isActive ? ' date-pill--active' : ''}${isToday ? ' date-pill--today' : ''}"
              data-offset="${off}" type="button">
        <span class="date-pill__day">${isToday ? 'Today' : day}</span>
        <span class="date-pill__num">${num} ${mon}</span>
      </button>`;
  }).join('');
}

function bindDateStrip() {
  const el = document.getElementById('dateStrip');
  if (!el) return;
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-offset]');
    if (!btn) return;
    state.dayOffset = parseInt(btn.dataset.offset, 10);
    state.expandedGameId = null;
    renderDateStrip();
    render();
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function bindTabs() {
  const el = document.getElementById('feedTabs');
  if (!el) return;
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.expandedGameId = null;
    syncTabsUI();
    render();
  });
  syncTabsUI();
}

function syncTabsUI() {
  document.querySelectorAll('#feedTabs [data-tab]').forEach(b => {
    b.classList.toggle('feed-tab--active', b.dataset.tab === state.tab);
  });
}

// ── Search ─────────────────────────────────────────────────────────────────

function bindSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  let t;
  input.addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.searchQuery = (e.target.value || '').trim().toLowerCase();
      render();
    }, 150);
  });
}

// ── Main feed render ───────────────────────────────────────────────────────

function getFilteredGames() {
  const sport = state.sport === 'all' ? undefined : state.sport;
  let games = getGames({ sport, dayOffset: state.dayOffset });

  // Tab filter
  switch (state.tab) {
    case 'live':
      games = games.filter(g => g.status === 'live' || g.status === 'halftime'); break;
    case 'finished':
      games = games.filter(g => g.status === 'final'); break;
    case 'scheduled':
      games = games.filter(g => g.status === 'scheduled'); break;
    case 'odds':
      games = games.filter(g => g.hasOdds); break;
    case 'favorites': {
      const favs = new Set(getFavorites().games);
      games = games.filter(g => favs.has(g.id)); break;
    }
    case 'all':
    default: break;
  }

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery;
    games = games.filter(g =>
      g.homeTeam.name.toLowerCase().includes(q) ||
      g.awayTeam.name.toLowerCase().includes(q) ||
      g.homeTeam.abbr.toLowerCase().includes(q) ||
      g.awayTeam.abbr.toLowerCase().includes(q) ||
      (getLeague(g.leagueId)?.name || '').toLowerCase().includes(q)
    );
  }

  return games;
}

function hasLiveGames() {
  const games = getGames({ dayOffset: state.dayOffset });
  return games.some(g => g.status === 'live' || g.status === 'halftime');
}

function groupByLeague(games) {
  const groups = new Map();
  for (const g of games) {
    if (!groups.has(g.leagueId)) groups.set(g.leagueId, []);
    groups.get(g.leagueId).push(g);
  }
  // Stable sort within each league: live first, then scheduled, then finished
  const order = { live: 0, halftime: 0, scheduled: 1, final: 2, postponed: 3, canceled: 3 };
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const oa = order[a.status] ?? 9;
      const ob = order[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return new Date(a.startTime) - new Date(b.startTime);
    });
  }
  return groups;
}

function render() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const games = getFilteredGames();
  const summary = document.getElementById('feedSummary');
  if (summary) {
    summary.textContent = `${games.length} game${games.length === 1 ? '' : 's'}`;
  }

  if (games.length === 0) {
    feed.innerHTML = renderEmptyState();
    return;
  }

  const groups = groupByLeague(games);
  const html = [...groups.entries()].map(([leagueId, gs]) => {
    const league = getLeague(leagueId);
    const liveCount = gs.filter(g => g.status === 'live' || g.status === 'halftime').length;
    return `
      <section class="lg" data-league-id="${leagueId}">
        <header class="lg__header" data-action="toggle-league">
          <button class="lg__chevron" aria-label="Collapse" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <span class="lg__country">${league?.country || ''}</span>
          <span class="lg__name">${league?.name || leagueId}</span>
          <span class="lg__count">${gs.length} game${gs.length === 1 ? '' : 's'}</span>
          ${liveCount > 0 ? `<span class="lg__live"><span class="lg__live-dot"></span>${liveCount} live</span>` : ''}
        </header>
        <div class="lg__games">
          ${gs.map(renderGameCard).join('')}
        </div>
      </section>`;
  }).join('');
  feed.innerHTML = html;

  // Restore expanded state if applicable (after re-render)
  if (state.expandedGameId) {
    const card = feed.querySelector(`[data-game-id="${state.expandedGameId}"]`);
    if (card) {
      openExpand(card);
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
    }
  }
}

function renderEmptyState() {
  const messages = {
    live:      ['No live games right now', 'Check back later or browse scheduled games.'],
    favorites: ['No favorited games on this day', 'Star games to save them here.'],
    odds:     ['No games with odds for this filter', 'Try a different sport or date.'],
    finished: ['No finished games', 'Try a different date.'],
    scheduled:['No scheduled games', 'Try a different date or sport.'],
    all:      ['No games found', 'Try a different sport or date.'],
  };
  const [title, sub] = messages[state.tab] || messages.all;
  return `
    <div class="empty">
      <div class="empty__icon">📭</div>
      <div class="empty__title">${title}</div>
      <div class="empty__sub">${sub}</div>
    </div>`;
}

// ── Global event delegation ────────────────────────────────────────────────

function bindGlobalEvents() {
  const feed = document.getElementById('feed');
  if (!feed) return;

  feed.addEventListener('click', e => {
    // League collapse
    const leagueHeader = e.target.closest('[data-action="toggle-league"]');
    if (leagueHeader) {
      const lg = leagueHeader.closest('.lg');
      lg.classList.toggle('lg--collapsed');
      return;
    }

    // Favorite toggle (don't bubble to card-click)
    const favBtn = e.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      e.stopPropagation();
      const card = favBtn.closest('[data-game-id]');
      const id = card?.dataset.gameId;
      if (!id) return;
      toggleFavoriteGame(id);
      const nowOn = isGameFavorited(id);
      favBtn.classList.toggle('gc__fav--on', nowOn);
      favBtn.querySelector('svg').setAttribute('fill', nowOn ? 'currentColor' : 'none');
      return;
    }

    // Odds expand toggle
    const oddsToggle = e.target.closest('[data-action="toggle-odds"]')
                    || e.target.closest('.gc__odds-toggle');
    if (oddsToggle) {
      e.stopPropagation();
      const card = oddsToggle.closest('[data-game-id]');
      if (!card) return;
      toggleExpand(card);
      return;
    }

    // Odds market tab inside the expanded panel
    const oddsTab = e.target.closest('.odds-tab');
    if (oddsTab) {
      e.stopPropagation();
      const wrap = oddsTab.closest('.odds-expand');
      wrap.querySelectorAll('.odds-tab').forEach(t => t.classList.remove('odds-tab--active'));
      oddsTab.classList.add('odds-tab--active');
      const market = oddsTab.dataset.market;
      const tableEl = wrap.querySelector('.odds-expand__table');
      const gameId = tableEl.dataset.gameId;
      const game = getGameById(gameId);
      if (game) {
        const odds = getOddsForGame(gameId);
        tableEl.innerHTML = renderOddsTable(game, odds, market);
      }
      return;
    }

    // Click-row → expand odds (everything except buttons & links)
    const card = e.target.closest('.gc');
    if (card && !e.target.closest('button') && !e.target.closest('a')) {
      toggleExpand(card);
    }
  });
}

function toggleExpand(card) {
  const id = card.dataset.gameId;
  if (state.expandedGameId === id) {
    closeExpand(card);
    state.expandedGameId = null;
  } else {
    // Close any other open expand
    if (state.expandedGameId) {
      const prev = document.querySelector(`[data-game-id="${state.expandedGameId}"]`);
      if (prev) closeExpand(prev);
    }
    openExpand(card);
    state.expandedGameId = id;
  }
}

function openExpand(card) {
  const id = card.dataset.gameId;
  const game = getGameById(id);
  if (!game) return;
  const slot = card.querySelector('.gc__expand');
  if (!slot) return;
  
  // Show loading state briefly
  slot.innerHTML = `<div class="odds-expand" style="padding: 16px; text-align: center; color: var(--text-muted);">Loading odds…</div>`;
  slot.hidden = false;
  card.classList.add('gc--expanded');
  
  // Simulate network delay for visual feedback
  setTimeout(() => {
    slot.innerHTML = renderExpandedOdds(game);
  }, 150);
}

function closeExpand(card) {
  const slot = card.querySelector('.gc__expand');
  if (!slot) return;
  slot.hidden = true;
  slot.innerHTML = '';
  card.classList.remove('gc--expanded');
}

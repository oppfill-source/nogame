// ── Home view ────────────────────────────────────────────────────────────────
// Renders: date selector, status filter tabs, league-grouped game feed.
// Replaces the inline rendering that was previously in app.js.

import {
  getGames, getLeague, dateForOffset, getGameById
} from '../mockData.js';
import { getOddsForGame } from '../mockData.js';
import { renderGameCard, renderExpandedOdds, renderOddsTable } from '../gameCard.js';
import { getFavorites } from '../favorites.js';
import { state } from '../state.js';

// ── Date selector ─────────────────────────────────────────────────────────────

export function renderDateSelector() {
  const slots = [
    { label: 'Yesterday', sub: null, offset: -1 },
    { label: 'Today',     sub: null, offset: 0  },
    { label: 'Tomorrow',  sub: null, offset: 1  },
    { label: 'Weekend',   sub: null, offset: nextWeekendOffset() },
  ];

  // Also render a small extra window of raw dates (+2 through +6)
  const extras = [2, 3, 4, 5, 6].filter(o => o !== nextWeekendOffset());

  return `
    <div class="home-dates">
      ${slots.map(s => {
        const d = dateForOffset(s.offset);
        const mon = d.toLocaleDateString([], { month: 'short' });
        const day = d.getDate();
        const active = state.dayOffset === s.offset;
        return `
          <button class="home-date-btn${active ? ' home-date-btn--active' : ''}"
                  data-offset="${s.offset}" type="button">
            <span class="home-date-btn__label">${s.label}</span>
            <span class="home-date-btn__sub">${day} ${mon}</span>
          </button>`;
      }).join('')}
      ${extras.map(off => {
        const d = dateForOffset(off);
        const dayName = d.toLocaleDateString([], { weekday: 'short' });
        const day = d.getDate();
        const mon = d.toLocaleDateString([], { month: 'short' });
        const active = state.dayOffset === off;
        return `
          <button class="home-date-btn${active ? ' home-date-btn--active' : ''}"
                  data-offset="${off}" type="button">
            <span class="home-date-btn__label">${dayName}</span>
            <span class="home-date-btn__sub">${day} ${mon}</span>
          </button>`;
      }).join('')}
    </div>`;
}

function nextWeekendOffset() {
  const dow = new Date().getDay(); // 0=Sun, 6=Sat
  if (dow === 6) return 0; // today is Saturday
  if (dow === 0) return 0; // today is Sunday
  return 6 - dow; // days until Saturday
}

// ── Status filter tabs ────────────────────────────────────────────────────────

export function renderStatusFilter(games) {
  const liveCount = games.filter(g => g.status === 'live' || g.status === 'halftime').length;
  const tabs = [
    { id: 'all',       label: 'All',       badge: null },
    { id: 'live',      label: 'Live',      badge: liveCount > 0 ? liveCount : null, dot: true },
    { id: 'odds',      label: 'Odds',      badge: null },
    { id: 'finished',  label: 'Finished',  badge: null },
    { id: 'scheduled', label: 'Upcoming',  badge: null },
    { id: 'favorites', label: '★ Saved',   badge: null },
  ];

  return `
    <div class="home-filter-bar">
      <div class="home-filter-tabs" role="tablist">
        ${tabs.map(t => `
          <button class="home-filter-tab${state.tab === t.id ? ' home-filter-tab--active' : ''}"
                  data-tab="${t.id}" type="button" role="tab"
                  aria-selected="${state.tab === t.id}">
            ${t.dot && liveCount > 0 ? '<span class="home-filter-tab__dot"></span>' : ''}
            ${t.label}
            ${t.badge != null ? `<span class="home-filter-tab__badge">${t.badge}</span>` : ''}
          </button>
        `).join('')}
      </div>
      <span class="home-filter-count" id="feedSummary"></span>
    </div>`;
}

// ── Feed rendering ────────────────────────────────────────────────────────────

export function getFilteredGames() {
  const sport = state.sport === 'all' ? undefined : state.sport;
  let games = getGames({ sport, dayOffset: state.dayOffset });

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
    default: break;
  }

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

export function groupByLeague(games) {
  const groups = new Map();
  for (const g of games) {
    if (!groups.has(g.leagueId)) groups.set(g.leagueId, []);
    groups.get(g.leagueId).push(g);
  }
  const order = { live: 0, halftime: 0, scheduled: 1, final: 2, postponed: 3, canceled: 3 };
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (diff !== 0) return diff;
      return new Date(a.startTime) - new Date(b.startTime);
    });
  }
  return groups;
}

export function renderFeed(games) {
  if (games.length === 0) return renderEmptyState();

  const groups = groupByLeague(games);
  return [...groups.entries()].map(([leagueId, gs]) => {
    const league = getLeague(leagueId);
    const sportId = league?.sportId || '';
    const liveCount = gs.filter(g => g.status === 'live' || g.status === 'halftime').length;
    const hasOdds = gs.some(g => g.hasOdds);
    return `
      <section class="lg" data-league-id="${leagueId}" data-sport="${sportId}">
        <header class="lg__header" data-action="toggle-league">
          <button class="lg__chevron" aria-label="Collapse" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <span class="lg__country">${league?.country || ''}</span>
          <a class="lg__name" href="#league/${leagueId}" data-action="league-link"
             style="text-decoration:none;color:inherit;transition:color .12s"
             onmouseover="this.style.color='var(--green)'"
             onmouseout="this.style.color='inherit'">
            ${league?.name || leagueId}
          </a>
          <span class="lg__count">${gs.length} game${gs.length === 1 ? '' : 's'}</span>
          ${liveCount > 0 ? `<span class="lg__live"><span class="lg__live-dot"></span>${liveCount} live</span>` : ''}
        </header>
        ${hasOdds ? `
        <div class="lg__col-header">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span>1</span>
          <span>2</span>
          <span></span>
          <span></span>
        </div>` : ''}
        <div class="lg__games">
          ${gs.map(g => renderGameRow(g)).join('')}
        </div>
      </section>`;
  }).join('');
}

// ── Game row (extended from renderGameCard) ───────────────────────────────────
// Clicking the row navigates to game detail.
// Clicking the odds widget opens the inline expand (quick view).

function renderGameRow(game) {
  // Delegate to existing renderGameCard — it already handles favorites,
  // odds preview, status, expand slot.
  return renderGameCard(game);
}

// ── Full home view ────────────────────────────────────────────────────────────

export function renderHomeView() {
  const allGames = getGames({ dayOffset: state.dayOffset });
  const filtered = getFilteredGames();

  return `
    <div class="home-view">
      ${renderDateSelector()}
      ${renderStatusFilter(allGames)}
      <div id="feed" class="feed home-feed"></div>
    </div>`;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function renderEmptyState() {
  const messages = {
    live:      ['No live games right now', 'Check back later or browse scheduled games.'],
    favorites: ['No saved games on this day', 'Star ★ any game to save it here.'],
    odds:      ['No games with odds for this filter', 'Try a different sport or date.'],
    finished:  ['No finished games', 'Try a different date.'],
    scheduled: ['No upcoming games', 'Try a different date or sport.'],
    all:       ['No games found', 'Try a different sport or date.'],
  };
  const [title, sub] = messages[state.tab] || messages.all;
  return `
    <div class="empty">
      <div class="empty__icon">📭</div>
      <div class="empty__title">${title}</div>
      <div class="empty__sub">${sub}</div>
    </div>`;
}

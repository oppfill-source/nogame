// ── Game detail view ─────────────────────────────────────────────────────────
// Renders the full game detail page for #game/{id}.
// Tabs: Summary | Odds | Stats | Lineups | H2H | Standings | News | Injuries

import { getGameById, getOddsForGame, getLeague } from '../mockData.js';
import { SPORTSBOOKS } from '../sportsbooks.js';
import {
  getBestOddsByMarket, isBestOdds, formatOdds, formatLine
} from '../bestOdds.js';
import { formatOddsInFormat, formatImpliedProb } from '../oddsFormat.js';
import { state, setState } from '../state.js';
import { navigate } from '../router.js';

const TABS = [
  { id: 'summary',   label: 'Summary'  },
  { id: 'odds',      label: 'Odds'     },
  { id: 'stats',     label: 'Stats'    },
  { id: 'lineups',   label: 'Lineups'  },
  { id: 'h2h',       label: 'H2H'      },
  { id: 'standings', label: 'Standings'},
  { id: 'news',      label: 'News'     },
  { id: 'injuries',  label: 'Injuries' },
];

const MARKETS = [
  { id: 'moneyline', label: 'Moneyline' },
  { id: 'spread',    label: 'Spread'    },
  { id: 'total',     label: 'Total'     },
];

// ── Team sport emoji map ──────────────────────────────────────────────────────
const SPORT_EMOJI = {
  nfl: '🏈', ncaaf: '🏈',
  nba: '🏀', ncaab: '🏀',
  mlb: '⚾', nhl: '🏒',
  soccer: '⚽', tennis: '🎾',
  mma: '🥊', boxing: '🥊',
  golf: '⛳', motor: '🏁',
};

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadgeHTML(game) {
  switch (game.status) {
    case 'live':
      return `<span class="detail-status__badge detail-status__badge--live">${game.period ?? 'Live'}${game.clock ? ' ' + game.clock : ''}</span>`;
    case 'halftime':
      return `<span class="detail-status__badge detail-status__badge--live">${game.period ?? 'HT'}</span>`;
    case 'final':
      return `<span class="detail-status__badge detail-status__badge--final">Final</span>`;
    case 'postponed':
      return `<span class="detail-status__badge detail-status__badge--scheduled" style="color:var(--amber);border-color:rgba(245,158,11,.3)">Postponed</span>`;
    default: {
      const t = new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const d = new Date(game.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      return `<span class="detail-status__badge detail-status__badge--scheduled">${d} · ${t}</span>`;
    }
  }
}

function scoreClass(game, side) {
  const mine = side === 'home' ? game.homeScore : game.awayScore;
  const theirs = side === 'home' ? game.awayScore : game.homeScore;
  const isOver = game.status === 'final' || game.status === 'live' || game.status === 'halftime';
  if (!isOver || mine == null || theirs == null) return '';
  return mine > theirs ? ' detail-score--lead' : ' detail-score--trail';
}

// ── Game header ───────────────────────────────────────────────────────────────

function renderGameHeader(game) {
  const league = getLeague(game.leagueId);
  const emoji = SPORT_EMOJI[game.sportId] ?? '🏆';
  const dateStr = new Date(game.startTime).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(game.startTime).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  const awayScore = game.awayScore ?? '—';
  const homeScore = game.homeScore ?? '—';

  return `
    <div class="detail-header">
      <div class="detail-header__meta">
        <span>${emoji}</span>
        <span>${league?.name ?? game.leagueId}</span>
        <span class="detail-header__meta-sep">·</span>
        <span>${league?.season ?? ''}</span>
        <span class="detail-header__meta-sep">·</span>
        <span>${dateStr}</span>
      </div>

      <div class="detail-scoreboard">
        <!-- Away team -->
        <div class="detail-team detail-team--away">
          <div class="detail-team__logo">${emoji}</div>
          <div class="detail-team__city">${game.awayTeam.city}</div>
          <div class="detail-team__name">${game.awayTeam.name}</div>
        </div>

        <!-- Score block -->
        <div class="detail-score-block">
          <div class="detail-score-numbers">
            <span class="${scoreClass(game, 'away')}">${awayScore}</span>
            <span class="detail-score-sep">–</span>
            <span class="${scoreClass(game, 'home')}">${homeScore}</span>
          </div>
          <div class="detail-status">
            ${statusBadgeHTML(game)}
            <span class="detail-status__time">${timeStr}</span>
          </div>
        </div>

        <!-- Home team -->
        <div class="detail-team detail-team--home">
          <div class="detail-team__logo">${emoji}</div>
          <div class="detail-team__city">${game.homeTeam.city}</div>
          <div class="detail-team__name">${game.homeTeam.name}</div>
        </div>
      </div>

      <div class="detail-header__venue">📍 ${game.venue}</div>

      <!-- Tabs -->
      <div class="detail-tabs" role="tablist" id="detailTabsBar">
        ${TABS.map(t => `
          <button class="detail-tab${state.detailTab === t.id ? ' detail-tab--active' : ''}"
                  data-tab="${t.id}" type="button" role="tab"
                  aria-selected="${state.detailTab === t.id}">
            ${t.label}
          </button>
        `).join('')}
      </div>
    </div>`;
}

// ── Odds tab ──────────────────────────────────────────────────────────────────

function renderOddsTab(game) {
  const odds = getOddsForGame(game.id);
  if (!odds.length) {
    return `
      <div class="detail-tab-placeholder">
        <div class="detail-tab-placeholder__icon">📊</div>
        <div class="detail-tab-placeholder__title">No odds available</div>
        <div class="detail-tab-placeholder__sub">Check back closer to game time</div>
      </div>`;
  }

  const market = state.detailMarket;
  const { bestByGroup } = getBestOddsByMarket(odds, market);

  // Columns
  const cols = market === 'total'
    ? [{ sel: 'over', label: 'Over' }, { sel: 'under', label: 'Under' }]
    : [{ sel: 'away', label: game.awayTeam.name }, { sel: 'home', label: game.homeTeam.name }];

  // Book rows — only books with data for this market
  const rows = SPORTSBOOKS.map(book => {
    const bookOdds = odds.filter(o => o.sportsbookId === book.id && o.marketType === market);
    return { book, odds: bookOdds };
  }).filter(r => r.odds.length > 0);

  const fmt = state.oddsFormat;

  return `
    <div class="detail-odds">
      <!-- Market selector -->
      <div class="detail-market-selector">
        ${MARKETS.map(m => `
          <button class="detail-market-btn${state.detailMarket === m.id ? ' detail-market-btn--active' : ''}"
                  data-market="${m.id}" type="button">
            ${m.label}
          </button>
        `).join('')}
      </div>

      <!-- Odds table -->
      <table class="detail-odds-table">
        <thead>
          <tr>
            <th>Sportsbook</th>
            ${cols.map(c => `<th>${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ book, odds: bookOdds }) => `
            <tr>
              <td>
                <div class="dot__book">
                  <span class="dot__book-color" style="background:${book.color}"></span>
                  <span class="dot__book-name">${book.name}</span>
                </div>
              </td>
              ${cols.map(c => {
                const o = bookOdds.find(x => x.selection === c.sel);
                if (!o) return `<td class="dot__cell dot__cell--empty">—</td>`;
                const best = isBestOdds(o, bestByGroup);
                const lineLabel = market === 'spread' ? formatLine(o.line, true)
                                : market === 'total'  ? formatLine(o.line, false)
                                : '';
                return `
                  <td class="dot__cell${best ? ' dot__cell--best' : ''}">
                    <div class="dot__cell-inner">
                      ${lineLabel ? `<span class="dot__line">${lineLabel}</span>` : ''}
                      <span class="dot__odds">${formatOddsInFormat(o.oddsAmerican, fmt)}</span>
                      <span class="dot__prob">${formatImpliedProb(o.oddsAmerican)}</span>
                      ${best ? `<span class="dot__best-badge">★ Best</span>` : ''}
                    </div>
                  </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="detail-odds-footer">
        <span>Odds updated: ${fmtRelative(odds[0]?.updatedAt)}</span>
        <span>Must be 21+ · Availability varies by state · Not an offer to bet</span>
      </div>
    </div>`;
}

function fmtRelative(iso) {
  if (!iso) return 'just now';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function renderSummaryTab(game) {
  const isOver = game.status === 'final';
  const isLive = game.status === 'live' || game.status === 'halftime';

  return `
    <div class="detail-summary">
      ${isOver || isLive ? `
        <div class="detail-summary__section-title">Score</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;margin-bottom:20px;align-items:center;text-align:center">
          <div>
            <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">${game.awayTeam.abbr}</div>
            <div style="font-size:2rem;font-weight:800;color:var(--text)">${game.awayScore ?? '—'}</div>
          </div>
          <div style="color:var(--text-muted);font-size:1.2rem">–</div>
          <div>
            <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">${game.homeTeam.abbr}</div>
            <div style="font-size:2rem;font-weight:800;color:var(--text)">${game.homeScore ?? '—'}</div>
          </div>
        </div>
      ` : `
        <div style="padding:16px;background:var(--surface);border-radius:10px;margin-bottom:16px">
          <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">Kickoff / Start</div>
          <div style="font-size:.95rem;font-weight:600;color:var(--text)">
            ${new Date(game.startTime).toLocaleString([], {
              weekday:'long', month:'long', day:'numeric',
              hour:'numeric', minute:'2-digit', timeZoneName:'short'
            })}
          </div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:4px">📍 ${game.venue}</div>
        </div>
      `}

      <div class="detail-summary__section-title">Quick Odds</div>
      <div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">
        Open the <button onclick="document.querySelector('[data-tab=\\'odds\\']').click()"
          style="background:none;border:none;color:var(--green);font-weight:600;cursor:pointer;padding:0;font-family:inherit;font-size:inherit">
          Odds tab</button> for the full sportsbook comparison table.
      </div>
    </div>`;
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────

function renderPlaceholderTab(icon, title, sub) {
  return `
    <div class="detail-tab-placeholder">
      <div class="detail-tab-placeholder__icon">${icon}</div>
      <div class="detail-tab-placeholder__title">${title}</div>
      <div class="detail-tab-placeholder__sub">${sub}</div>
    </div>`;
}

function renderTabContent(game) {
  switch (state.detailTab) {
    case 'summary':   return renderSummaryTab(game);
    case 'odds':      return renderOddsTab(game);
    case 'stats':     return renderPlaceholderTab('📈', 'Stats coming soon', 'Live box score and detailed stats will appear here once a data feed is connected.');
    case 'lineups':   return renderPlaceholderTab('📋', 'Lineups coming soon', 'Starting rosters and depth charts will appear here.');
    case 'h2h':       return renderPlaceholderTab('⚔️', 'Head-to-Head coming soon', 'Last 10 matchups between these teams will appear here.');
    case 'standings': return renderPlaceholderTab('🏆', 'Standings coming soon', 'Current league standings will appear here.');
    case 'news':      return renderPlaceholderTab('📰', 'News coming soon', 'Related news articles will appear here.');
    case 'injuries':  return renderPlaceholderTab('🏥', 'Injury report coming soon', 'Official injury designations will appear here.');
    default:          return renderSummaryTab(game);
  }
}

// ── Full view ─────────────────────────────────────────────────────────────────

export function renderGameDetailView(gameId) {
  const game = getGameById(gameId);

  if (!game) {
    return `
      <div style="padding:40px 20px;text-align:center">
        <div style="font-size:2rem;margin-bottom:12px">🔍</div>
        <div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:6px">Game not found</div>
        <div style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">The game ID "${gameId}" could not be found.</div>
        <button class="btn btn--sm btn--outline" onclick="window.location.hash=''">← Back to scores</button>
      </div>`;
  }

  return `
    <div class="detail-view">
      <a class="detail-back" href="#" onclick="history.length>1?history.back():(window.location.hash='');return false;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to scores
      </a>

      ${renderGameHeader(game)}

      <div class="detail-content" id="detailTabContent">
        ${renderTabContent(game)}
      </div>
    </div>`;
}

/**
 * Bind tab and market clicks inside the detail view.
 * Called after mounting the view.
 */
export function bindDetailView(el, onRefresh) {
  if (!el) return;

  el.addEventListener('click', e => {
    // Detail tab switch
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn && tabBtn.closest('#detailTabsBar')) {
      setState({ detailTab: tabBtn.dataset.tab });
      // Re-render only the content area
      const content = el.querySelector('#detailTabContent');
      if (content) {
        const gameId = el.querySelector('.detail-view')?.dataset?.gameId ||
          window.location.hash.replace('#game/', '');
        const game = getGameById(gameId);
        if (game) content.innerHTML = renderTabContent(game);
      }
      // Sync active tab styles
      el.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('detail-tab--active', b.dataset.tab === state.detailTab);
        b.setAttribute('aria-selected', b.dataset.tab === state.detailTab);
      });
      return;
    }

    // Market selector
    const marketBtn = e.target.closest('[data-market]');
    if (marketBtn) {
      setState({ detailMarket: marketBtn.dataset.market });
      const content = el.querySelector('#detailTabContent');
      if (content && state.detailTab === 'odds') {
        const gameId = window.location.hash.replace(/^#game\//, '');
        const game = getGameById(gameId);
        if (game) content.innerHTML = renderOddsTab(game);
      }
      return;
    }
  });
}

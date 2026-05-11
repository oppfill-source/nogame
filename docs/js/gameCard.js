// ── GameCard component ──────────────────────────────────────────────────────
// Renders a single game as a desktop row / mobile card. Includes the
// expandable odds preview. Uses event delegation from the parent feed —
// this module exports pure render functions returning HTML strings.

import { getOddsForGame } from './mockData.js';
import {
  getBestOddsByMarket, isBestOdds, formatOdds, formatLine, oddsGroupKey
} from './bestOdds.js';
import { getSportsbook, SPORTSBOOKS } from './sportsbooks.js';
import { isGameFavorited } from './favorites.js';

// ── Time / status helpers ──────────────────────────────────────────────────

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusBlockHTML(game) {
  switch (game.status) {
    case 'live':
      return `
        <div class="gc__status gc__status--live">
          <span class="gc__live-dot"></span>
          <span class="gc__period">${game.period ?? 'Live'}</span>
          ${game.clock ? `<span class="gc__clock">${game.clock}</span>` : ''}
        </div>`;
    case 'halftime':
      return `<div class="gc__status gc__status--live">
        <span class="gc__period">${game.period ?? 'HT'}</span>
      </div>`;
    case 'final':
      return `<div class="gc__status gc__status--final">FINAL</div>`;
    case 'postponed':
      return `<div class="gc__status gc__status--postponed">PPD</div>`;
    case 'canceled':
      return `<div class="gc__status gc__status--postponed">CXL</div>`;
    case 'scheduled':
    default:
      return `<div class="gc__status gc__status--scheduled">${fmtTime(game.startTime)}</div>`;
  }
}

function pickBest(group, bestByGroup) {
  if (!group || group.length === 0) return null;
  const winners = bestByGroup.get(group[0] ? oddsGroupKey(group[0]) : '');
  if (!winners) return group[0];
  return group.find(o => winners.has(o.sportsbookId)) || group[0];
}

// ── Expanded odds table (renders on demand) ────────────────────────────────

export function renderExpandedOdds(game) {
  if (!game.hasOdds) {
    return `<div class="odds-expand__empty">No odds available for this game.</div>`;
  }
  const odds = getOddsForGame(game.id);
  return `
    <div class="odds-expand">
      <div class="odds-expand__tabs" role="tablist">
        <button class="odds-tab odds-tab--active" data-market="moneyline" type="button">Moneyline</button>
        <button class="odds-tab" data-market="spread" type="button">Spread</button>
        <button class="odds-tab" data-market="total" type="button">Total</button>
      </div>
      <div class="odds-expand__table" data-game-id="${game.id}">
        ${renderOddsTable(game, odds, 'moneyline')}
      </div>
      <div class="odds-expand__footer">
        <span class="odds-expand__updated">Last updated: ${fmtRelative(odds[0]?.updatedAt)}</span>
        <span class="odds-expand__note">Odds informational only · availability varies by state</span>
      </div>
    </div>`;
}

export function renderOddsTable(game, odds, marketType) {
  const { bestByGroup } = getBestOddsByMarket(odds, marketType);
  // Build per-book rows
  const rows = SPORTSBOOKS.map(book => {
    const bookOdds = odds.filter(o => o.sportsbookId === book.id && o.marketType === marketType);
    return { book, odds: bookOdds };
  }).filter(r => r.odds.length > 0);

  // Header columns depend on market
  const cols = marketType === 'moneyline'
    ? [{ sel: 'away', label: game.awayTeam.abbr }, { sel: 'home', label: game.homeTeam.abbr }]
    : marketType === 'spread'
      ? [{ sel: 'away', label: game.awayTeam.abbr }, { sel: 'home', label: game.homeTeam.abbr }]
      : [{ sel: 'over', label: 'Over' }, { sel: 'under', label: 'Under' }];

  return `
    <table class="odds-table">
      <thead>
        <tr>
          <th class="odds-table__book-col">Sportsbook</th>
          ${cols.map(c => `<th>${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(({ book, odds: bookOdds }) => `
          <tr>
            <td class="odds-table__book">
              <span class="odds-table__book-mark" style="background:${book.color}"></span>
              <span class="odds-table__book-emoji">${book.emoji}</span>
              <span class="odds-table__book-name">${book.name}</span>
            </td>
            ${cols.map(c => {
              const o = bookOdds.find(x => x.selection === c.sel);
              if (!o) return `<td class="odds-table__cell odds-table__cell--empty">—</td>`;
              const best = isBestOdds(o, bestByGroup);
              const lineLabel = marketType === 'spread' ? formatLine(o.line, true)
                              : marketType === 'total'  ? formatLine(o.line, false)
                              : '';
              return `
                <td class="odds-table__cell${best ? ' odds-table__cell--best' : ''}">
                  ${lineLabel ? `<span class="odds-table__line">${lineLabel}</span>` : ''}
                  <span class="odds-table__odds">${formatOdds(o.oddsAmerican)}</span>
                  ${best ? `<span class="odds-table__best-badge">Best</span>` : ''}
                </td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function fmtRelative(iso) {
  if (!iso) return 'just now';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

// ── Flat ML cell (single best odds value for one side) ─────────────────────

function mlCellHTML(game, side) {
  if (!game.hasOdds) {
    return `<div class="gc__ml-col"><span class="gc__ml-val gc__ml-val--none">—</span></div>`;
  }
  const odds = getOddsForGame(game.id);
  const { groups, bestByGroup } = getBestOddsByMarket(odds, 'moneyline');
  const key = `moneyline::${side}::`;
  const group = groups.get(key) || [];
  const best = pickBest(group, bestByGroup);
  if (!best) {
    return `<div class="gc__ml-col"><span class="gc__ml-val gc__ml-val--none">—</span></div>`;
  }
  const bestCls = isBestOdds(best, bestByGroup) ? ' gc__ml-val--best' : '';
  return `<div class="gc__ml-col"><span class="gc__ml-val${bestCls}">${formatOdds(best.oddsAmerican)}</span></div>`;
}

// ── Score block (away – home, single line) ─────────────────────────────────

function scoreBlockHTML(game) {
  const hasScore = game.awayScore != null && game.homeScore != null;
  if (!hasScore) return `<div class="gc__score-block gc__score-block--empty">vs</div>`;

  const awayLead = game.awayScore > game.homeScore;
  const homeLead = game.homeScore > game.awayScore;
  const isActive = game.status === 'live' || game.status === 'halftime' || game.status === 'final';

  return `<div class="gc__score-block">
    <span class="gc__score${isActive && awayLead ? ' gc__score--lead' : ''}">${game.awayScore}</span>
    <span class="gc__score-sep">–</span>
    <span class="gc__score${isActive && homeLead ? ' gc__score--lead' : ''}">${game.homeScore}</span>
  </div>`;
}

// ── Card render ────────────────────────────────────────────────────────────

export function renderGameCard(game) {
  const fav = isGameFavorited(game.id);
  const liveCls = game.status === 'live' || game.status === 'halftime' ? ' gc--live' : '';
  return `
    <article class="gc${liveCls}" data-game-id="${game.id}" data-status="${game.status}" data-sport="${game.sportId || ''}">
      <div class="gc__main">
        <div class="gc__status-col">${statusBlockHTML(game)}</div>
        <div class="gc__team-away">
          <span class="gc__team-abbr">${game.awayTeam.abbr}</span>
          <span class="gc__team-name">${game.awayTeam.name}</span>
        </div>
        ${scoreBlockHTML(game)}
        <div class="gc__team-home">
          <span class="gc__team-abbr">${game.homeTeam.abbr}</span>
          <span class="gc__team-name">${game.homeTeam.name}</span>
        </div>
        ${mlCellHTML(game, 'away')}
        ${mlCellHTML(game, 'home')}
        <button class="gc__expand-btn" data-action="toggle-odds" aria-label="Show odds" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="gc__fav${fav ? ' gc__fav--on' : ''}" data-action="toggle-fav" aria-label="${fav ? 'Unfavorite' : 'Favorite'} this game" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
      <div class="gc__expand" hidden></div>
    </article>`;
}

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

function scoreHTML(game, side) {
  const score = side === 'home' ? game.homeScore : game.awayScore;
  if (score == null) return `<span class="gc__score gc__score--empty">—</span>`;
  // Highlight the leading side once the game is final
  const otherScore = side === 'home' ? game.awayScore : game.homeScore;
  const leading = (game.status === 'final' || game.status === 'live' || game.status === 'halftime')
    && otherScore != null && score > otherScore;
  return `<span class="gc__score${leading ? ' gc__score--lead' : ''}">${score}</span>`;
}

// ── Best-odds preview (3 columns: home ML, draw/spread, away ML) ───────────
// Compact preview shown in the card row. Uses moneyline by default; for
// soccer with possible draws we still show home/away (draw shown only in
// the expanded panel to keep desktop rows compact).

function previewMLHTML(game) {
  if (!game.hasOdds) {
    return `<div class="gc__odds-preview gc__odds-preview--empty">No odds</div>`;
  }
  const odds = getOddsForGame(game.id);
  const { groups, bestByGroup } = getBestOddsByMarket(odds, 'moneyline');

  const homeGroup = groups.get('moneyline::home::') || [];
  const awayGroup = groups.get('moneyline::away::') || [];

  const bestHome = pickBest(homeGroup, bestByGroup);
  const bestAway = pickBest(awayGroup, bestByGroup);

  return `
    <div class="gc__odds-preview" data-action="toggle-odds">
      <div class="gc__odds-cell">
        <span class="gc__odds-label">${game.awayTeam.abbr}</span>
        <span class="gc__odds-val">${formatOdds(bestAway?.oddsAmerican)}</span>
      </div>
      <div class="gc__odds-cell">
        <span class="gc__odds-label">${game.homeTeam.abbr}</span>
        <span class="gc__odds-val">${formatOdds(bestHome?.oddsAmerican)}</span>
      </div>
      <button class="gc__odds-toggle" aria-label="Show all odds" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>`;
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

// ── Card render ────────────────────────────────────────────────────────────

export function renderGameCard(game) {
  const fav = isGameFavorited(game.id);
  const liveCls = game.status === 'live' || game.status === 'halftime' ? ' gc--live' : '';
  return `
    <article class="gc${liveCls}" data-game-id="${game.id}" data-status="${game.status}">
      <div class="gc__main">
        <div class="gc__status-col">
          ${statusBlockHTML(game)}
        </div>
        <div class="gc__teams">
          <div class="gc__team">
            <span class="gc__team-abbr">${game.awayTeam.abbr}</span>
            <span class="gc__team-name">${game.awayTeam.name}</span>
            ${scoreHTML(game, 'away')}
          </div>
          <div class="gc__team">
            <span class="gc__team-abbr">${game.homeTeam.abbr}</span>
            <span class="gc__team-name">${game.homeTeam.name}</span>
            ${scoreHTML(game, 'home')}
          </div>
        </div>
        <div class="gc__odds-col">
          ${previewMLHTML(game)}
        </div>
        <button class="gc__fav${fav ? ' gc__fav--on' : ''}" data-action="toggle-fav" aria-label="${fav ? 'Unfavorite' : 'Favorite'} this game" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
      <div class="gc__expand" hidden></div>
    </article>`;
}

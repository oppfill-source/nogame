// ── Game detail view ─────────────────────────────────────────────────────────
// Renders the full game detail page for #game/{id}.
// Tabs: Summary | Odds | Stats | H2H | Standings | Lineups | News | Injuries
// Odds / Stats / H2H / Standings load asynchronously; other tabs are instant.

import { getGameById, getOddsForGame, getLeague } from '../mockData.js';
import { getSportsbook } from '../sportsbooks.js';
import {
  getBestOddsByMarket, isBestOdds, formatOdds, formatLine
} from '../bestOdds.js';
import { formatOddsInFormat, formatImpliedProb } from '../oddsFormat.js';
import { state, setState } from '../state.js';
import {
  fetchRealOdds, fetchPlayerProps, fetchGameStats,
  fetchH2H, fetchStandings, PROP_LABEL,
} from '../detailApi.js?v=4';

const TABS = [
  { id: 'summary',   label: 'Summary'   },
  { id: 'odds',      label: 'Odds'      },
  { id: 'stats',     label: 'Stats'     },
  { id: 'h2h',       label: 'H2H'       },
  { id: 'standings', label: 'Standings' },
  { id: 'lineups',   label: 'Lineups'   },
  { id: 'news',      label: 'News'      },
  { id: 'injuries',  label: 'Injuries'  },
];

const MARKETS = [
  { id: 'moneyline', label: 'Moneyline' },
  { id: 'spread',    label: 'Spread'    },
  { id: 'total',     label: 'Total'     },
  { id: 'props',     label: 'Props'     },
];

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
  const mine   = side === 'home' ? game.homeScore : game.awayScore;
  const theirs = side === 'home' ? game.awayScore : game.homeScore;
  const active = game.status === 'final' || game.status === 'live' || game.status === 'halftime';
  if (!active || mine == null || theirs == null) return '';
  return mine > theirs ? ' detail-score--lead' : ' detail-score--trail';
}

// ── Game header ───────────────────────────────────────────────────────────────

function renderGameHeader(game) {
  const league  = getLeague(game.leagueId);
  const emoji   = SPORT_EMOJI[game.sportId] ?? '🏆';
  const dateStr = new Date(game.startTime).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(game.startTime).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

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
        <div class="detail-team detail-team--away">
          <div class="detail-team__logo">${emoji}</div>
          <div class="detail-team__city">${game.awayTeam.city}</div>
          <div class="detail-team__name">${game.awayTeam.name}</div>
        </div>

        <div class="detail-score-block">
          <div class="detail-score-numbers">
            <span class="${scoreClass(game, 'away')}">${game.awayScore ?? '—'}</span>
            <span class="detail-score-sep">–</span>
            <span class="${scoreClass(game, 'home')}">${game.homeScore ?? '—'}</span>
          </div>
          <div class="detail-status">
            ${statusBadgeHTML(game)}
            <span class="detail-status__time">${timeStr}</span>
          </div>
        </div>

        <div class="detail-team detail-team--home">
          <div class="detail-team__logo">${emoji}</div>
          <div class="detail-team__city">${game.homeTeam.city}</div>
          <div class="detail-team__name">${game.homeTeam.name}</div>
        </div>
      </div>

      <div class="detail-header__venue">📍 ${game.venue}</div>

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

// ── Loading skeleton ──────────────────────────────────────────────────────────

function renderLoadingSkeleton(label = '') {
  return `
    <div class="detail-skeleton">
      ${label ? `<div class="detail-skeleton__label">${label}</div>` : ''}
      <div class="detail-skeleton__line" style="width:60%"></div>
      <div class="detail-skeleton__line" style="width:100%"></div>
      <div class="detail-skeleton__line" style="width:100%"></div>
      <div class="detail-skeleton__line" style="width:85%"></div>
      <div class="detail-skeleton__line" style="width:100%"></div>
      <div class="detail-skeleton__line" style="width:100%"></div>
      <div class="detail-skeleton__line" style="width:70%"></div>
    </div>`;
}

function renderErrorState(message) {
  return `
    <div class="detail-tab-placeholder">
      <div class="detail-tab-placeholder__icon">⚠️</div>
      <div class="detail-tab-placeholder__title">Couldn't load data</div>
      <div class="detail-tab-placeholder__sub">${message ?? 'Check your connection and try again.'}</div>
    </div>`;
}

// ── Odds tab ──────────────────────────────────────────────────────────────────

function renderMarketSelector(activeMarket) {
  return `
    <div class="detail-market-selector">
      ${MARKETS.map(m => `
        <button class="detail-market-btn${activeMarket === m.id ? ' detail-market-btn--active' : ''}"
                data-market="${m.id}" type="button">
          ${m.label}
        </button>
      `).join('')}
    </div>`;
}

/**
 * Render the main odds table (moneyline / spread / total).
 * odds: OddsMarket[] — may come from real API or mock data
 */
function renderOddsTabHTML(game, odds, isMock = false) {
  if (!odds.length) {
    return `
      <div class="detail-odds">
        ${renderMarketSelector(state.detailMarket)}
        <div class="detail-tab-placeholder" style="padding:32px 0">
          <div class="detail-tab-placeholder__icon">📊</div>
          <div class="detail-tab-placeholder__title">No odds available</div>
          <div class="detail-tab-placeholder__sub">Check back closer to game time.</div>
        </div>
      </div>`;
  }

  const market = state.detailMarket;
  if (market === 'props') return ''; // handled separately by _loadTab

  const { bestByGroup } = getBestOddsByMarket(odds, market);
  const fmt = state.oddsFormat;

  const cols = market === 'total'
    ? [{ sel: 'over',  label: 'Over'  }, { sel: 'under', label: 'Under' }]
    : [{ sel: 'away',  label: game.awayTeam.name }, { sel: 'home', label: game.homeTeam.name }];

  // Build rows from whatever books appear in the data (real or mock)
  const marketOdds = odds.filter(o => o.marketType === market);
  const bookIds    = [...new Set(marketOdds.map(o => o.sportsbookId))];
  const rows       = bookIds.map(id => ({
    book: getSportsbook(id) || { id, name: id, short: id.toUpperCase(), color: '#6b7280' },
    odds: marketOdds.filter(o => o.sportsbookId === id),
  }));

  if (!rows.length) {
    return `
      <div class="detail-odds">
        ${renderMarketSelector(market)}
        <div class="detail-tab-placeholder" style="padding:32px 0">
          <div class="detail-tab-placeholder__icon">📊</div>
          <div class="detail-tab-placeholder__title">No ${market} odds available</div>
          <div class="detail-tab-placeholder__sub">Try Moneyline or check back later.</div>
        </div>
      </div>`;
  }

  return `
    <div class="detail-odds">
      ${renderMarketSelector(market)}
      ${isMock ? `<div class="detail-odds-banner">Showing sample odds — live odds will appear as markets open.</div>` : ''}

      <table class="detail-odds-table">
        <thead>
          <tr>
            <th>Sportsbook</th>
            ${cols.map(c => `<th>${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ book, odds: bOdds }) => `
            <tr>
              <td>
                <div class="dot__book">
                  <span class="dot__book-color" style="background:${book.color}"></span>
                  <span class="dot__book-name">${book.name}</span>
                </div>
              </td>
              ${cols.map(c => {
                const o = bOdds.find(x => x.selection === c.sel);
                if (!o) return `<td class="dot__cell dot__cell--empty">—</td>`;
                const best      = isBestOdds(o, bestByGroup);
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
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return min < 60 ? `${min}m ago` : `${Math.floor(min / 60)}h ago`;
}

// ── Player Props tab ──────────────────────────────────────────────────────────

function renderPlayerPropsHTML(game, propGroups) {
  if (!propGroups.length) {
    return `
      <div class="detail-odds">
        ${renderMarketSelector('props')}
        <div class="detail-tab-placeholder" style="padding:32px 0">
          <div class="detail-tab-placeholder__icon">🎯</div>
          <div class="detail-tab-placeholder__title">No player props available</div>
          <div class="detail-tab-placeholder__sub">Props are typically released closer to game time.</div>
        </div>
      </div>`;
  }

  const fmt = state.oddsFormat;

  const sectionsHTML = propGroups.map(group => `
    <div class="detail-props-group">
      <div class="detail-props-group__header">${group.label}</div>
      <table class="detail-props-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Line</th>
            <th>Over</th>
            <th>Under</th>
          </tr>
        </thead>
        <tbody>
          ${group.players.slice(0, 12).map(p => {
            const bestOver  = p.over.reduce((best, x) => (!best || x.odds > best.odds) ? x : best, null);
            const bestUnder = p.under.reduce((best, x) => (!best || x.odds > best.odds) ? x : best, null);
            const line      = bestOver?.line ?? bestUnder?.line ?? '—';
            return `
              <tr>
                <td class="detail-props-player">${p.name}</td>
                <td class="detail-props-line">${line}</td>
                <td class="detail-props-cell detail-props-cell--over">
                  ${bestOver
                    ? `<span class="detail-props-odds">${formatOddsInFormat(bestOver.odds, fmt)}</span>
                       <span class="detail-props-book">${bestOver.book}</span>`
                    : '—'}
                </td>
                <td class="detail-props-cell detail-props-cell--under">
                  ${bestUnder
                    ? `<span class="detail-props-odds">${formatOddsInFormat(bestUnder.odds, fmt)}</span>
                       <span class="detail-props-book">${bestUnder.book}</span>`
                    : '—'}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  return `
    <div class="detail-odds">
      ${renderMarketSelector('props')}
      <div class="detail-props-note">Best available odds shown per book · Must be 21+</div>
      ${sectionsHTML}
    </div>`;
}

// ── Stats tab ─────────────────────────────────────────────────────────────────

function renderStatsTabHTML(game, data) {
  const isActive = game.status === 'live' || game.status === 'halftime' || game.status === 'final';

  if (!isActive) {
    return `
      <div class="detail-tab-placeholder">
        <div class="detail-tab-placeholder__icon">📈</div>
        <div class="detail-tab-placeholder__title">Box score available at game time</div>
        <div class="detail-tab-placeholder__sub">Check back once the game starts.</div>
      </div>`;
  }

  if (!data?.boxscore) {
    return renderErrorState('Box score data not yet available.');
  }

  const { players = [], teams = [] } = data.boxscore;

  // Team totals summary bar
  const teamStats = teams.map(ts => {
    const stat = name => ts.statistics?.find(s => s.name === name)?.displayValue ?? '—';
    return {
      name:  ts.team?.abbreviation ?? ts.team?.displayName ?? '?',
      fg:    `${stat('fieldGoalsMade')}-${stat('fieldGoalsAttempted')}`,
      threePt: `${stat('threePointFieldGoalsMade')}-${stat('threePointFieldGoalsAttempted')}`,
      ft:    `${stat('freeThrowsMade')}-${stat('freeThrowsAttempted')}`,
      reb:   stat('rebounds') || stat('totalRebounds'),
      ast:   stat('assists'),
      to:    stat('turnovers'),
      pf:    stat('fouls') || stat('personalFouls'),
    };
  });

  const teamSummaryHTML = teamStats.length
    ? `
      <div class="detail-stats-summary">
        ${teamStats.map(t => `
          <div class="detail-stats-team-totals">
            <div class="detail-stats-team-totals__name">${t.name}</div>
            <div class="detail-stats-team-totals__grid">
              ${t.fg   !== '—-—' ? `<span class="detail-stats-kv"><span>FG</span><strong>${t.fg}</strong></span>` : ''}
              ${t.threePt !== '—-—' ? `<span class="detail-stats-kv"><span>3PT</span><strong>${t.threePt}</strong></span>` : ''}
              ${t.ft   !== '—-—' ? `<span class="detail-stats-kv"><span>FT</span><strong>${t.ft}</strong></span>` : ''}
              ${t.reb  !== '—'   ? `<span class="detail-stats-kv"><span>REB</span><strong>${t.reb}</strong></span>` : ''}
              ${t.ast  !== '—'   ? `<span class="detail-stats-kv"><span>AST</span><strong>${t.ast}</strong></span>` : ''}
              ${t.to   !== '—'   ? `<span class="detail-stats-kv"><span>TO</span><strong>${t.to}</strong></span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`
    : '';

  // Player box score tables per team
  const playerTablesHTML = players.map(teamBlock => {
    const teamName = teamBlock.team?.displayName ?? teamBlock.team?.abbreviation ?? '?';
    const statsBlock = teamBlock.statistics?.[0]; // primary stat group
    if (!statsBlock?.athletes?.length) return '';

    const names   = statsBlock.names ?? [];
    // Prefer a curated subset; fall back to first 9 columns
    const PREFERRED = ['MIN','FG','3PT','FT','REB','AST','STL','BLK','TO','PTS'];
    const colIdxs   = PREFERRED
      .map(n => names.indexOf(n))
      .filter(i => i !== -1)
      .slice(0, 10);
    const colNames  = colIdxs.map(i => names[i]);

    const athletes = statsBlock.athletes.filter(a => a.stats?.length);
    if (!athletes.length) return '';

    return `
      <div class="detail-stats-team">
        <div class="detail-stats-team__header">${teamName}</div>
        <div class="detail-stats-scroll">
          <table class="detail-stats-table">
            <thead>
              <tr>
                <th class="detail-stats-table__player">Player</th>
                ${colNames.map(n => `<th>${n}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${athletes.map(a => {
                const athlete  = a.athlete ?? {};
                const isStarter = a.starter;
                const didNotPlay = a.didNotPlay || a.stats?.every(s => s === '0' || s === '—' || s === '');
                return `
                  <tr class="${isStarter ? 'detail-stats-row--starter' : ''}${didNotPlay ? ' detail-stats-row--dnp' : ''}">
                    <td class="detail-stats-table__player">
                      <span class="detail-stats-name">${athlete.shortName ?? athlete.displayName ?? '?'}</span>
                      ${isStarter ? '<span class="detail-stats-starter">S</span>' : ''}
                    </td>
                    ${colIdxs.map(i => `<td>${a.stats[i] ?? '—'}</td>`).join('')}
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  if (!teamSummaryHTML && !playerTablesHTML) {
    return renderErrorState('Box score not yet available for this game.');
  }

  return `
    <div class="detail-stats">
      ${teamSummaryHTML}
      ${playerTablesHTML}
    </div>`;
}

// ── H2H tab ───────────────────────────────────────────────────────────────────

function renderH2HTabHTML(game, h2hData) {
  const meetings = (h2hData && h2hData.meetings) ? h2hData.meetings : [];
  const homeForm = (h2hData && h2hData.homeForm) ? h2hData.homeForm : [];
  const awayForm = (h2hData && h2hData.awayForm) ? h2hData.awayForm : [];

  if (!meetings.length && !homeForm.length && !awayForm.length) {
    return `
      <div class="detail-tab-placeholder">
        <div class="detail-tab-placeholder__icon">⚔️</div>
        <div class="detail-tab-placeholder__title">No recent data found</div>
        <div class="detail-tab-placeholder__sub">Historical game data is unavailable for this matchup.</div>
      </div>`;
  }

  const wins   = meetings.filter(m => m.ourTeamWon).length;
  const losses = meetings.length - wins;

  function formRow(g) {
    const d   = new Date(g.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const loc = g.isHome ? 'vs' : '@';
    const cls = g.isH2H ? ' class="detail-h2h__form-h2h"' : '';
    const res = g.won ? 'W' : 'L';
    const resCls = g.won ? 'detail-h2h__result--w' : 'detail-h2h__result--l';
    return `
      <tr${cls}>
        <td class="detail-h2h__result ${resCls}">${res}</td>
        <td class="detail-h2h__form-opp">${loc} ${g.oppAbbr || g.opponent}</td>
        <td class="detail-h2h__form-score">${g.ourScore}–${g.oppScore}</td>
        <td class="detail-h2h__form-date">${d}</td>
      </tr>`;
  }

  const seriesHTML = meetings.length ? `
    <div class="detail-h2h__series">
      <div class="detail-h2h__series-label">Last ${meetings.length} direct meeting${meetings.length === 1 ? '' : 's'}</div>
      <div class="detail-h2h__series-record">
        <span class="detail-h2h__series-w">${wins}W</span>
        <span class="detail-h2h__series-sep"> – </span>
        <span class="detail-h2h__series-l">${losses}L</span>
      </div>
      <div class="detail-h2h__series-team">${game.homeTeam.abbr} perspective</div>
    </div>
    <div class="detail-h2h__meetings">
      ${meetings.map(m => {
        const d = new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
        return `
          <div class="detail-h2h__row">
            <div class="detail-h2h__result ${m.ourTeamWon ? 'detail-h2h__result--w' : 'detail-h2h__result--l'}">${m.ourTeamWon ? 'W' : 'L'}</div>
            <div class="detail-h2h__matchup">
              <span class="detail-h2h__team">${m.awayAbbr}</span>
              <span class="detail-h2h__score">${m.awayScore}</span>
              <span class="detail-h2h__at">@</span>
              <span class="detail-h2h__score">${m.homeScore}</span>
              <span class="detail-h2h__team">${m.homeAbbr}</span>
            </div>
            <div class="detail-h2h__date">${d}</div>
          </div>`;
      }).join('')}
    </div>` : '';

  const homeFormHTML = homeForm.length ? `
    <div class="detail-h2h__form-section">
      <div class="detail-h2h__form-header">${game.homeTeam.abbr} — Last ${homeForm.length} Games</div>
      <table class="detail-h2h__form-table">
        <thead><tr><th></th><th>Opponent</th><th>Score</th><th>Date</th></tr></thead>
        <tbody>${homeForm.map(formRow).join('')}</tbody>
      </table>
    </div>` : '';

  const awayFormHTML = awayForm.length ? `
    <div class="detail-h2h__form-section">
      <div class="detail-h2h__form-header">${game.awayTeam.abbr} — Last ${awayForm.length} Games</div>
      <table class="detail-h2h__form-table">
        <thead><tr><th></th><th>Opponent</th><th>Score</th><th>Date</th></tr></thead>
        <tbody>${awayForm.map(formRow).join('')}</tbody>
      </table>
    </div>` : '';

  return `<div class="detail-h2h">${seriesHTML}${homeFormHTML}${awayFormHTML}</div>`;
}

// ── Standings tab ─────────────────────────────────────────────────────────────

function renderStandingsTabHTML(game, data) {
  if (!data) {
    return renderErrorState('Standings data unavailable for this league.');
  }

  // ESPN standings response can have different shapes; normalise them
  const groups = extractStandingsGroups(data);
  if (!groups.length) {
    return renderErrorState('No standings data returned.');
  }

  function standingsNorm(s) { return (s ?? '').toLowerCase().replace(/[^a-z]/g, ''); }
  const homeNorm = standingsNorm(game.homeTeam.name);
  const awayNorm = standingsNorm(game.awayTeam.name);
  function isGameTeam(teamName) {
    const n = standingsNorm(teamName);
    return n.includes(homeNorm.slice(0, 5)) || n.includes(awayNorm.slice(0, 5));
  }

  return `
    <div class="detail-standings">
      ${groups.map(group => `
        <div class="detail-standings__group">
          ${group.name ? `<div class="detail-standings__group-name">${group.name}</div>` : ''}
          <table class="detail-standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>GB</th>
                ${group.hasStreak ? '<th>Streak</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${group.entries.map((entry, idx) => {
                const highlight = isGameTeam(entry.name);
                return `
                  <tr class="${highlight ? 'detail-standings-row--highlight' : ''}">
                    <td class="detail-standings-rank">${idx + 1}</td>
                    <td class="detail-standings-team">
                      ${highlight ? '<span class="detail-standings-indicator">▸</span>' : ''}
                      <span>${entry.abbr ?? entry.name}</span>
                    </td>
                    <td>${entry.wins ?? '—'}</td>
                    <td>${entry.losses ?? '—'}</td>
                    <td>${entry.pct ?? '—'}</td>
                    <td>${entry.gb ?? '—'}</td>
                    ${group.hasStreak ? `<td class="detail-standings-streak">${entry.streak ?? '—'}</td>` : ''}
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>`;
}

/** Normalise the many ESPN standings shapes into a stable array of groups. */
function extractStandingsGroups(data) {
  const groups = [];

  function parseEntries(entries) {
    return (entries ?? []).map(e => {
      const stat = name => e.stats?.find(s => s.name === name)?.displayValue ?? '—';
      return {
        name:   e.team?.displayName ?? e.team?.name ?? '?',
        abbr:   e.team?.abbreviation,
        wins:   stat('wins'),
        losses: stat('losses'),
        pct:    stat('winPercent') || stat('gamesBehind') ? stat('winPercent') : '—',
        gb:     stat('gamesBehind'),
        streak: stat('streak'),
      };
    });
  }

  // Shape 1: data.standings.entries (flat)
  if (data.standings?.entries?.length) {
    const entries = parseEntries(data.standings.entries);
    const hasStreak = entries.some(e => e.streak !== '—');
    groups.push({ name: '', entries, hasStreak });
    return groups;
  }

  // Shape 2: data.standings.groups[].standings.entries
  if (data.standings?.groups?.length) {
    for (const g of data.standings.groups) {
      const entries = parseEntries(g.standings?.entries ?? g.entries ?? []);
      const hasStreak = entries.some(e => e.streak !== '—');
      if (entries.length) groups.push({ name: g.name ?? g.displayName ?? '', entries, hasStreak });
    }
    return groups;
  }

  // Shape 3: data.children[].standings.entries (divisions)
  if (data.children?.length) {
    for (const child of data.children) {
      const raw = child.standings?.entries ?? child.entries ?? [];
      const entries = parseEntries(raw);
      const hasStreak = entries.some(e => e.streak !== '—');
      if (entries.length) groups.push({ name: child.name ?? child.displayName ?? '', entries, hasStreak });
    }
    return groups;
  }

  return groups;
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

// Sync-only tab routing (async tabs show a skeleton; _loadTab fills them in)
function renderTabContent(game) {
  switch (state.detailTab) {
    case 'summary':   return renderSummaryTab(game);
    case 'odds':
    case 'stats':
    case 'h2h':
    case 'standings': return renderLoadingSkeleton();
    case 'lineups':   return renderPlaceholderTab('📋', 'Lineups coming soon', 'Starting rosters and depth charts will appear here.');
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
        <div style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">Navigate here from the scores feed to load this game.</div>
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

// ── Async tab loading ─────────────────────────────────────────────────────────

let _loadVersion = 0;

async function _loadTab(el, game) {
  const ver     = ++_loadVersion;
  const content = el.querySelector('#detailTabContent');
  if (!content) return;

  const tab = state.detailTab;

  // Instant tabs
  if (tab === 'summary') { content.innerHTML = renderSummaryTab(game); return; }
  if (tab === 'lineups') { content.innerHTML = renderPlaceholderTab('📋', 'Lineups coming soon', 'Starting rosters and depth charts will appear here.'); return; }
  if (tab === 'news')    { content.innerHTML = renderPlaceholderTab('📰', 'News coming soon', 'Related news articles will appear here.'); return; }
  if (tab === 'injuries'){ content.innerHTML = renderPlaceholderTab('🏥', 'Injury report coming soon', 'Official injury designations will appear here.'); return; }

  // Async tabs — show skeleton first
  content.innerHTML = renderLoadingSkeleton();

  try {
    let html = '';

    if (tab === 'odds') {
      if (state.detailMarket === 'props') {
        // Player props: need eventId from a prior odds fetch or trigger one now
        let eventId = _lastEventId;
        if (!eventId) {
          const { eventId: id } = await fetchRealOdds(game);
          if (ver !== _loadVersion) return;
          eventId = id;
          _lastEventId = id;
        }
        const props = eventId ? await fetchPlayerProps(eventId, game) : [];
        if (ver !== _loadVersion) return;
        html = renderPlayerPropsHTML(game, props);
      } else {
        const { odds: realOdds, eventId } = await fetchRealOdds(game);
        if (ver !== _loadVersion) return;
        _lastEventId = eventId;
        const odds   = realOdds.length ? realOdds : getOddsForGame(game.id);
        const isMock = realOdds.length === 0;
        html = renderOddsTabHTML(game, odds, isMock);
      }
    } else if (tab === 'stats') {
      const data = await fetchGameStats(game);
      if (ver !== _loadVersion) return;
      html = renderStatsTabHTML(game, data);
    } else if (tab === 'h2h') {
      const h2hData = await fetchH2H(game);
      if (ver !== _loadVersion) return;
      html = renderH2HTabHTML(game, h2hData);
    } else if (tab === 'standings') {
      const data = await fetchStandings(game);
      if (ver !== _loadVersion) return;
      html = renderStandingsTabHTML(game, data);
    }

    if (ver === _loadVersion) content.innerHTML = html;
  } catch (err) {
    if (ver === _loadVersion) content.innerHTML = renderErrorState(err.message);
  }
}

// Cache last Odds API event ID across market switches so props don't need a fresh fetch
let _lastEventId = null;

// ── Binding ───────────────────────────────────────────────────────────────────

export function bindDetailView(el, onRefresh) {
  if (!el) return;

  const gameId = window.location.hash.replace(/^#\/?game\//, '');
  const game   = getGameById(gameId);
  if (!game) return;

  // Reset props event cache when entering a new game
  _lastEventId = null;

  // Kick off initial async load for the current tab
  _loadTab(el, game);

  el.addEventListener('click', e => {
    // Tab switch
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn && tabBtn.closest('#detailTabsBar')) {
      const prev = state.detailTab;
      setState({ detailTab: tabBtn.dataset.tab });
      // Reset market to moneyline when switching away from odds (avoid stale props state)
      if (prev === 'odds' && tabBtn.dataset.tab !== 'odds') {
        setState({ detailMarket: 'moneyline' });
      }
      el.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('detail-tab--active', b.dataset.tab === state.detailTab);
        b.setAttribute('aria-selected', b.dataset.tab === state.detailTab);
      });
      _loadTab(el, game);
      return;
    }

    // Market selector
    const mktBtn = e.target.closest('[data-market]');
    if (mktBtn) {
      setState({ detailMarket: mktBtn.dataset.market });
      if (state.detailTab === 'odds') {
        _loadTab(el, game);
      }
      return;
    }
  });
}

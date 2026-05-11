// ── Right sidebar component ──────────────────────────────────────────────────
// Live now, best value odds, trending games, responsible gambling banner.
// Pure render function — returns HTML string.

import { getGames, getGameById, getLeague } from '../mockData.js';
import { getOddsForGame } from '../mockData.js';
import { getBestOddsByMarket } from '../bestOdds.js';
import { formatOdds } from '../bestOdds.js';
import { navigate } from '../router.js';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function renderRightSidebar() {
  const todayGames = getGames({ dayOffset: 0 });
  const liveGames = todayGames.filter(g => g.status === 'live' || g.status === 'halftime');
  const bestValueOdds = getBestValueOdds(todayGames);
  const trendingGames = getTrendingGames(todayGames);

  return `
    <div class="rsb">

      <!-- Live Now -->
      <div class="rsb__section">
        <div class="rsb__header">
          ${liveGames.length > 0 ? '<span class="rsb__header-dot"></span>' : ''}
          Live Now
          ${liveGames.length > 0 ? `<span style="margin-left:auto;font-size:.72rem;font-weight:700;color:var(--red)">${liveGames.length}</span>` : ''}
        </div>
        ${liveGames.length === 0 ? `
          <div style="font-size:.78rem;color:var(--text-muted);padding:4px 0">
            No live games right now
          </div>
        ` : liveGames.slice(0, 4).map(g => `
          <a class="rsb__live-game" href="#game/${g.id}">
            <div class="rsb__live-matchup">
              ${g.awayTeam.abbr} ${g.awayScore ?? '—'} – ${g.homeScore ?? '—'} ${g.homeTeam.abbr}
            </div>
            <div class="rsb__live-meta">
              <span class="rsb__live-clock">${g.period ?? 'Live'}${g.clock ? ' ' + g.clock : ''}</span>
              <span>·</span>
              <span>${getLeague(g.leagueId)?.name ?? ''}</span>
            </div>
          </a>
        `).join('')}
        ${liveGames.length > 4 ? `
          <a class="rsb__see-all" href="#" data-action="rsb-see-live">
            See all ${liveGames.length} live games →
          </a>
        ` : ''}
      </div>

      <!-- Best Value Odds -->
      <div class="rsb__section">
        <div class="rsb__header">
          💰 Best Value Odds
        </div>
        ${bestValueOdds.length === 0 ? `
          <div style="font-size:.78rem;color:var(--text-muted)">No odds available today</div>
        ` : bestValueOdds.slice(0, 4).map(({ game, teamName, odds, bookName }) => `
          <a class="rsb__odds-row" href="#game/${game.id}">
            <div style="display:flex;flex-direction:column;gap:1px;min-width:0">
              <span class="rsb__odds-team">${teamName}</span>
              <span class="rsb__odds-book">${bookName}</span>
            </div>
            <span class="rsb__odds-val">${formatOdds(odds)}</span>
          </a>
        `).join('')}
      </div>

      <!-- Trending Games -->
      <div class="rsb__section">
        <div class="rsb__header">🔥 Trending</div>
        ${trendingGames.slice(0, 5).map((g, i) => {
          const league = getLeague(g.leagueId);
          return `
            <a class="rsb__trending-item" href="#game/${g.id}">
              <span class="rsb__trending-num">${i + 1}</span>
              <span class="rsb__trending-name">${g.awayTeam.abbr} vs ${g.homeTeam.abbr}</span>
              <span class="rsb__trending-sport">${league?.name ?? ''}</span>
            </a>`;
        }).join('')}
      </div>

      <!-- Responsible Gambling -->
      <div class="rsb__section">
        <div class="rsb__rg-banner">
          <strong>⚠️ Gamble Responsibly</strong>
          Must be 21+. If gambling is affecting your life, call
          <strong>1-800-522-4700</strong> or visit
          <a href="https://www.ncpgambling.org" target="_blank" rel="noopener">ncpgambling.org</a>.
          NoGame does not accept bets.
        </div>
      </div>

    </div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBestValueOdds(games) {
  const results = [];
  for (const game of games) {
    if (!game.hasOdds) continue;
    const odds = getOddsForGame(game.id);
    const { groups, bestByGroup } = getBestOddsByMarket(odds, 'moneyline');

    for (const [key, group] of groups) {
      if (!group.length) continue;
      const winners = bestByGroup.get(key);
      if (!winners) continue;
      const best = group.find(o => winners.has(o.sportsbookId));
      if (!best) continue;

      // Only show underdogs (positive odds) as "value"
      if (best.oddsAmerican <= 100) continue;

      const teamName = best.selection === 'home'
        ? game.homeTeam.abbr
        : game.awayTeam.abbr;

      const { SPORTSBOOKS } = importSportsbooks();
      const book = SPORTSBOOKS.find(b => b.id === best.sportsbookId);

      results.push({
        game,
        teamName,
        odds: best.oddsAmerican,
        bookName: book?.short ?? best.sportsbookId.toUpperCase(),
        score: best.oddsAmerican, // higher = more value for display
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// Lazy import to avoid circular deps
let _sportsbooks = null;
function importSportsbooks() {
  // We can't do top-level dynamic import in this sync context,
  // so we import sportsbooks inline on first call via a cached require-like pattern.
  // Since this runs in browser ESM context without a bundler, we work around
  // the circular dep by inlining the minimum needed data here.
  if (!_sportsbooks) {
    _sportsbooks = {
      SPORTSBOOKS: [
        { id:'dk', short:'DK' }, { id:'fd', short:'FD' }, { id:'mgm', short:'MGM' },
        { id:'czr', short:'CZR' }, { id:'espn', short:'ESPN' }, { id:'fan', short:'FAN' },
        { id:'b365', short:'B365' }, { id:'br', short:'BR' }, { id:'hr', short:'HR' },
        { id:'bally', short:'BAL' },
      ],
    };
  }
  return _sportsbooks;
}

function getTrendingGames(games) {
  // Trending = live first, then games with odds, then others.
  // Within each group, sort by start time.
  const live = games.filter(g => g.status === 'live' || g.status === 'halftime');
  const withOdds = games.filter(g => g.hasOdds && g.status === 'scheduled');
  const rest = games.filter(g => !live.includes(g) && !withOdds.includes(g));
  return [...live, ...withOdds, ...rest].slice(0, 5);
}

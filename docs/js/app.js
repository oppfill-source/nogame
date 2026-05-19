// ── Main app controller ──────────────────────────────────────────────────────
// Boots the SPA: initializes router, mounts views, wires all events.

import { getSession, signOut as authSignOut } from './auth.js';
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
import { renderGameDetailView, bindDetailView } from './views/gameDetailView.js?v=4';
import { getAiPicks, refreshAiPicks, calculateKellyStake, formatOdds, getOddEmoji } from './aiPicks.js';
import { addBet, getBets, settleBet, getBetStats, calculatePayout, calculateProfit, formatCurrency } from './betTracking.js';
import { startLiveOddsSync, stopLiveOddsSync, getAllLiveGames, getMovementIcon, formatMovement, isSharpMovement } from './liveOdds.js';
import { getCurrentUserProfile, getUserProfile, updateUserProfile, getUserStats, getLeaderboard, getAvatarInitials, uploadAvatar } from './userProfiles.js';
import { getPicks, addPick, likePick, unlikePick, hasUserLikedPick, addComment, getComments, followUser, unfollowUser, isFollowing } from './communityPicks.js';

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard: redirect unauthenticated visitors to the landing page
  const session = await getSession();
  if (!session) {
    window.location.replace('index.html?redirect=app');
    return;
  }

  // Show signed-in user identifier in the header
  const userEl = document.getElementById('appbarUserEmail');
  if (userEl && session.user?.email) {
    userEl.textContent = session.user.email.split('@')[0];
  }

  // Sign out handler
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.replace('index.html');
  });

  renderSportsNav();
  bindSportsNav();
  mountLeftSidebar();
  mountRightSidebar();
  bindOddsFormat();
  bindSearch();
  bindBurger();
  bindAiPicksBtn();
  bindMyBetsBtn();
  bindCommunityBtn();
  bindLiveOddsBtn();
  bindProfileBtn();
  bindLeaderboardBtn();

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

// ── AI Picks view ──────────────────────────────────────────────────────────

let aiPicksLoading = false;

async function renderAiPicks() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `
    <div class="ai-picks-container">
      <div class="ai-picks-header">
        <div class="ai-picks-title">
          <span>✨ AI Picks</span>
          <span style="font-size:0.8rem;color:var(--text-muted)">by Engie</span>
        </div>
        <div class="ai-picks-refresh">
          <button id="refreshAiPicksBtn" class="btn-refresh-ai" type="button" ${aiPicksLoading ? 'disabled' : ''}>
            ${aiPicksLoading ? '<span class="refresh-spinner"></span>' : '⟳'} Refresh
          </button>
        </div>
      </div>
      <div id="aiPicksContent">Loading picks...</div>
    </div>
  `;

  const contentEl = document.getElementById('aiPicksContent');
  const refreshBtn = document.getElementById('refreshAiPicksBtn');

  refreshBtn.addEventListener('click', async () => {
    if (aiPicksLoading) return;
    aiPicksLoading = true;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="refresh-spinner"></span> Generating...';

    try {
      await refreshAiPicks();
      await loadAndRenderPicks(contentEl);
    } catch (err) {
      contentEl.innerHTML = `<div class="rate-limit-msg">${err.message}</div>`;
    } finally {
      aiPicksLoading = false;
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '⟳ Refresh';
    }
  });

  await loadAndRenderPicks(contentEl);
}

async function loadAndRenderPicks(container) {
  try {
    const picks = await getAiPicks();

    if (picks.length === 0) {
      container.innerHTML = `
        <div class="picks-empty">
          <div class="picks-empty-icon">🎯</div>
          <div class="picks-empty-text">
            No picks available right now.<br>
            Click Refresh to generate new AI picks.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ai-picks-list">
        ${picks.map(pick => renderPickCard(pick)).join('')}
      </div>
    `;

    // Wire up pick actions
    container.querySelectorAll('.pick-action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const action = e.currentTarget.dataset.action;
        const pickId = e.currentTarget.dataset.pickId;
        console.log('Pick action:', action, pickId);
        // TODO: Implement rate pick as win/loss
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="rate-limit-msg">Error loading picks: ${err.message}</div>`;
  }
}

function renderPickCard(pick) {
  const bestBook = pick.odds_data?.[0];
  const kellyStake = calculateKellyStake(pick.confidence_pct, pick.recommended_odds, 0.25);
  const emoji = getOddEmoji(pick.value_rating);

  return `
    <div class="ai-pick-card">
      <div class="pick-header">
        <div>
          <div class="pick-game">${pick.away_team} @ ${pick.home_team}</div>
          <div class="pick-league">${pick.sport}</div>
        </div>
        <div class="pick-rating">
          <div class="rating-emoji">${emoji}</div>
          <div class="rating-number">${pick.value_rating}/10</div>
        </div>
      </div>

      <div class="pick-selection">
        <div class="selection-bet">${pick.selection}</div>
        <div class="selection-type">${pick.bet_type === 'total' ? 'Over/Under' : pick.bet_type.charAt(0).toUpperCase() + pick.bet_type.slice(1)}</div>
      </div>

      <div class="pick-odds">
        ${pick.odds_data?.slice(0, 4).map(book => `
          <div class="odds-item">
            <div class="odds-book">${book.title}</div>
            <div class="odds-value">${formatOdds(book.odds)}</div>
          </div>
        `).join('') || '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No odds available</div>'}
      </div>

      <div class="pick-stats">
        <div class="stat">
          <div class="stat-label">Confidence</div>
          <div class="stat-value">${pick.confidence_pct}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Kelly Stake</div>
          <div class="stat-value">${(kellyStake * 100).toFixed(1)}%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Recommended Odds</div>
          <div class="stat-value">${formatOdds(pick.recommended_odds)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Best Available</div>
          <div class="stat-value">${bestBook ? formatOdds(bestBook.odds) : 'N/A'}</div>
        </div>
      </div>

      <div class="pick-reasoning">${pick.reasoning}</div>

      <div class="pick-actions">
        <button class="btn-small pick-action-btn" data-action="win" data-pick-id="${pick.id}" type="button">✅ Won</button>
        <button class="btn-small pick-action-btn" data-action="loss" data-pick-id="${pick.id}" type="button">❌ Lost</button>
        <button class="btn-small pick-action-btn" data-action="push" data-pick-id="${pick.id}" type="button">➖ Push</button>
      </div>

      <div class="pick-time">Updated ${new Date(pick.created_at || pick.expires_at).toLocaleDateString()}</div>
    </div>
  `;
}

function bindAiPicksBtn() {
  const btn = document.getElementById('aiPicksBtn');
  if (!btn) return;
  btn.addEventListener('click', renderAiPicks);
}

// ── Bet Tracking view ──────────────────────────────────────────────────────

let currentBetFilter = { status: null, sport: null };

async function renderBetTracking() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `
    <div class="bet-tracking-container">
      <div class="bet-header">
        <div class="bet-title">📊 My Bets</div>
        <button id="addBetBtn" class="btn-add-bet" type="button">+ Add Bet</button>
      </div>

      <div id="betStatsContainer">Loading stats...</div>
      <div id="betFiltersContainer"></div>
      <div id="betListContainer">Loading bets...</div>

      <!-- Add Bet Modal -->
      <div id="addBetModal" class="modal-overlay" hidden>
        <div class="modal-content">
          <button class="modal-close" type="button">✕</button>
          <div class="modal-header">Add New Bet</div>

          <form id="addBetForm">
            <div class="form-group">
              <label class="form-label">Game / Match</label>
              <input class="form-input" id="gameDesc" placeholder="e.g., KC vs Buffalo" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Sport</label>
                <select class="form-select" id="sportSelect" required>
                  <option value="">Select sport</option>
                  <option value="nfl">NFL</option>
                  <option value="nba">NBA</option>
                  <option value="mlb">MLB</option>
                  <option value="nhl">NHL</option>
                  <option value="ncaaf">NCAAF</option>
                  <option value="ncaab">NCAAB</option>
                  <option value="soccer">Soccer</option>
                  <option value="tennis">Tennis</option>
                  <option value="mma">MMA</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Bet Type</label>
                <select class="form-select" id="betTypeSelect" required>
                  <option value="moneyline">Moneyline</option>
                  <option value="spread">Spread</option>
                  <option value="total">Total</option>
                  <option value="prop">Prop</option>
                  <option value="parlay">Parlay</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Selection</label>
              <input class="form-input" id="selectionInput" placeholder="e.g., KC -3 or Over 45.5" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bookmaker</label>
                <select class="form-select" id="bookmakerSelect" required>
                  <option value="">Select book</option>
                  <option value="draftkings">DraftKings</option>
                  <option value="fanduel">FanDuel</option>
                  <option value="betmgm">BetMGM</option>
                  <option value="caesars">Caesars</option>
                  <option value="bet365">bet365</option>
                  <option value="betrivers">BetRivers</option>
                  <option value="playnow">PlayNow</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Odds</label>
                <input class="form-input" id="oddsInput" type="number" placeholder="-110" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Stake ($)</label>
              <input class="form-input" id="stakeInput" type="number" placeholder="50" min="0.01" step="0.01" required>
            </div>

            <div class="form-group" style="background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border)">
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">POTENTIAL PAYOUT</div>
              <div id="potentialPayoutDisplay" style="font-size:1.3rem;font-weight:700;color:var(--green)">$0.00</div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" id="cancelBetBtn">Cancel</button>
              <button type="submit" class="btn-primary">Add Bet</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Load stats and bets
  await loadAndRenderBetStats();
  await loadAndRenderBets();

  // Wire up modal
  const modal = document.getElementById('addBetModal');
  const addBtn = document.getElementById('addBetBtn');
  const cancelBtn = document.getElementById('cancelBetBtn');
  const closeBtn = document.querySelector('.modal-close');

  addBtn.addEventListener('click', () => modal.hidden = false);
  cancelBtn.addEventListener('click', () => modal.hidden = true);
  closeBtn.addEventListener('click', () => modal.hidden = true);

  // Wire up form
  const form = document.getElementById('addBetForm');
  const oddsInput = document.getElementById('oddsInput');
  const stakeInput = document.getElementById('stakeInput');
  const payoutDisplay = document.getElementById('potentialPayoutDisplay');

  const updatePayout = () => {
    const stake = parseFloat(stakeInput.value) || 0;
    const odds = parseInt(oddsInput.value) || 0;
    const payout = stake > 0 && odds ? calculatePayout(stake, odds) : 0;
    payoutDisplay.textContent = formatCurrency(payout);
  };

  oddsInput.addEventListener('input', updatePayout);
  stakeInput.addEventListener('input', updatePayout);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      await addBet({
        gameId: 'manual',
        gameDescription: document.getElementById('gameDesc').value,
        sport: document.getElementById('sportSelect').value,
        betType: document.getElementById('betTypeSelect').value,
        selection: document.getElementById('selectionInput').value,
        bookmakerKey: document.getElementById('bookmakerSelect').value,
        odds: document.getElementById('oddsInput').value,
        stake: document.getElementById('stakeInput').value,
      });

      modal.hidden = true;
      form.reset();
      payoutDisplay.textContent = '$0.00';
      await loadAndRenderBetStats();
      await loadAndRenderBets();
    } catch (err) {
      alert('Error adding bet: ' + err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.hidden = true;
  });
}

async function loadAndRenderBetStats() {
  const container = document.getElementById('betStatsContainer');
  if (!container) return;

  try {
    const stats = await getBetStats();

    container.innerHTML = `
      <div class="bet-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Bets</div>
          <div class="stat-value">${stats.totalBets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${stats.pending}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Win Rate</div>
          <div class="stat-value ${stats.winRate >= 52.5 ? 'positive' : 'negative'}">${stats.winRate}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ROI</div>
          <div class="stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}">${stats.roi}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Staked</div>
          <div class="stat-value">${formatCurrency(stats.totalStaked)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Winnings</div>
          <div class="stat-value ${stats.totalWinnings >= 0 ? 'positive' : 'negative'}">${formatCurrency(stats.totalWinnings)}</div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;color:var(--text-muted)">Error loading stats: ${err.message}</div>`;
  }
}

async function loadAndRenderBets() {
  const container = document.getElementById('betListContainer');
  if (!container) return;

  try {
    const bets = await getBets(currentBetFilter);

    // Render filters
    const filterContainer = document.getElementById('betFiltersContainer');
    filterContainer.innerHTML = `
      <div class="bet-filters">
        <button class="filter-btn ${!currentBetFilter.status ? 'filter-btn--active' : ''}" data-filter-status="">All</button>
        <button class="filter-btn ${currentBetFilter.status === 'pending' ? 'filter-btn--active' : ''}" data-filter-status="pending">Pending</button>
        <button class="filter-btn ${currentBetFilter.status === 'won' ? 'filter-btn--active' : ''}" data-filter-status="won">Won</button>
        <button class="filter-btn ${currentBetFilter.status === 'lost' ? 'filter-btn--active' : ''}" data-filter-status="lost">Lost</button>
        <button class="filter-btn ${currentBetFilter.status === 'push' ? 'filter-btn--active' : ''}" data-filter-status="push">Push</button>
      </div>
    `;

    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        currentBetFilter.status = btn.dataset.filterStatus || null;
        await loadAndRenderBets();
      });
    });

    if (bets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <div>No bets yet. Add your first bet to start tracking!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="bet-list">
        ${bets.map(bet => renderBetItem(bet)).join('')}
      </div>
    `;

    // Wire up settle buttons
    container.querySelectorAll('.result-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const betId = btn.dataset.betId;
        const result = btn.dataset.result;
        try {
          await settleBet(betId, result);
          await loadAndRenderBetStats();
          await loadAndRenderBets();
        } catch (err) {
          alert('Error settling bet: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;color:var(--text-muted)">Error loading bets: ${err.message}</div>`;
  }
}

function renderBetItem(bet) {
  const profit = calculateProfit(bet.stake, bet.odds);
  const isPending = bet.status === 'pending';

  return `
    <div class="bet-item">
      <div class="bet-info">
        <div class="bet-game">${bet.game_description}</div>
        <div class="bet-selection">${bet.selection}</div>
        <div class="bet-meta">
          <span>${bet.sport.toUpperCase()}</span>
          <span>${bet.bet_type}</span>
          <span class="bet-stake">${formatCurrency(bet.stake)}</span>
          <span>@ ${bet.odds > 0 ? '+' : ''}${bet.odds}</span>
        </div>
      </div>

      <div style="text-align:right">
        <div class="bet-status-badge badge--${bet.status}">${bet.status.toUpperCase()}</div>
        <div class="bet-payout" style="margin-top:8px">${formatCurrency(bet.potential_payout)}</div>
        ${!isPending ? `<div style="font-size:0.85rem;color:${profit >= 0 ? 'var(--green)' : '#F87171'};margin-top:4px">${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</div>` : ''}
      </div>

      ${isPending ? `
        <div class="bet-result">
          <button class="result-btn" data-bet-id="${bet.id}" data-result="won" type="button">✅ Won</button>
          <button class="result-btn" data-bet-id="${bet.id}" data-result="lost" type="button">❌ Lost</button>
          <button class="result-btn" data-bet-id="${bet.id}" data-result="push" type="button">➖ Push</button>
        </div>
      ` : ''}
    </div>
  `;
}

function bindMyBetsBtn() {
  const btn = document.getElementById('myBetsBtn');
  if (!btn) return;
  btn.addEventListener('click', renderBetTracking);
}

// ── Community view ────────────────────────────────────────────────────────

let communityFilter = 'all'; // 'all' or 'following'

async function renderCommunityFeed() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `
    <div class="community-container">
      <div class="community-header">
        <div class="community-title">
          <span>💬 Community Picks</span>
        </div>
      </div>
      <div class="community-tabs">
        <button class="tab-btn tab-btn--active" data-filter="all" type="button">All Picks</button>
        <button class="tab-btn" data-filter="following" type="button">Following</button>
      </div>
      <div id="communityFeed">Loading picks...</div>
      <button class="add-pick-fab" id="addPickFabBtn" title="Post a pick" type="button">+</button>
    </div>
  `;

  const feedEl = document.getElementById('communityFeed');
  document.getElementById('addPickFabBtn')?.addEventListener('click', renderAddPickSheet);

  // Tab filtering
  main.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      communityFilter = e.currentTarget.dataset.filter;
      main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      e.currentTarget.classList.add('tab-btn--active');
      await loadAndRenderCommunityPicks(feedEl);
    });
  });

  await loadAndRenderCommunityPicks(feedEl);
}

async function loadAndRenderCommunityPicks(container) {
  try {
    const picks = await getPicks({
      followingOnly: communityFilter === 'following'
    });

    if (picks.length === 0) {
      container.innerHTML = `
        <div class="empty-picks">
          <div class="empty-picks-icon">📭</div>
          <div class="empty-picks-text">
            ${communityFilter === 'following'
              ? 'Follow users to see their picks here.'
              : 'No picks shared yet. Be the first!'}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="picks-feed">${picks.map(pick => renderPickCard(pick)).join('')}</div>`;

    // Wire up interactions
    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const pickId = btn.dataset.pickId;
        const liked = btn.classList.contains('liked');

        try {
          if (liked) {
            await unlikePick(pickId);
            btn.classList.remove('liked');
          } else {
            await likePick(pickId);
            btn.classList.add('liked');
          }
          // Refresh pick to update like count
          await loadAndRenderCommunityPicks(container);
        } catch (err) {
          console.error('Like action failed:', err);
        }
      });
    });

    container.querySelectorAll('.comments-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('.pick-card');
        const section = card.querySelector('.comments-section');
        if (section.hidden) {
          section.hidden = false;
          loadAndRenderComments(card.dataset.pickId, section);
        } else {
          section.hidden = true;
        }
      });
    });

    container.querySelectorAll('.pick-follow-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const userId = btn.dataset.userId;
        const isFollowing = btn.classList.contains('following');

        try {
          if (isFollowing) {
            await unfollowUser(userId);
            btn.classList.remove('following');
            btn.textContent = 'Follow';
          } else {
            await followUser(userId);
            btn.classList.add('following');
            btn.textContent = 'Following';
          }
        } catch (err) {
          console.error('Follow action failed:', err);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:20px">Error loading picks: ${err.message}</div>`;
  }
}

async function loadAndRenderComments(pickId, commentsEl) {
  try {
    const comments = await getComments(pickId);
    const commentsList = commentsEl.querySelector('.comments-list') || commentsEl;

    if (comments.length === 0) {
      commentsList.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">No comments yet</div>';
    } else {
      commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
          <div class="comment-author">${comment.author?.username || 'Unknown'}</div>
          <div class="comment-text">${comment.text}</div>
          <div class="comment-time">${new Date(comment.created_at).toLocaleDateString()}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load comments:', err);
  }
}

function renderPickCard(pick) {
  const author = pick.author || {};

  return `
    <div class="pick-card" data-pick-id="${pick.id}">
      <div class="pick-card-header">
        <div class="pick-user-info">
          <div class="pick-avatar">${author.username?.[0]?.toUpperCase() || '?'}</div>
          <div class="pick-user-details">
            <div class="pick-username">${author.username || 'Anonymous'}</div>
            <div class="pick-timestamp">${new Date(pick.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <button class="pick-follow-btn ${author.id ? '' : 'hidden'}" data-user-id="${author.id}" type="button">Follow</button>
      </div>

      <div class="pick-card-body">
        <div class="pick-game-info">
          <div class="pick-matchup">${pick.away_team} @ ${pick.home_team}</div>
          <div class="pick-sport">${pick.sport}</div>
        </div>

        <div class="pick-selection-box">
          <div class="pick-selection-label">${pick.bet_type === 'total' ? 'Over/Under' : 'Pick'}</div>
          <div class="pick-selection-text">${pick.selection}</div>
        </div>

        <div class="pick-odds-stake">
          <div class="pick-stat">
            <div class="pick-stat-label">Odds</div>
            <div class="pick-stat-value">${pick.odds >= 0 ? '+' : ''}${pick.odds}</div>
          </div>
          <div class="pick-stat">
            <div class="pick-stat-label">Stake</div>
            <div class="pick-stat-value">$${pick.stake || 0}</div>
          </div>
        </div>

        ${pick.reasoning ? `<div class="pick-reasoning">${pick.reasoning}</div>` : ''}
      </div>

      <div class="pick-card-footer">
        <div class="pick-actions">
          <button class="like-btn" data-pick-id="${pick.id}" type="button">❤️ ${pick.likes_count || 0}</button>
          <button class="comments-btn" type="button">💬 ${pick.comments_count || 0}</button>
        </div>
      </div>

      <div class="comments-section" hidden data-pick-id="${pick.id}">
        <div style="padding:0 16px">
          <div class="comments-header">Comments</div>
          <div class="comments-list"></div>
          <div class="add-comment-form">
            <input class="comment-input" type="text" placeholder="Add a comment…" />
            <button class="comment-submit-btn" type="button">Post</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderAddPickSheet() {
  const modal = document.createElement('div');
  modal.className = 'add-pick-modal';
  modal.innerHTML = `
    <div class="add-pick-content">
      <div class="add-pick-header">
        <span>Share Your Pick</span>
        <button class="add-pick-close" type="button">✕</button>
      </div>

      <form id="addPickForm">
        <div class="pick-form-section">
          <label class="form-label">Select a Game</label>
          <select id="gameSelect" class="form-select" required>
            <option value="">Choose a game…</option>
          </select>
        </div>

        <div class="pick-form-section">
          <label class="form-label">Bet Type</label>
          <select id="betTypeSelect" class="form-select" required>
            <option value="">Choose bet type…</option>
            <option value="moneyline">Moneyline</option>
            <option value="spread">Spread</option>
            <option value="total">Over/Under</option>
            <option value="prop">Prop Bet</option>
          </select>
        </div>

        <div class="pick-form-section">
          <label class="form-label">Your Pick</label>
          <input id="selectionInput" class="form-input" type="text" placeholder="e.g., Lakers -5" required />
        </div>

        <div class="form-row">
          <div class="pick-form-section">
            <label class="form-label">Odds</label>
            <input id="oddsInput" class="form-input" type="number" placeholder="-110" required />
          </div>
          <div class="pick-form-section">
            <label class="form-label">Stake ($)</label>
            <input id="stakeInput" class="form-input" type="number" placeholder="0" min="0" />
          </div>
        </div>

        <div class="pick-form-section">
          <label class="form-label">Your Reasoning</label>
          <textarea id="reasoningInput" class="form-textarea" placeholder="Why do you like this pick?"></textarea>
        </div>

        <div class="form-actions">
          <button class="btn-submit-pick" type="submit">Post Pick</button>
          <button class="btn-cancel-pick" type="button">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Load games for selection
  const gameSelect = modal.querySelector('#gameSelect');
  const games = getGames({ dayOffset: state.dayOffset });
  games.forEach(game => {
    const option = document.createElement('option');
    option.value = game.id;
    option.textContent = `${game.awayTeam} @ ${game.homeTeam} (${game.league})`;
    gameSelect.appendChild(option);
  });

  // Wire up interactions
  modal.querySelector('.add-pick-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.btn-cancel-pick').addEventListener('click', (e) => {
    e.preventDefault();
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#addPickForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const gameId = gameSelect.value;
    const game = gameId ? getGameById(gameId) : null;
    if (!game) {
      alert('Please select a game');
      return;
    }

    try {
      await addPick({
        gameId,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        sport: game.league,
        selection: modal.querySelector('#selectionInput').value,
        odds: parseInt(modal.querySelector('#oddsInput').value),
        betType: modal.querySelector('#betTypeSelect').value,
        stake: parseFloat(modal.querySelector('#stakeInput').value) || 0,
        reasoning: modal.querySelector('#reasoningInput').value,
      });

      modal.remove();
      // Refresh the feed
      const feedEl = document.getElementById('communityFeed');
      if (feedEl) await loadAndRenderCommunityPicks(feedEl);
    } catch (err) {
      alert('Failed to post pick: ' + err.message);
    }
  });
}

function bindCommunityBtn() {
  const btn = document.getElementById('communityBtn');
  if (!btn) return;
  btn.addEventListener('click', renderCommunityFeed);
}

// ── Live Odds view ────────────────────────────────────────────────────────

async function renderLiveOdds() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `
    <div class="live-odds-container">
      <div class="live-header">
        <div class="live-title">
          <span>🔴 Live In-Game Odds</span>
          <div class="live-indicator">
            <span class="live-pulse"></span>
            LIVE
          </div>
        </div>
      </div>
      <div id="liveGamesContainer">Loading live games...</div>
    </div>
  `;

  // Start syncing live odds
  stopLiveOddsSync();
  startLiveOddsSync(() => {
    updateLiveGamesDisplay();
  });

  // Initial render
  await updateLiveGamesDisplay();

  // Stop syncing when leaving this view
  const cleanup = () => stopLiveOddsSync();
  window.addEventListener('hashchange', cleanup);
}

async function updateLiveGamesDisplay() {
  const container = document.getElementById('liveGamesContainer');
  if (!container) return;

  const liveGames = getAllLiveGames();

  if (liveGames.length === 0) {
    container.innerHTML = `
      <div class="live-empty">
        <div class="live-empty-icon">⏸️</div>
        <div class="live-empty-text">
          No live games right now.<br>
          Check back when games are in progress!
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="live-games-grid">
      ${liveGames.map(game => renderLiveGameCard(game)).join('')}
    </div>
  `;

  // Wire up action buttons
  container.querySelectorAll('.live-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const gameId = btn.dataset.gameId;
      navigate(`game/${gameId}`);
    });
  });
}

function renderLiveGameCard(game) {
  const homeScore = game.score?.home || '-';
  const awayScore = game.score?.away || '-';
  const quarterText = getQuarterText(game);

  const homeOdds = game.odds?.homeOdds || '-';
  const awayOdds = game.odds?.awayOdds || '-';
  const overOdds = game.odds?.overOdds || '-';
  const underOdds = game.odds?.underOdds || '-';

  const homeMovement = game.movement?.homeOdds;
  const awayMovement = game.movement?.awayOdds;
  const overMovement = game.movement?.over;
  const underMovement = game.movement?.under;

  return `
    <div class="live-game-card">
      <div class="game-header">
        <div class="game-info">
          <div class="game-matchup">${game.awayTeam.name} @ ${game.homeTeam.name}</div>
          <div class="game-time">${new Date(game.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div style="text-align:right">
          <div class="game-score">${awayScore} - ${homeScore}</div>
          <div class="game-quarter">${quarterText}</div>
        </div>
      </div>

      <div class="odds-section">
        <div class="odds-section-title">Moneyline</div>
        <div class="odds-row">
          <div class="odds-item">
            <div class="odds-name">${game.awayTeam.name}</div>
            <div class="odds-value-group">
              <span class="odds-value">${homeOdds > 0 ? '+' : ''}${homeOdds}</span>
              ${awayMovement ? `
                <span class="movement-indicator ${isSharpMovement(awayMovement) ? 'sharp' : ''}">${getMovementIcon(awayMovement)}</span>
                <span class="movement-badge ${awayMovement.direction}">${formatMovement(awayMovement)}</span>
              ` : ''}
            </div>
          </div>
          <div class="odds-item">
            <div class="odds-name">${game.homeTeam.name}</div>
            <div class="odds-value-group">
              <span class="odds-value">${awayOdds > 0 ? '+' : ''}${awayOdds}</span>
              ${homeMovement ? `
                <span class="movement-indicator ${isSharpMovement(homeMovement) ? 'sharp' : ''}">${getMovementIcon(homeMovement)}</span>
                <span class="movement-badge ${homeMovement.direction}">${formatMovement(homeMovement)}</span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="odds-section">
        <div class="odds-section-title">Totals (Over/Under)</div>
        <div class="odds-row">
          <div class="odds-item">
            <div class="odds-name">Over 45.5</div>
            <div class="odds-value-group">
              <span class="odds-value">${overOdds > 0 ? '+' : ''}${overOdds}</span>
              ${overMovement ? `
                <span class="movement-indicator ${isSharpMovement(overMovement) ? 'sharp' : ''}">${getMovementIcon(overMovement)}</span>
                <span class="movement-badge ${overMovement.direction}">${formatMovement(overMovement)}</span>
              ` : ''}
            </div>
          </div>
          <div class="odds-item">
            <div class="odds-name">Under 45.5</div>
            <div class="odds-value-group">
              <span class="odds-value">${underOdds > 0 ? '+' : ''}${underOdds}</span>
              ${underMovement ? `
                <span class="movement-indicator ${isSharpMovement(underMovement) ? 'sharp' : ''}">${getMovementIcon(underMovement)}</span>
                <span class="movement-badge ${underMovement.direction}">${formatMovement(underMovement)}</span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="last-updated">
        Last updated: ${new Date(game.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      <button class="live-action" data-game-id="${game.id}" type="button">
        Place Bet → ${game.odds?.homeOdds || '-'}
      </button>
    </div>
  `;
}

function getQuarterText(game) {
  if (game.status === 'halftime') return 'HALFTIME';
  if (game.status === 'live') {
    const elapsed = Math.floor((Date.now() - new Date(game.startTime).getTime()) / 60000);
    if (elapsed < 12) return 'Q1';
    if (elapsed < 24) return 'Q2';
    if (elapsed < 36) return 'Q3';
    return 'Q4';
  }
  return game.status.toUpperCase();
}

function bindLiveOddsBtn() {
  const btn = document.getElementById('liveOddsBtn');
  if (!btn) return;
  btn.addEventListener('click', renderLiveOdds);
}

// ── User Profile view ────────────────────────────────────────────────────

async function renderUserProfile() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `<div style="padding:32px;text-align:center">Loading profile...</div>`;

  try {
    const profile = await getCurrentUserProfile();
    const stats = await getUserStats(profile.id);

    const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const initials = getAvatarInitials(profile.username);

    main.innerHTML = `
      <div class="profile-container">
        <div class="profile-header">
          <div class="profile-avatar">
            ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="${profile.username}">` : initials}
          </div>
          <div class="profile-info">
            <div class="profile-username">${profile.username}</div>
            <div class="profile-email">Member since ${joinDate}</div>
            <div class="profile-joindate">Bankroll: $${profile.bankroll?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="profile-actions">
            <button id="editProfileBtn" class="btn-edit-profile" type="button">⚙️ Settings</button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Bets</div>
            <div class="stat-value">${stats.totalBets}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Win Rate</div>
            <div class="stat-value ${stats.winRate >= 52.5 ? 'positive' : 'negative'}">${stats.winRate}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">ROI</div>
            <div class="stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}">${stats.roi}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Profit/Loss</div>
            <div class="stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">${stats.totalProfit >= 0 ? '+' : ''}$${Math.abs(stats.totalProfit).toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Won</div>
            <div class="stat-value">${stats.won}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Lost</div>
            <div class="stat-value">${stats.lost}</div>
          </div>
        </div>

        <!-- Settings Modal -->
        <div id="settingsModal" class="settings-modal" hidden>
          <div class="settings-content">
            <div class="settings-header">
              <span>Profile Settings</span>
              <button class="settings-close" type="button">✕</button>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">Avatar</div>
              <div class="avatar-upload">
                <div class="avatar-preview">
                  ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="${profile.username}">` : getAvatarInitials(profile.username)}
                </div>
                <div class="upload-actions">
                  <button id="uploadAvatarBtn" class="btn-upload-avatar" type="button">📤 Upload</button>
                  <input type="file" id="avatarFile" class="file-input" accept="image/*">
                </div>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">Basic Info</div>
              <div class="form-section">
                <label class="form-label">Username</label>
                <input type="text" class="form-input" id="usernameInput" value="${profile.username}" disabled>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-title">Betting Preferences</div>
              <div class="form-section">
                <label class="form-label">Kelly Fraction</label>
                <select class="form-select" id="kellyFractionSelect">
                  <option value="0.1" ${profile.kelly_fraction === 0.1 ? 'selected' : ''}>10% (Conservative)</option>
                  <option value="0.25" ${profile.kelly_fraction === 0.25 ? 'selected' : ''}>25% (Recommended)</option>
                  <option value="0.5" ${profile.kelly_fraction === 0.5 ? 'selected' : ''}>50% (Aggressive)</option>
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-cancel" id="closeSettingsBtn">Cancel</button>
              <button type="button" class="btn-save" id="saveSettingsBtn">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire up settings modal
    const modal = document.getElementById('settingsModal');
    const editBtn = document.getElementById('editProfileBtn');
    const closeBtn = document.querySelector('.settings-close');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const uploadBtn = document.getElementById('uploadAvatarBtn');
    const fileInput = document.getElementById('avatarFile');

    editBtn.addEventListener('click', () => (modal.hidden = false));
    closeBtn.addEventListener('click', () => (modal.hidden = true));
    closeSettingsBtn.addEventListener('click', () => (modal.hidden = true));
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.hidden = true;
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Uploading...';
        await uploadAvatar(file);
        location.reload();
      } catch (err) {
        alert('Error uploading avatar: ' + err.message);
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 Upload';
      }
    });

    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        const kellyFraction = parseFloat(document.getElementById('kellyFractionSelect').value);
        await updateUserProfile({ kelly_fraction: kellyFraction });
        alert('Settings saved!');
        modal.hidden = true;
      } catch (err) {
        alert('Error saving settings: ' + err.message);
      } finally {
        saveBtn.disabled = false;
      }
    });
  } catch (err) {
    main.innerHTML = `<div style="padding:32px;color:var(--text-muted)">Error loading profile: ${err.message}</div>`;
  }
}

// ── Leaderboard view ────────────────────────────────────────────────────

let currentLeaderboardTab = 'roi';

async function renderLeaderboard() {
  const main = document.getElementById('pageMain');
  if (!main) return;

  main.innerHTML = `
    <div class="leaderboard-container">
      <div class="leaderboard-header">
        <div class="leaderboard-title">🏆 Leaderboard</div>
      </div>

      <div class="leaderboard-tabs">
        <button class="tab-btn tab-btn--active" data-metric="roi" type="button">Best ROI</button>
        <button class="tab-btn" data-metric="profit" type="button">Most Profit</button>
        <button class="tab-btn" data-metric="winRate" type="button">Win Rate</button>
      </div>

      <div id="leaderboardContent">Loading leaderboard...</div>
    </div>
  `;

  // Wire up tab buttons
  main.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentLeaderboardTab = btn.dataset.metric;
      main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      await loadLeaderboardData(main);
    });
  });

  await loadLeaderboardData(main);
}

async function loadLeaderboardData(mainEl) {
  const container = mainEl.querySelector('#leaderboardContent');
  if (!container) return;

  try {
    const users = await getLeaderboard(currentLeaderboardTab, 50);

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-leaderboard">
          <div class="empty-icon">📊</div>
          <div>No users with enough bets yet.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="leaderboard-list">
        ${users.map((user, idx) => renderLeaderboardItem(user, idx)).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;color:var(--text-muted)">Error loading leaderboard: ${err.message}</div>`;
  }
}

function renderLeaderboardItem(user, rank) {
  const rankBadge = rank < 3 ? ['gold', 'silver', 'bronze'][rank] : null;
  const initials = getAvatarInitials(user.username);

  return `
    <div class="leaderboard-item">
      <div class="leaderboard-rank">
        ${rankBadge ? `<div class="rank-badge ${rankBadge}">${rank + 1}</div>` : `<div style="font-size:1.2rem">${rank + 1}</div>`}
      </div>
      <div class="leaderboard-user">
        <div class="leaderboard-avatar">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}">` : initials}
        </div>
        <div class="leaderboard-username">${user.username}</div>
      </div>

      <div class="leaderboard-stats">
        ${currentLeaderboardTab === 'roi' ? `
          <div class="leaderboard-stat">
            <div class="leaderboard-stat-label">ROI</div>
            <div class="leaderboard-stat-value ${user.roi >= 0 ? 'positive' : 'negative'}">${user.roi}%</div>
          </div>
        ` : ''}
        ${currentLeaderboardTab === 'profit' ? `
          <div class="leaderboard-stat">
            <div class="leaderboard-stat-label">Profit</div>
            <div class="leaderboard-stat-value ${user.totalProfit >= 0 ? 'positive' : 'negative'}">${user.totalProfit >= 0 ? '+' : ''}$${Math.abs(user.totalProfit).toFixed(0)}</div>
          </div>
        ` : ''}
        ${currentLeaderboardTab === 'winRate' ? `
          <div class="leaderboard-stat">
            <div class="leaderboard-stat-label">Win Rate</div>
            <div class="leaderboard-stat-value ${user.winRate >= 52.5 ? 'positive' : 'negative'}">${user.winRate}%</div>
          </div>
        ` : ''}
        <div class="leaderboard-stat">
          <div class="leaderboard-stat-label">Bets</div>
          <div class="leaderboard-stat-value">${user.totalBets}</div>
        </div>
      </div>
    </div>
  `;
}

function bindProfileBtn() {
  const btn = document.getElementById('profileBtn');
  if (!btn) return;
  btn.addEventListener('click', renderUserProfile);
}

function bindLeaderboardBtn() {
  const btn = document.getElementById('leaderboardBtn');
  if (!btn) return;
  btn.addEventListener('click', renderLeaderboard);
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


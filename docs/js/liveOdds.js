// ── Live In-Game Odds ───────────────────────────────────────────────────────
import { getGames } from './mockData.js';
import { getOddsForGame } from './mockData.js';
import { getSportsbook } from './sportsbooks.js';

const _liveOddsCache = new Map();
const _priorOdds = new Map();
let _liveRefreshInterval = null;

export function startLiveOddsSync(onUpdate) {
  stopLiveOddsSync();

  _liveRefreshInterval = setInterval(async () => {
    const games = getGames({ dayOffset: 0 });
    const liveGames = games.filter(g => g.status === 'live' || g.status === 'halftime');

    for (const game of liveGames) {
      const odds = getOddsForGame(game);
      const movement = calculateMovement(game.id, odds);
      _liveOddsCache.set(game.id, { odds, movement, timestamp: Date.now() });
      onUpdate?.(game.id, { odds, movement });
    }
  }, 10000); // Update every 10 seconds
}

export function stopLiveOddsSync() {
  if (_liveRefreshInterval) {
    clearInterval(_liveRefreshInterval);
    _liveRefreshInterval = null;
  }
}

export function getLiveOdds(gameId) {
  return _liveOddsCache.get(gameId);
}

export function getAllLiveGames() {
  const games = getGames({ dayOffset: 0 });
  return games.filter(g => g.status === 'live' || g.status === 'halftime').map(game => {
    const liveData = _liveOddsCache.get(game.id);
    return {
      ...game,
      odds: liveData?.odds || getOddsForGame(game),
      movement: liveData?.movement || {},
      lastUpdated: liveData?.timestamp || Date.now(),
    };
  });
}

function calculateMovement(gameId, currentOdds) {
  const prior = _priorOdds.get(gameId);
  _priorOdds.set(gameId, currentOdds);

  if (!prior) return {};

  const movement = {};

  // Compare home moneyline
  if (currentOdds.homeOdds && prior.homeOdds && currentOdds.homeOdds !== prior.homeOdds) {
    movement.homeOdds = {
      from: prior.homeOdds,
      to: currentOdds.homeOdds,
      change: currentOdds.homeOdds - prior.homeOdds,
      direction: currentOdds.homeOdds > prior.homeOdds ? 'up' : 'down',
    };
  }

  // Compare away moneyline
  if (currentOdds.awayOdds && prior.awayOdds && currentOdds.awayOdds !== prior.awayOdds) {
    movement.awayOdds = {
      from: prior.awayOdds,
      to: currentOdds.awayOdds,
      change: currentOdds.awayOdds - prior.awayOdds,
      direction: currentOdds.awayOdds > prior.awayOdds ? 'up' : 'down',
    };
  }

  // Compare totals
  if (currentOdds.overOdds && prior.overOdds && currentOdds.overOdds !== prior.overOdds) {
    movement.over = {
      from: prior.overOdds,
      to: currentOdds.overOdds,
      change: currentOdds.overOdds - prior.overOdds,
      direction: currentOdds.overOdds > prior.overOdds ? 'up' : 'down',
    };
  }

  if (currentOdds.underOdds && prior.underOdds && currentOdds.underOdds !== prior.underOdds) {
    movement.under = {
      from: prior.underOdds,
      to: currentOdds.underOdds,
      change: currentOdds.underOdds - prior.underOdds,
      direction: currentOdds.underOdds > prior.underOdds ? 'up' : 'down',
    };
  }

  return movement;
}

export function getMovementIcon(movement) {
  if (!movement) return '';
  if (movement.direction === 'up') return '📈';
  if (movement.direction === 'down') return '📉';
  return '';
}

export function formatMovement(movement) {
  if (!movement) return '';
  const sign = movement.change > 0 ? '+' : '';
  return `${sign}${movement.change}`;
}

export function isSharpMovement(movement) {
  if (!movement) return false;
  // Significant movement is >= 5 points
  return Math.abs(movement.change) >= 5;
}

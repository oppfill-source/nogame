// ── Advanced Analytics & Performance Tracking ────────────────────────────────
import { supabase } from './auth.js';

export async function getUserBetsForAnalytics(userId, dateRange = null) {
  let query = supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (dateRange?.start && dateRange?.end) {
    query = query
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Failed to fetch bets for analytics:', error);
    return [];
  }

  return data || [];
}

export function calculateEquityCurve(bets) {
  let balance = 0;
  const curve = [];

  bets.forEach((bet, idx) => {
    const profitOrLoss = calculateBetProfit(bet);
    balance += profitOrLoss;
    curve.push({
      date: bet.created_at,
      balance,
      bet,
      index: idx,
    });
  });

  return curve;
}

function calculateBetProfit(bet) {
  if (bet.status === 'pending') return 0;
  if (bet.status === 'won') {
    return (bet.potential_payout || 0) - (bet.stake || 0);
  }
  if (bet.status === 'lost') {
    return -(bet.stake || 0);
  }
  if (bet.status === 'push') {
    return 0;
  }
  return 0;
}

export function calculateAdvancedMetrics(bets) {
  const settled = bets.filter(b => b.status !== 'pending');
  if (settled.length === 0) {
    return {
      totalBets: 0,
      settledBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      winRate: 0,
      roi: 0,
      totalStaked: 0,
      totalProfit: 0,
      avgBetSize: 0,
      maxWin: 0,
      maxLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
    };
  }

  const wins = settled.filter(b => b.status === 'won');
  const losses = settled.filter(b => b.status === 'lost');
  const pushes = settled.filter(b => b.status === 'push');

  const totalStaked = settled.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalWinnings = wins.reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0);
  const totalWon = wins.reduce((sum, b) => sum + (b.potential_payout || 0), 0);
  const totalLost = losses.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalProfit = totalWinnings - totalLost;

  // Streaks
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  settled.forEach(bet => {
    if (bet.status === 'won') {
      currentWinStreak++;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else if (bet.status === 'lost') {
      currentLossStreak++;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  });

  // Equity curve for Sharpe ratio and drawdown
  const curve = calculateEquityCurve(settled);
  const balances = curve.map(c => c.balance);

  // Max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  balances.forEach(balance => {
    if (balance > peak) peak = balance;
    const drawdown = (peak - balance) / Math.max(peak, 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  // Sharpe ratio (simplified: std dev of returns)
  const returns = [];
  for (let i = 1; i < balances.length; i++) {
    const ret = (balances[i] - balances[i - 1]) / Math.max(Math.abs(balances[i - 1]), 1);
    returns.push(ret);
  }
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  const winRate = (wins.length / settled.length) * 100;
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const avgBetSize = totalStaked / settled.length;
  const maxWin = wins.length > 0
    ? Math.max(...wins.map(b => (b.potential_payout || 0) - (b.stake || 0)))
    : 0;
  const maxLoss = losses.length > 0
    ? Math.max(...losses.map(b => -(b.stake || 0)))
    : 0;
  const profitFactor = totalLost > 0 ? totalWon / totalLost : (totalWon > 0 ? Infinity : 0);

  return {
    totalBets: bets.length,
    settledBets: settled.length,
    wins: wins.length,
    losses: losses.length,
    pushes: pushes.length,
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(roi.toFixed(2)),
    totalStaked: parseFloat(totalStaked.toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    avgBetSize: parseFloat(avgBetSize.toFixed(2)),
    maxWin: parseFloat(maxWin.toFixed(2)),
    maxLoss: parseFloat(maxLoss.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
    consecutiveWins: currentWinStreak,
    consecutiveLosses: currentLossStreak,
    longestWinStreak,
    longestLossStreak,
  };
}

export function getMetricsByCategory(bets, category) {
  const categoryBets = bets.filter(b => {
    if (category === 'all') return true;
    return b[category];
  });

  if (categoryBets.length === 0) return null;

  const settled = categoryBets.filter(b => b.status !== 'pending');
  if (settled.length === 0) return null;

  const wins = settled.filter(b => b.status === 'won').length;
  const losses = settled.filter(b => b.status === 'lost').length;
  const totalStaked = settled.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalProfit = settled
    .filter(b => b.status === 'won')
    .reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0) -
    settled.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.stake || 0), 0);

  const winRate = (wins / settled.length) * 100;
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return {
    count: settled.length,
    wins,
    losses,
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(roi.toFixed(2)),
    profit: parseFloat(totalProfit.toFixed(2)),
  };
}

export function getPerformanceByBetType(bets) {
  const types = ['moneyline', 'spread', 'total', 'prop', 'parlay'];
  const performance = {};

  types.forEach(type => {
    const metrics = getMetricsByCategory(bets, 'bet_type');
    if (metrics) performance[type] = metrics;
  });

  return performance;
}

export function getPerformanceBySport(bets) {
  const sports = [...new Set(bets.map(b => b.sport))];
  const performance = {};

  sports.forEach(sport => {
    const sportBets = bets.filter(b => b.sport === sport);
    const settled = sportBets.filter(b => b.status !== 'pending');
    if (settled.length === 0) return;

    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const totalStaked = settled.reduce((sum, b) => sum + (b.stake || 0), 0);
    const totalProfit = settled
      .filter(b => b.status === 'won')
      .reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0) -
      settled.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.stake || 0), 0);

    const winRate = (wins / settled.length) * 100;
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    performance[sport] = {
      count: settled.length,
      wins,
      losses,
      winRate: parseFloat(winRate.toFixed(1)),
      roi: parseFloat(roi.toFixed(2)),
      profit: parseFloat(totalProfit.toFixed(2)),
    };
  });

  return performance;
}

export function getPerformanceByBookmaker(bets) {
  const bookmakers = [...new Set(bets.map(b => b.sportsbook))].filter(Boolean);
  const performance = {};

  bookmakers.forEach(book => {
    const bookBets = bets.filter(b => b.sportsbook === book);
    const settled = bookBets.filter(b => b.status !== 'pending');
    if (settled.length === 0) return;

    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const totalStaked = settled.reduce((sum, b) => sum + (b.stake || 0), 0);
    const totalProfit = settled
      .filter(b => b.status === 'won')
      .reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0) -
      settled.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.stake || 0), 0);

    const winRate = (wins / settled.length) * 100;
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    performance[book] = {
      count: settled.length,
      wins,
      losses,
      winRate: parseFloat(winRate.toFixed(1)),
      roi: parseFloat(roi.toFixed(2)),
      profit: parseFloat(totalProfit.toFixed(2)),
    };
  });

  return performance;
}

export function generateChartData(bets, type = 'equityCurve') {
  if (type === 'equityCurve') {
    return calculateEquityCurve(bets);
  }

  if (type === 'dailyProfit') {
    const byDate = {};
    bets.forEach(bet => {
      const date = new Date(bet.created_at).toLocaleDateString();
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(calculateBetProfit(bet));
    });

    return Object.entries(byDate).map(([date, profits]) => ({
      date,
      profit: profits.reduce((a, b) => a + b, 0),
      count: profits.length,
    }));
  }

  if (type === 'winLossRatio') {
    const settled = bets.filter(b => b.status !== 'pending');
    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const pushes = settled.filter(b => b.status === 'push').length;

    return [
      { label: 'Wins', value: wins, color: '#22C55E' },
      { label: 'Losses', value: losses, color: '#EF4444' },
      { label: 'Pushes', value: pushes, color: '#71717A' },
    ];
  }

  return [];
}

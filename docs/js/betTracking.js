// ── Bet Tracking API ───────────────────────────────────────────────────────
import { supabase } from './auth.js';

export async function addBet(betData) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in to log bets');
  }

  const userId = session.data.session.user.id;

  // Calculate potential payout
  const potentialPayout = calculatePayout(betData.stake, betData.odds);

  const { data, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      game_id: betData.gameId || 'manual',
      game_description: betData.gameDescription,
      sport: betData.sport,
      bet_type: betData.betType,
      selection: betData.selection,
      bookmaker_key: betData.bookmakerKey,
      odds: parseInt(betData.odds),
      stake: parseFloat(betData.stake),
      potential_payout: potentialPayout,
      ai_pick_id: betData.aiPickId || null,
      placed_at: new Date().toISOString(),
    })
    .select();

  if (error) throw error;
  return data?.[0];
}

export async function getBets(filters = {}) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return [];

  const userId = session.data.session.user.id;
  let query = supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.sport) {
    query = query.eq('sport', filters.sport);
  }

  if (filters.bookmaker) {
    query = query.eq('bookmaker_key', filters.bookmaker);
  }

  const { data, error } = await query.order('placed_at', { ascending: false });

  if (error) {
    console.warn('Failed to fetch bets:', error);
    return [];
  }

  return data || [];
}

export async function settleBet(betId, result) {
  // result: 'won' | 'lost' | 'push'
  const { data: bet, error: fetchError } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (fetchError) throw fetchError;
  if (!bet) throw new Error('Bet not found');

  // Update bet status
  const { error: updateError } = await supabase
    .from('bets')
    .update({
      status: result,
      settled_at: new Date().toISOString(),
    })
    .eq('id', betId);

  if (updateError) throw updateError;

  // Record bankroll transaction
  let transactionType = result === 'won' ? 'bet_win' : result === 'lost' ? 'bet_loss' : 'push_refund';
  let amount = 0;

  if (result === 'won') {
    amount = bet.potential_payout - bet.stake;
  } else if (result === 'lost') {
    amount = -bet.stake;
  } else if (result === 'push') {
    amount = 0;
  }

  // Get current balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('bankroll')
    .eq('id', bet.user_id)
    .single();

  const newBalance = (profile?.bankroll || 0) + amount;

  // Create transaction
  await supabase.from('bankroll_transactions').insert({
    user_id: bet.user_id,
    type: transactionType,
    amount: amount,
    balance_after: newBalance,
    bet_id: betId,
    note: `${result.toUpperCase()} - ${bet.game_description}`,
  });

  // Update profile bankroll
  await supabase
    .from('profiles')
    .update({ bankroll: newBalance })
    .eq('id', bet.user_id);

  return { status: result, pnl: amount, newBalance };
}

export async function getBetStats() {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return null;

  const userId = session.data.session.user.id;

  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId);

  if (!bets || bets.length === 0) {
    return {
      totalBets: 0,
      pending: 0,
      won: 0,
      lost: 0,
      push: 0,
      winRate: 0,
      roi: 0,
      totalStaked: 0,
      totalWinnings: 0,
      avgOdds: 0,
    };
  }

  const settled = bets.filter(b => b.status !== 'pending');
  const won = bets.filter(b => b.status === 'won');
  const lost = bets.filter(b => b.status === 'lost');
  const push = bets.filter(b => b.status === 'push');

  const totalStaked = bets.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalWinnings = won.reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0);
  const totalLosses = lost.reduce((sum, b) => sum + (b.stake || 0), 0);

  const roi = totalStaked > 0 ? ((totalWinnings - totalLosses) / totalStaked) * 100 : 0;
  const winRate = settled.length > 0 ? (won.length / settled.length) * 100 : 0;

  const avgOdds = bets.length > 0 ? Math.round(bets.reduce((sum, b) => sum + (b.odds || 0), 0) / bets.length) : 0;

  return {
    totalBets: bets.length,
    pending: bets.filter(b => b.status === 'pending').length,
    won: won.length,
    lost: lost.length,
    push: push.length,
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(roi.toFixed(1)),
    totalStaked: parseFloat(totalStaked.toFixed(2)),
    totalWinnings: parseFloat(totalWinnings.toFixed(2)),
    avgOdds,
  };
}

export function calculatePayout(stake, odds) {
  const stakeNum = parseFloat(stake);
  const oddsNum = parseInt(odds);

  if (oddsNum > 0) {
    return stakeNum + (stakeNum * oddsNum) / 100;
  } else {
    return stakeNum + stakeNum / Math.abs(oddsNum) * 100;
  }
}

export function calculateProfit(stake, odds) {
  const payout = calculatePayout(stake, odds);
  return payout - parseFloat(stake);
}

export function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

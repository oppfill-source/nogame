// ── User Profiles & Accounts ───────────────────────────────────────────────
import { supabase } from './auth.js';

export async function getCurrentUserProfile() {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.data.session.user.id)
    .single();

  if (error) {
    console.warn('Failed to fetch profile:', error);
    return null;
  }

  return data;
}

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bankroll, kelly_fraction, favorite_sports, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('Failed to fetch user profile:', error);
    return null;
  }

  return data;
}

export async function updateUserProfile(updates) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', session.data.session.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserStats(userId) {
  const { data: bets, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId);

  if (error || !bets) {
    return {
      totalBets: 0,
      won: 0,
      lost: 0,
      push: 0,
      winRate: 0,
      roi: 0,
      totalStaked: 0,
      totalProfit: 0,
    };
  }

  const settled = bets.filter(b => b.status !== 'pending');
  const won = bets.filter(b => b.status === 'won');
  const lost = bets.filter(b => b.status === 'lost');
  const totalStaked = bets.reduce((sum, b) => sum + (b.stake || 0), 0);
  const totalProfit = won.reduce((sum, b) => sum + ((b.potential_payout || 0) - (b.stake || 0)), 0) - lost.reduce((sum, b) => sum + (b.stake || 0), 0);

  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100) : 0;
  const winRate = settled.length > 0 ? (won.length / settled.length) * 100 : 0;

  return {
    totalBets: bets.length,
    won: won.length,
    lost: lost.length,
    push: bets.filter(b => b.status === 'push').length,
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(roi.toFixed(1)),
    totalStaked: parseFloat(totalStaked.toFixed(2)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
  };
}

export async function getLeaderboard(metric = 'roi', limit = 50) {
  // Get all profiles with their betting stats
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bankroll, created_at')
    .limit(limit * 2); // Get more to filter by stats

  if (profileError || !profiles) return [];

  // Get stats for each user
  const leaderboardData = await Promise.all(
    profiles.map(async (profile) => {
      const stats = await getUserStats(profile.id);
      return {
        ...profile,
        ...stats,
      };
    })
  );

  // Filter users with at least 5 settled bets for credibility
  const credibleUsers = leaderboardData.filter(u => {
    const settled = u.totalBets - (u.won + u.lost + u.push);
    return settled >= 5 || u.totalStaked >= 100;
  });

  // Sort by metric
  const sorted = credibleUsers.sort((a, b) => {
    if (metric === 'roi') return b.roi - a.roi;
    if (metric === 'profit') return b.totalProfit - a.totalProfit;
    if (metric === 'winRate') return b.winRate - a.winRate;
    return 0;
  });

  return sorted.slice(0, limit);
}

export async function uploadAvatar(file) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const userId = session.data.session.user.id;
  const filename = `${userId}-${Date.now()}.${file.name.split('.').pop()}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filename, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filename);

  await updateUserProfile({ avatar_url: data.publicUrl });

  return data.publicUrl;
}

export function getAvatarInitials(username) {
  return username
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

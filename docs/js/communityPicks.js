// ── Community Picks Feed ────────────────────────────────────────────────────
import { supabase } from './auth.js';

export async function getPicks(filters = {}) {
  let query = supabase
    .from('picks')
    .select(`
      id,
      user_id,
      game_id,
      selection,
      odds,
      bet_type,
      stake,
      reasoning,
      created_at,
      profiles!picks_user_id_fkey(id, username, avatar_url),
      pick_likes(count),
      pick_comments(count)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  // Filter by following if requested
  if (filters.followingOnly) {
    const session = await supabase.auth.getSession();
    if (session.data.session) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.data.session.user.id);

      if (following && following.length > 0) {
        const ids = following.map(f => f.following_id);
        query = query.in('user_id', ids);
      } else {
        return [];
      }
    }
  }

  // Filter by sport if provided
  if (filters.sport) {
    query = query.eq('sport', filters.sport);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Failed to fetch picks:', error);
    return [];
  }

  return (data || []).map(pick => ({
    ...pick,
    likes_count: pick.pick_likes?.[0]?.count || 0,
    comments_count: pick.pick_comments?.[0]?.count || 0,
    author: pick.profiles ? pick.profiles[0] : null,
  }));
}

export async function addPick(pickData) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { data, error } = await supabase
    .from('picks')
    .insert({
      user_id: session.data.session.user.id,
      game_id: pickData.gameId,
      away_team: pickData.awayTeam,
      home_team: pickData.homeTeam,
      sport: pickData.sport,
      selection: pickData.selection,
      odds: pickData.odds,
      bet_type: pickData.betType,
      stake: pickData.stake,
      reasoning: pickData.reasoning,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function likePick(pickId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { error } = await supabase
    .from('pick_likes')
    .insert({
      pick_id: pickId,
      user_id: session.data.session.user.id,
    });

  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unlikePick(pickId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { error } = await supabase
    .from('pick_likes')
    .delete()
    .eq('pick_id', pickId)
    .eq('user_id', session.data.session.user.id);

  if (error) throw error;
}

export async function hasUserLikedPick(pickId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return false;

  const { data } = await supabase
    .from('pick_likes')
    .select('id')
    .eq('pick_id', pickId)
    .eq('user_id', session.data.session.user.id)
    .single();

  return !!data;
}

export async function addComment(pickId, text) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { data, error } = await supabase
    .from('pick_comments')
    .insert({
      pick_id: pickId,
      user_id: session.data.session.user.id,
      text,
    })
    .select(`
      id,
      text,
      created_at,
      profiles!pick_comments_user_id_fkey(id, username, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getComments(pickId) {
  const { data, error } = await supabase
    .from('pick_comments')
    .select(`
      id,
      text,
      created_at,
      profiles!pick_comments_user_id_fkey(id, username, avatar_url)
    `)
    .eq('pick_id', pickId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch comments:', error);
    return [];
  }

  return (data || []).map(comment => ({
    ...comment,
    author: comment.profiles ? comment.profiles[0] : null,
  }));
}

export async function followUser(userId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: session.data.session.user.id,
      following_id: userId,
    });

  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unfollowUser(userId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in');
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', session.data.session.user.id)
    .eq('following_id', userId);

  if (error) throw error;
}

export async function isFollowing(userId) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return false;

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', session.data.session.user.id)
    .eq('following_id', userId)
    .single();

  return !!data;
}

export function subscribeToPickUpdates(pickId, onUpdate) {
  const subscription = supabase
    .channel(`pick:${pickId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pick_likes', filter: `pick_id=eq.${pickId}` },
      () => onUpdate()
    )
    .subscribe();

  return () => subscription.unsubscribe();
}

export function subscribeToCommentUpdates(pickId, onUpdate) {
  const subscription = supabase
    .channel(`comments:${pickId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pick_comments', filter: `pick_id=eq.${pickId}` },
      () => onUpdate()
    )
    .subscribe();

  return () => subscription.unsubscribe();
}

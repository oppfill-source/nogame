// ── AI Picks API ───────────────────────────────────────────────────────────
import { supabase } from './auth.js';

export async function getAiPicks() {
  const now = new Date();
  const { data, error } = await supabase
    .from('ai_picks')
    .select('*')
    .gt('expires_at', now.toISOString())
    .order('value_rating', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('Failed to fetch AI picks:', error);
    return [];
  }

  return (data || []).map(pick => ({
    ...pick,
    odds_data: pick.odds_data ? JSON.parse(pick.odds_data) : []
  }));
}

export async function refreshAiPicks() {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in to generate picks');
  }

  const token = session.data.session.access_token;

  const response = await fetch(
    `${import.meta.url.includes('localhost') ? 'http://localhost:54321' : 'https://axlybeznzibovvqkllzq.supabase.co'}/functions/v1/generate-ai-picks`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      const retryAfter = error.retry_after || 900;
      throw new Error(`Rate limited. Try again in ${Math.ceil(retryAfter / 60)} minutes.`);
    }
    throw new Error(error.error || 'Failed to generate picks');
  }

  const result = await response.json();
  return result.picks || [];
}

export function calculateKellyStake(confidence, odds, kellyFraction = 0.25) {
  // Convert American odds to decimal
  const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  const prob = confidence / 100;

  // Kelly formula: f = (bp - q) / b
  const b = decimal - 1;
  const q = 1 - prob;
  const kellyFull = (b * prob - q) / b;

  // Apply Kelly fraction (quarter-Kelly by default)
  return Math.max(0, kellyFull * kellyFraction);
}

export function formatOdds(odds) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function getOddEmoji(valueRating) {
  if (valueRating >= 9) return '🔥';
  if (valueRating >= 8) return '⭐';
  if (valueRating >= 7) return '✅';
  if (valueRating >= 6) return '👁️';
  return '📊';
}

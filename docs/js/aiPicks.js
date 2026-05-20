// ── AI Picks API ───────────────────────────────────────────────────────────
import { supabase } from './auth.js';

const SUPABASE_URL = 'https://axlybeznzibovvqkllzq.supabase.co';

export async function getAiPicks() {
  const now = new Date();
  const { data, error } = await supabase
    .from('ai_picks')
    .select('*')
    .gt('expires_at', now.toISOString())
    .order('edge_pct', { ascending: false, nullsLast: true })
    .order('value_rating', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('Failed to fetch AI picks:', error);
    return [];
  }

  return (data || []).map(pick => ({
    ...pick,
    odds_data: typeof pick.odds_data === 'string'
      ? safeParse(pick.odds_data)
      : (pick.odds_data || []),
    key_factors: Array.isArray(pick.key_factors)
      ? pick.key_factors
      : (pick.key_factors ? safeParse(pick.key_factors) : []),
  }));
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return []; }
}

/**
 * Call the generate-ai-picks Edge Function with user-specified prompt params.
 * @param {object} params
 *   sport, market_type, risk_level, num_picks, min_confidence,
 *   odds_min, odds_max, strategy, explanation_detail, custom_prompt
 * @returns {Promise<{picks, count, stats, correct_score_table, params}>}
 */
export async function refreshAiPicks(params = {}) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Must be signed in to generate picks');
  }

  const token = session.data.session.access_token;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-ai-picks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (response.status === 429) {
        const minutes = Math.ceil((errBody.retry_after ?? 300) / 60);
        throw new Error(`Rate limited. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      }
      errMsg = errBody.error ?? errMsg;
    } catch (e) {
      if (e.message.startsWith('Rate limited')) throw e;
    }
    throw new Error(errMsg);
  }

  return await response.json();
}

export function calculateKellyStake(confidence, odds, kellyFraction = 0.25) {
  const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  const prob = confidence / 100;
  const b = decimal - 1;
  const q = 1 - prob;
  const kellyFull = (b * prob - q) / b;
  return Math.max(0, kellyFull * kellyFraction);
}

export function formatOdds(odds) {
  if (odds === null || odds === undefined || Number.isNaN(odds)) return '–';
  const n = Number(odds);
  return n > 0 ? `+${n}` : `${n}`;
}

export function getOddEmoji(valueRating) {
  if (valueRating >= 9) return '🔥';
  if (valueRating >= 8) return '⭐';
  if (valueRating >= 7) return '✅';
  if (valueRating >= 6) return '👁️';
  return '📊';
}

export function riskBadge(level) {
  const l = (level ?? '').toLowerCase();
  if (l === 'low' || l === 'conservative') return { emoji: '🟢', label: 'Low Risk' };
  if (l === 'high' || l === 'aggressive')  return { emoji: '🔴', label: 'High Risk' };
  return { emoji: '🟡', label: 'Medium Risk' };
}

/**
 * Conversational chat with Engie. Pass the full message history (oldest → newest)
 * — function returns `{ reply, stats, candidate_count }`.
 */
export async function chatWithAi(messages) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) throw new Error('Must be signed in');
  const token = session.data.session.access_token;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-picks-chat`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Minimal markdown renderer for the chat bubbles.
 * Supports: **bold**, *italic*, `code`, line breaks, `- ` and `* ` lists, and links.
 * Escapes HTML first so user/AI content can't inject tags.
 */
export function renderMarkdown(text) {
  if (!text) return '';
  // 1. escape HTML
  let html = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. code spans
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 3. bold / italic
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // 4. URLs → anchors (very simple)
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // 5. bullet lists (group consecutive lines starting with - or *)
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^[\-*]\s+(.+)$/);
    if (m) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${m[1]}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');

  // 6. paragraph breaks (blank line → <br><br>)
  return out.join('\n').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
}

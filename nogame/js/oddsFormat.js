// ── Odds format converter ────────────────────────────────────────────────────
// Extends bestOdds.js with decimal/fractional output and implied probability.

import { formatOdds } from './bestOdds.js';

export function americanToDecimal(american) {
  if (american == null || Number.isNaN(american)) return null;
  return american > 0 ? 1 + american / 100 : 1 + 100 / (-american);
}

export function americanToFractional(american) {
  if (american == null || Number.isNaN(american)) return '—';
  const decimal = americanToDecimal(american) - 1;
  if (decimal <= 0) return '—';
  const precision = 100;
  const num = Math.round(decimal * precision);
  const den = precision;
  const g = gcd(num, den);
  return `${num / g}/${den / g}`;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/**
 * Format odds in the given display format.
 * @param {number} american - American odds value
 * @param {'american'|'decimal'|'fractional'} format
 * @returns {string}
 */
export function formatOddsInFormat(american, format) {
  if (american == null || Number.isNaN(american)) return '—';
  switch (format) {
    case 'decimal':
      return americanToDecimal(american)?.toFixed(2) ?? '—';
    case 'fractional':
      return americanToFractional(american);
    default:
      return formatOdds(american);
  }
}

/**
 * Returns implied probability as a decimal (0–1).
 */
export function impliedProbability(american) {
  if (american == null || Number.isNaN(american)) return null;
  return american > 0
    ? 100 / (american + 100)
    : (-american) / ((-american) + 100);
}

/**
 * Returns implied probability formatted as "40.8%".
 */
export function formatImpliedProb(american) {
  const p = impliedProbability(american);
  if (p == null) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

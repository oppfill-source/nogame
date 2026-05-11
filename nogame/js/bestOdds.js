// ── American odds utilities ─────────────────────────────────────────────────
// All functions are pure. Tested mentally against canonical examples:
//   +135 vs +120  → +135 better (positive: higher is better)
//   -105 vs -120  → -105 better (negative: closer to zero is better)
//   +100 vs -110  → +100 better (a positive is always better than a negative
//                                for the same selection at the same line)
//
// For spread/total markets, comparing odds across different lines is
// meaningless from the bettor's perspective (the *price* differs because the
// *product* differs). We therefore group by `line` before picking a best.

/**
 * @typedef {Object} OddsMarket
 * @property {string} gameId - Game ID
 * @property {string} sportsbookId - Sportsbook ID (e.g. 'dk', 'fd')
 * @property {'moneyline'|'spread'|'total'} marketType
 * @property {'home'|'away'|'over'|'under'} selection
 * @property {number|null} line - Null for moneyline; spread/total value for others
 * @property {number} oddsAmerican - American odds (e.g., +150, -110)
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * Normalize an American-odds value into a single comparable score where
 * "higher is always better for the bettor". This lets us compare positive
 * and negative odds with a single `>` operator.
 *
 * Implementation: convert American → implied probability, then return its
 * negation. Lower implied probability = better payout for the same outcome,
 * so negating gives us a "higher is better" score.
 *
 * @param {number} odds - American odds (e.g., +150, -110)
 * @returns {number} - Normalized score (higher is better for the bettor)
 */

/**
 * Normalize an American-odds value into a single comparable score where
 * "higher is always better for the bettor". This lets us compare positive
 * and negative odds with a single `>` operator.
 *
 * Implementation: convert American → implied probability, then return its
 * negation. Lower implied probability = better payout for the same outcome,
 * so negating gives us a "higher is better" score.
 */
export function normalizeAmericanOdds(odds) {
  if (odds == null || Number.isNaN(odds)) return -Infinity;
  const impliedProb = odds > 0
    ? 100 / (odds + 100)
    : (-odds) / ((-odds) + 100);
  return -impliedProb;
}

/**
 * Convert American odds to decimal odds (for analytics, not display).
 */
export function americanToDecimal(odds) {
  if (odds == null || Number.isNaN(odds)) return null;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
}

/**
 * Returns -1 / 0 / 1, comparator-style. Useful for Array.sort.
 *   compareAmericanOdds(+135, +120) → 1   (a is better)
 *   compareAmericanOdds(-120, -105) → -1  (b is better)
 */
export function compareAmericanOdds(a, b) {
  const na = normalizeAmericanOdds(a);
  const nb = normalizeAmericanOdds(b);
  if (na === nb) return 0;
  return na > nb ? 1 : -1;
}

/**
 * Format American odds for display: '+135', '-110', 'EVEN' for +100.
 */
export function formatOdds(odds) {
  if (odds == null || Number.isNaN(odds)) return '—';
  if (odds === 100 || odds === -100) return 'EVEN';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Format a spread/total line: '-2.5', '+3', '47.5'. Pass `signed=true` to
 * force a sign (used for spreads), `false` for unsigned (used for totals).
 */
export function formatLine(line, signed = false) {
  if (line == null || Number.isNaN(line)) return '';
  if (!signed) return `${line}`;
  if (line === 0) return 'PK';
  return line > 0 ? `+${line}` : `${line}`;
}

// ── Grouping & best-odds selection ──────────────────────────────────────────

/**
 * Group an array of OddsMarket entries by (marketType, selection, line).
 * Lines that should be compared together MUST share the same line.
 *
 * Returns: Map<groupKey, OddsMarket[]>
 */
export function groupOddsByMarketAndSelection(odds) {
  const groups = new Map();
  for (const o of odds) {
    const key = oddsGroupKey(o);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  return groups;
}

export function oddsGroupKey(o) {
  // For moneyline, line is irrelevant. For spread/total, line matters.
  const line = o.marketType === 'moneyline' ? '' : (o.line ?? '');
  return `${o.marketType}::${o.selection}::${line}`;
}

/**
 * Given odds for a single (market, selection, line) group, return the set of
 * sportsbookIds tied for best. Multiple winners on a tie.
 */
export function getBestOddsInGroup(group) {
  if (!group || group.length === 0) return new Set();
  let bestScore = -Infinity;
  for (const o of group) {
    const s = normalizeAmericanOdds(o.oddsAmerican);
    if (s > bestScore) bestScore = s;
  }
  const winners = new Set();
  for (const o of group) {
    if (normalizeAmericanOdds(o.oddsAmerican) === bestScore) {
      winners.add(o.sportsbookId);
    }
  }
  return winners;
}

/**
 * High-level helper: given a flat list of odds for a game and a market type,
 * return:
 *   - selections: ordered list of selections (e.g. ['home','away'] for ML,
 *                 ['home','away'] for spread paired with their lines)
 *   - bestByGroup: Map<groupKey, Set<sportsbookId>>  ← which books are best
 *   - rows: per-sportsbook row data ready for table rendering
 *
 * Used by the odds-table renderer.
 */
export function getBestOddsByMarket(odds, marketType) {
  const filtered = odds.filter(o => o.marketType === marketType);
  const groups = groupOddsByMarketAndSelection(filtered);
  const bestByGroup = new Map();
  for (const [key, group] of groups) {
    bestByGroup.set(key, getBestOddsInGroup(group));
  }
  return { groups, bestByGroup };
}

/**
 * Is a given OddsMarket tied for best within its group?
 */
export function isBestOdds(odd, bestByGroup) {
  const winners = bestByGroup.get(oddsGroupKey(odd));
  return winners ? winners.has(odd.sportsbookId) : false;
}

/**
 * Implied probability from American odds (0–1 decimal).
 * Convenience export; full format utilities are in oddsFormat.js.
 */
export function impliedProbability(american) {
  if (american == null || Number.isNaN(american)) return null;
  return american > 0
    ? 100 / (american + 100)
    : (-american) / ((-american) + 100);
}

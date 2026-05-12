// ── Sportsbook provider registry ─────────────────────────────────────────────
// Single source of truth for sportsbook metadata. UI components and data
// services should reference books by id, never hardcode names/colors.
//
// statesAvailable is a SAMPLE list and intentionally non-exhaustive. Replace
// with a compliance-vetted list before going to production.

export const SPORTSBOOKS = [
  {
    id: 'dk',     name: 'DraftKings',  short: 'DK',
    color: '#53D337', emoji: '🎮',
    statesAvailable: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MA','MD','MI','NH','NJ','NY','OH','OR','PA','TN','VA','VT','WV','WY'],
  },
  {
    id: 'fd',     name: 'FanDuel',     short: 'FD',
    color: '#1493FF', emoji: '⚡',
    statesAvailable: ['AZ','CO','CT','IL','IN','IA','KS','KY','LA','MA','MD','MI','NJ','NY','OH','PA','TN','VA','VT','WV','WY'],
  },
  {
    id: 'mgm',    name: 'BetMGM',      short: 'MGM',
    color: '#BFA15B', emoji: '🎰',
    statesAvailable: ['AZ','CO','DC','IL','IN','IA','KS','KY','LA','MA','MD','MI','MS','NJ','NY','OH','PA','TN','VA','WV','WY'],
  },
  {
    id: 'czr',    name: 'Caesars',     short: 'CZR',
    color: '#C9A961', emoji: '👑',
    statesAvailable: ['AZ','CO','IL','IN','IA','KS','KY','LA','MD','MI','NJ','NY','OH','PA','TN','VA','WV','WY'],
  },
  {
    id: 'espn',   name: 'ESPN BET',    short: 'ESPN',
    color: '#FF0033', emoji: '📺',
    statesAvailable: ['AZ','CO','IA','IL','IN','KS','KY','LA','MA','MD','MI','NJ','NC','OH','PA','TN','VA','WV'],
  },
  {
    id: 'fan',    name: 'Fanatics',    short: 'FAN',
    color: '#1B1B1B', emoji: '⭐',
    statesAvailable: ['CO','KY','MA','MD','MI','NC','NJ','OH','PA','TN','VA','WV'],
  },
  {
    id: 'b365',   name: 'bet365',      short: 'B365',
    color: '#FFCC00', emoji: '🌍',
    statesAvailable: ['CO','IA','IL','IN','KY','LA','NC','NJ','OH','VA'],
  },
  {
    id: 'br',     name: 'BetRivers',   short: 'BR',
    color: '#1670D6', emoji: '🏞️',
    statesAvailable: ['AZ','CO','IL','IN','IA','LA','MD','MI','NJ','NY','OH','PA','VA','WV'],
  },
  {
    id: 'hr',     name: 'Hard Rock',   short: 'HR',
    color: '#E31837', emoji: '🎸',
    statesAvailable: ['AZ','FL','IN','NJ','OH','TN','VA'],
  },
  {
    id: 'bally',  name: 'Bally Bet',   short: 'BAL',
    color: '#D50032', emoji: '🎪',
    statesAvailable: ['AZ','CO','IN','IA','NJ','NY','OH','VA'],
  },
];

const BY_ID = Object.fromEntries(SPORTSBOOKS.map(b => [b.id, b]));

export function getSportsbook(id) {
  return BY_ID[id] || null;
}

export function getSportsbooks() {
  return SPORTSBOOKS.slice();
}

export function getSportsbooksAvailableInState(stateCode) {
  if (!stateCode) return SPORTSBOOKS.slice();
  return SPORTSBOOKS.filter(b => b.statesAvailable.includes(stateCode));
}

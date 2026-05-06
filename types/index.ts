// ─── Re-export Odds API types for convenience ────────────────────────────────
export type { OddsGame, Bookmaker as OddsBookmaker, Market, Outcome } from "../lib/odds-api";

// ─── Display-ready game (normalized from OddsGame) ───────────────────────────
export type NormalizedGame = {
  id: string;
  sport: string;      // display label e.g. "NBA"
  sportKey: string;   // Odds API key e.g. "basketball_nba"
  homeTeam: string;
  awayTeam: string;
  time: string;             // formatted "7:30 PM ET"
  commenceTime: string;     // raw ISO timestamp for filtering/sorting
  homeOdds: number;
  awayOdds: number;
  spread: number;
  total: number;
};

// ─── Bet tracker ─────────────────────────────────────────────────────────────
export type BetType = "moneyline" | "spread" | "total" | "parlay";
export type BetStatus = "pending" | "won" | "lost" | "push";

export type Bet = {
  id: string;
  user_id?: string;
  game_id: string;
  game_description: string;
  sport: string;
  bet_type: BetType;
  selection: string;
  bookmaker_key?: string;
  odds: number;
  stake: number;
  potential_payout: number;
  status: BetStatus;
  ai_pick_id?: string;
  placed_at: string;
  settled_at?: string;
};

// ─── User / Auth ──────────────────────────────────────────────────────────────
export type { OddsFormat } from "../lib/odds-utils";

export type Profile = {
  id: string;
  username: string;
  avatar_url?: string;
  push_token?: string;
  bankroll: number;
  kelly_fraction: number;
  favorite_sports: string[];
  last_ai_request?: string;
  created_at: string;
  phone_number?: string;
  phone_verified: boolean;
  odds_format: import("../lib/odds-utils").OddsFormat;
  token_balance: number;
  follower_count: number;
  following_count: number;
};

// ─── Virtual Tokens ───────────────────────────────────────────────────────────
export type TokenTransactionType = "signup_bonus" | "bet_placed" | "bet_won" | "bet_lost" | "bet_push";

export type TokenTransaction = {
  id: string;
  user_id: string;
  type: TokenTransactionType;
  amount: number;
  balance_after: number;
  bet_id?: string;
  note?: string;
  created_at: string;
};

// ─── AI Picks ─────────────────────────────────────────────────────────────────
export type AiPickOddsEntry = { key: string; title: string; odds: number };

export type AiPick = {
  id: string;
  game_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  selection: string;
  bet_type: BetType;
  recommended_odds: number;
  bookmaker_key: string;
  value_rating: number; // 1-10
  confidence_pct?: number; // 0-100 win probability estimate
  reasoning: string;
  model_version: string;
  created_at: string;
  expires_at: string;
  odds_data?: AiPickOddsEntry[] | null; // sorted best→worst odds per bookmaker for this pick
};

// ─── Community ────────────────────────────────────────────────────────────────
export type CommunityPick = {
  id: string;
  user_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  selection: string;
  bet_type: BetType;
  odds: number;
  bookmaker_key?: string;
  note?: string;
  result?: "won" | "lost" | "push";
  ai_pick_id?: string;
  like_count: number;
  comment_count: number;
  copy_count: number;
  created_at: string;
  profiles?: { username: string; avatar_url?: string };
};

export type Comment = {
  id: string;
  pick_id: string;
  user_id: string;
  body: string;
  upvote_count: number;
  created_at: string;
  profiles?: { username: string; avatar_url?: string };
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url?: string;
  follower_count: number;
  total_picks: number;
  won_picks: number;
  lost_picks: number;
  win_rate: number;
  trust_score: number;
};

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotificationType = "new_follower" | "pick_comment" | "pick_liked" | "pick_copied";

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id?: string;
  pick_id?: string;
  read: boolean;
  created_at: string;
  actor?: { username: string; avatar_url?: string };
  pick?: { matchup: string; selection: string };
};

// ─── Affiliate / Bookmakers ───────────────────────────────────────────────────
export type BookmakerConfig = {
  key: string;
  title: string;
  deepLink: string;
  webUrl: string;
  affiliateParam: string;
  bonus?: string;
  rating: number;
  regions: string[];
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
};

// ─── Bankroll ─────────────────────────────────────────────────────────────────
export type BankrollTransaction = {
  id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "bet_win" | "bet_loss";
  amount: number;
  balance_after: number;
  bet_id?: string;
  note?: string;
  created_at: string;
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { LeaderboardEntry } from "../types";

export type LeaderboardPeriod = "all" | "month" | "week";

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { user_id: "u1", username: "SharpBettor_88", follower_count: 142, total_picks: 38, won_picks: 26, lost_picks: 12, win_rate: 68.4, trust_score: 68.4 },
  { user_id: "u2", username: "ValueBetKing",   follower_count: 98,  total_picks: 52, won_picks: 33, lost_picks: 19, win_rate: 63.5, trust_score: 63.5 },
  { user_id: "u3", username: "MLBAnalyst",     follower_count: 61,  total_picks: 29, won_picks: 18, lost_picks: 11, win_rate: 62.1, trust_score: 62.1 },
  { user_id: "u4", username: "PuckDrop_Pro",   follower_count: 44,  total_picks: 21, won_picks: 13, lost_picks:  8, win_rate: 61.9, trust_score: 61.9 },
  { user_id: "u5", username: "GridironGuru",   follower_count: 37,  total_picks: 45, won_picks: 27, lost_picks: 18, win_rate: 60.0, trust_score: 60.0 },
];

export function useLeaderboard(period: LeaderboardPeriod = "all") {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { period });
      if (error || !data?.length) return MOCK_LEADERBOARD;
      return data as LeaderboardEntry[];
    },
    staleTime: 5 * 60_000,
    placeholderData: MOCK_LEADERBOARD,
  });
}

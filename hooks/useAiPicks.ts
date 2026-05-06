import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCachedAiPicks, refreshAiPicks } from "../lib/ai";
import type { AiPick } from "../types";

const MOCK_AI_PICKS: AiPick[] = [
  {
    id: "mock-ai-1",
    game_id: "mock-1",
    sport: "NBA",
    home_team: "Los Angeles Lakers",
    away_team: "Boston Celtics",
    commence_time: new Date().toISOString(),
    selection: "Boston Celtics",
    bet_type: "moneyline",
    recommended_odds: -105,
    bookmaker_key: "draftkings",
    value_rating: 8,
    reasoning: "Celtics have covered 7 of their last 9 road games. Market undervaluing their defensive consistency away from home.",
    model_version: "claude-sonnet-4-6",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "mock-ai-2",
    game_id: "mock-4",
    sport: "NFL",
    home_team: "Kansas City Chiefs",
    away_team: "Buffalo Bills",
    commence_time: new Date().toISOString(),
    selection: "Buffalo Bills +3",
    bet_type: "spread",
    recommended_odds: -110,
    bookmaker_key: "fanduel",
    value_rating: 7,
    reasoning: "Bills are 6-1 ATS as home underdogs under Josh Allen. Public overvaluing KC in primetime spots.",
    model_version: "claude-sonnet-4-6",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: "mock-ai-3",
    game_id: "mock-3",
    sport: "NHL",
    home_team: "Toronto Maple Leafs",
    away_team: "Montreal Canadiens",
    commence_time: new Date().toISOString(),
    selection: "Under 6.0",
    bet_type: "total",
    recommended_odds: -115,
    bookmaker_key: "betmgm",
    value_rating: 6,
    reasoning: "Both goaltenders are top-10 in save percentage this month. Cold weather dome historically suppresses scoring.",
    model_version: "claude-sonnet-4-6",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
];

export function useAiPicks() {
  const apiKey = process.env.EXPO_PUBLIC_SUPABASE_URL;

  return useQuery({
    queryKey: ["ai-picks"],
    queryFn: async (): Promise<AiPick[]> => {
      if (!apiKey) return MOCK_AI_PICKS;
      try {
        const picks = await getCachedAiPicks();
        return picks.length > 0 ? picks : MOCK_AI_PICKS;
      } catch {
        return MOCK_AI_PICKS;
      }
    },
    staleTime: 5 * 60_000,
    placeholderData: MOCK_AI_PICKS,
  });
}

export function useRefreshAiPicks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: refreshAiPicks,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-picks"] }),
  });
}

import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { AiPickCard } from "../../components/ai/AiPickCard";
import { AddBetSheet } from "../../components/bets/AddBetSheet";
import { LoadingState } from "../../components/ui/LoadingState";
import { useAiPicks, useRefreshAiPicks } from "../../hooks/useAiPicks";
import { useAddBet } from "../../hooks/useBets";
import { useUIStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AiPick, Bet } from "../../types";

export default function AiPicksScreen() {
  const { data: picks, isLoading, dataUpdatedAt } = useAiPicks();
  const { mutate: refresh, isPending: isRefreshing, error: refreshError } = useRefreshAiPicks();
  const { mutate: addBet } = useAddBet();
  const user = useAuthStore((s) => s.user);
  const { markAiPickViewed, viewedAiPickIds } = useUIStore();
  const [betDraft, setBetDraft] = useState<Partial<Bet> | undefined>();

  // Mark all current picks as viewed when screen is open
  useEffect(() => {
    picks?.forEach((p) => markAiPickViewed(p.id));
  }, [picks]);

  function handleTrack(pick: AiPick) {
    setBetDraft({
      game_id: pick.game_id,
      game_description: `${pick.away_team} @ ${pick.home_team}`,
      sport: pick.sport,
      bet_type: pick.bet_type,
      selection: pick.selection,
      bookmaker_key: pick.bookmaker_key,
      odds: pick.recommended_odds,
    });
  }

  if (isLoading) return <LoadingState message="Loading AI picks..." />;

  const lastUpdated = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
    : null;

  return (
    <View className="flex-1 bg-gray-950">
      <FlatList
        data={picks ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AiPickCard pick={item} onTrack={user ? handleTrack : undefined} />
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-white text-2xl font-bold">AI Picks</Text>
                <Text className="text-gray-400 text-sm">
                  Powered by Claude · Value bets identified
                </Text>
              </View>
              <Pressable
                className={`px-3 py-2 rounded-lg ${isRefreshing ? "bg-gray-800" : "bg-green-500/20 border border-green-500/40"}`}
                onPress={() => refresh()}
                disabled={isRefreshing}
              >
                <Text className={`text-sm font-semibold ${isRefreshing ? "text-gray-500" : "text-green-400"}`}>
                  {isRefreshing ? "Analyzing..." : "Refresh"}
                </Text>
              </Pressable>
            </View>
            {lastUpdated && (
              <Text className="text-gray-600 text-xs mt-1">Updated {lastUpdated}</Text>
            )}
            {refreshError && (
              <View className="mt-2 bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                <Text className="text-yellow-400 text-xs">
                  Rate limited — refreshes are limited to once per 15 minutes to conserve AI usage.
                </Text>
              </View>
            )}
            {!user && (
              <View className="mt-3 bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                <Text className="text-blue-300 text-sm">
                  Sign in to track AI picks directly to your bet slip.
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center mt-16 px-8">
            <Text className="text-gray-500 text-lg">No picks yet</Text>
            <Text className="text-gray-600 text-sm mt-1 text-center">
              Tap Refresh to analyze today's games and find value bets
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => refresh()} tintColor="#22c55e" />
        }
      />

      <AddBetSheet
        visible={!!betDraft}
        draft={betDraft}
        onClose={() => setBetDraft(undefined)}
        onConfirm={(bet) => {
          if (!user) return;
          addBet(bet);
          setBetDraft(undefined);
        }}
      />
    </View>
  );
}

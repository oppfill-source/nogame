import { View, Text, FlatList, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { GameCard } from "../../components/games/GameCard";
import { SportFilterBar } from "../../components/games/SportFilterBar";
import { LoadingState } from "../../components/ui/LoadingState";
import { useGames } from "../../hooks/useGames";
import { useAiPicks } from "../../hooks/useAiPicks";
import { useUIStore } from "../../stores/ui";
import type { NormalizedGame } from "../../types";

function DailySummaryHeader({
  gameCount,
  highValueCount,
  soonCount,
}: {
  gameCount: number;
  highValueCount: number;
  soonCount: number;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <View className="px-4 pt-4 pb-3">
      <Text className="text-gray-500 text-xs font-medium uppercase tracking-widest mb-1">
        {today}
      </Text>
      <Text className="text-white text-2xl font-bold">Tonight's Games</Text>
      <View className="flex-row items-center gap-2 mt-1 flex-wrap">
        <Text className="text-gray-400 text-sm">
          {gameCount} {gameCount === 1 ? "game" : "games"}
        </Text>
        {soonCount > 0 && (
          <>
            <Text className="text-gray-600">·</Text>
            <View className="bg-amber-500/20 rounded px-1.5 py-0.5">
              <Text style={{ color: "#fbbf24", fontSize: 11, fontWeight: "700" }}>
                {soonCount} starting soon
              </Text>
            </View>
          </>
        )}
        {highValueCount > 0 && (
          <>
            <Text className="text-gray-600">·</Text>
            <Text className="text-indigo-400 text-sm">
              {highValueCount} AI {highValueCount === 1 ? "pick" : "picks"}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function AiAlertBanner({ count }: { count: number }) {
  const router = useRouter();
  if (count === 0) return null;
  return (
    <Pressable
      className="mx-4 mb-3 rounded-xl border border-indigo-500/30 overflow-hidden active:opacity-80"
      style={{ backgroundColor: "#1E1B4B20" }}
      onPress={() => router.push("/(tabs)/ai-picks" as any)}
    >
      <View className="h-0.5 bg-indigo-500" />
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 rounded-full bg-indigo-500/20 items-center justify-center">
            <Text className="text-sm">⚡</Text>
          </View>
          <View>
            <Text className="text-white font-semibold text-sm">
              {count} high-value {count === 1 ? "pick" : "picks"} available
            </Text>
            <Text className="text-indigo-400 text-xs">Engie · value rating 7+</Text>
          </View>
        </View>
        <Text className="text-gray-500 text-xs">View →</Text>
      </View>
    </Pressable>
  );
}

export default function GamesScreen() {
  const { selectedSport, setSelectedSport } = useUIStore();
  const { data: gamesData, isLoading, refetch, isRefetching } = useGames(selectedSport);
  const games: NormalizedGame[] | undefined = gamesData;
  const { data: aiPicks } = useAiPicks();

  const aiPickGameIds = new Set((aiPicks ?? []).map((p) => p.game_id));
  const highValueCount = (aiPicks ?? []).filter((p) => p.value_rating >= 7).length;

  // Count games starting within the next 2 hours
  const soonCount = (games ?? []).filter((g) => {
    if (!g.commenceTime) return false;
    const mins = (new Date(g.commenceTime).getTime() - Date.now()) / 60_000;
    return mins > 0 && mins <= 120;
  }).length;

  if (isLoading && !games?.length) {
    return (
      <View className="flex-1 bg-gray-950">
        <SportFilterBar selected={selectedSport} onChange={setSelectedSport} />
        <LoadingState message="Loading tonight's games..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-950">
      <SportFilterBar selected={selectedSport} onChange={setSelectedSport} />
      <FlatList
        data={games ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GameCard game={item} hasAiPick={aiPickGameIds.has(item.id)} />
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <DailySummaryHeader
              gameCount={games?.length ?? 0}
              highValueCount={highValueCount}
              soonCount={soonCount}
            />
            <AiAlertBanner count={highValueCount} />
          </View>
        }
        ListEmptyComponent={
          <View className="items-center mt-20 px-8">
            <Text className="text-gray-500 text-lg font-semibold text-center">No games right now</Text>
            <Text className="text-gray-600 text-sm mt-2 text-center leading-5">
              Try selecting a different sport or check back later.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#22C55E"
          />
        }
      />
    </View>
  );
}

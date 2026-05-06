import { Pressable, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Badge } from "../ui/Badge";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import type { NormalizedGame } from "../../types";

type Props = { game: NormalizedGame; hasAiPick?: boolean };

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

export function GameCard({ game, hasAiPick }: Props) {
  const router = useRouter();
  const formatOdds = useFormatOdds();

  const minsAway = game.commenceTime ? minutesUntil(game.commenceTime) : Infinity;
  const isStartingSoon = minsAway > 0 && minsAway <= 120;
  const isLive = minsAway <= 0 && minsAway >= -180; // within 3h past tip

  function handlePress() {
    const params = game.sportKey ? `?sport=${encodeURIComponent(game.sportKey)}` : "";
    router.push(`/game/${game.id}${params}` as any);
  }

  return (
    <Pressable
      className="mx-4 mb-3 rounded-xl border overflow-hidden active:opacity-70"
      style={{
        backgroundColor: "#1C1C1F",
        borderColor: isLive ? "#ef4444" : isStartingSoon ? "#f59e0b" : "#374151",
      }}
      onPress={handlePress}
    >
      {/* accent bar */}
      {isLive && <View className="h-0.5 bg-red-500" />}
      {!isLive && isStartingSoon && <View className="h-0.5 bg-amber-500" />}
      {!isLive && !isStartingSoon && hasAiPick && <View className="h-0.5 bg-green-500" />}

      <View className="p-4">
        {/* Meta row */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row gap-2 items-center">
            <Badge label={game.sport} variant="success" />
            {hasAiPick && <Badge label="AI Pick" variant="ai" />}
            {isLive && (
              <View className="bg-red-500/20 rounded px-1.5 py-0.5">
                <Text style={{ color: "#f87171", fontSize: 10, fontWeight: "700" }}>● LIVE</Text>
              </View>
            )}
            {!isLive && isStartingSoon && (
              <View className="bg-amber-500/20 rounded px-1.5 py-0.5">
                <Text style={{ color: "#fbbf24", fontSize: 10, fontWeight: "700" }}>
                  {minsAway < 60 ? `${minsAway}m` : `${Math.round(minsAway / 60)}h`}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 text-xs">{game.time}</Text>
        </View>

        {/* Matchup */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="text-white font-semibold text-base" numberOfLines={1}>
              {game.awayTeam}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">Away</Text>
          </View>
          <View className="px-3">
            <Text className="text-gray-600 font-bold text-sm">@</Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-white font-semibold text-base" numberOfLines={1}>
              {game.homeTeam}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">Home</Text>
          </View>
        </View>

        {/* Odds chips */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-gray-800 rounded-lg p-2 items-center">
            <Text className="text-gray-500 text-xs mb-0.5">Away ML</Text>
            <Text className="text-white font-bold text-sm">{formatOdds(game.awayOdds)}</Text>
          </View>
          {game.spread !== 0 && (
            <View className="flex-1 bg-gray-800 rounded-lg p-2 items-center">
              <Text className="text-gray-500 text-xs mb-0.5">Spread</Text>
              <Text className="text-white font-bold text-sm">
                {game.spread > 0 ? "+" : ""}{game.spread}
              </Text>
            </View>
          )}
          <View className="flex-1 bg-gray-800 rounded-lg p-2 items-center">
            <Text className="text-gray-500 text-xs mb-0.5">Home ML</Text>
            <Text className="text-white font-bold text-sm">{formatOdds(game.homeOdds)}</Text>
          </View>
          {game.total > 0 && (
            <View className="flex-1 bg-gray-800 rounded-lg p-2 items-center">
              <Text className="text-gray-500 text-xs mb-0.5">O/U</Text>
              <Text className="text-white font-bold text-sm">{game.total}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

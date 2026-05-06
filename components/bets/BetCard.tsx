import { View, Text, Pressable } from "react-native";
import { Badge } from "../ui/Badge";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import type { Bet, BetStatus } from "../../types";

const STATUS_CONFIG: Record<BetStatus, { variant: "warning" | "success" | "danger" | "default"; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  won:     { variant: "success", label: "Won ✓" },
  lost:    { variant: "danger",  label: "Lost" },
  push:    { variant: "default", label: "Push" },
};

type Props = {
  bet: Bet;
  onMarkWon?: () => void;
  onMarkLost?: () => void;
  onRemove?: () => void;
};

export function BetCard({ bet, onMarkWon, onMarkLost, onRemove }: Props) {
  const formatOdds = useFormatOdds();
  const statusCfg = STATUS_CONFIG[bet.status];

  return (
    <View className="bg-gray-900 mx-4 mb-3 rounded-xl p-4 border border-gray-800">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-white font-semibold" numberOfLines={1}>
            {bet.game_description}
          </Text>
          <Text className="text-gray-400 text-sm mt-0.5">
            {bet.selection} • {bet.bet_type}
          </Text>
        </View>
        <Badge label={statusCfg.label} variant={statusCfg.variant} />
      </View>

      <View className="flex-row justify-between mt-2">
        <View>
          <Text className="text-gray-500 text-xs">Odds</Text>
          <Text className="text-white font-bold">{formatOdds(bet.odds)}</Text>
        </View>
        <View>
          <Text className="text-gray-500 text-xs">Stake</Text>
          <Text className="text-white font-bold">${bet.stake.toFixed(2)}</Text>
        </View>
        <View>
          <Text className="text-gray-500 text-xs">To Win</Text>
          <Text className="text-green-400 font-bold">${bet.potential_payout.toFixed(2)}</Text>
        </View>
        <View>
          <Text className="text-gray-500 text-xs">Sport</Text>
          <Text className="text-gray-300 font-medium">{bet.sport}</Text>
        </View>
      </View>

      {bet.status === "pending" && (onMarkWon || onMarkLost || onRemove) && (
        <View className="flex-row gap-2 mt-3">
          {onMarkWon && (
            <Pressable className="flex-1 bg-green-500/20 rounded-lg py-2 items-center" onPress={onMarkWon}>
              <Text className="text-green-400 text-sm font-semibold">Won</Text>
            </Pressable>
          )}
          {onMarkLost && (
            <Pressable className="flex-1 bg-red-500/20 rounded-lg py-2 items-center" onPress={onMarkLost}>
              <Text className="text-red-400 text-sm font-semibold">Lost</Text>
            </Pressable>
          )}
          {onRemove && (
            <Pressable className="bg-gray-800 rounded-lg py-2 px-4 items-center" onPress={onRemove}>
              <Text className="text-gray-400 text-sm">Remove</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

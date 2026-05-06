import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useBankrollStore } from "../../stores/bankroll";
import { useTokenBalance } from "../../hooks/useTokens";
import type { Bet } from "../../types";

type Props = { bets: Bet[] };

export function BankrollHeader({ bets }: Props) {
  const { balance } = useBankrollStore();
  const tokenBalance = useTokenBalance();
  const router = useRouter();

  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const totalWon = won.reduce((s, b) => s + b.potential_payout, 0);
  const totalLost = lost.reduce((s, b) => s + b.stake, 0);
  const netProfit = totalWon - totalLost;
  const settled = won.length + lost.length;
  const winRate = settled > 0 ? Math.round((won.length / settled) * 100) : 0;

  return (
    <Pressable
      className="mx-4 my-3 bg-gray-900 rounded-xl p-4 border border-gray-800"
      onPress={() => router.push("/bankroll")}
    >
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-gray-400 text-xs mb-1">Bankroll</Text>
          <Text className="text-white text-2xl font-bold">${balance.toFixed(2)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-400 text-xs mb-1">All-time P&L</Text>
          <Text className={`text-lg font-bold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Token balance strip */}
      <View
        style={{ backgroundColor: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)", borderWidth: 1 }}
        className="rounded-lg px-3 py-2 flex-row items-center justify-between mb-3"
      >
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 13 }}>🎯</Text>
          <Text className="text-indigo-300 text-xs font-semibold">Practice Tokens</Text>
        </View>
        <Text className="text-indigo-400 font-bold text-sm">
          {tokenBalance.toLocaleString()} tokens
        </Text>
      </View>

      <View className="flex-row gap-4">
        <Text className="text-gray-500 text-xs">
          Win Rate:{" "}
          <Text className="text-white font-semibold">{winRate}%</Text>
        </Text>
        <Text className="text-gray-500 text-xs">
          Record:{" "}
          <Text className="text-green-400 font-semibold">{won.length}W</Text>
          {" – "}
          <Text className="text-red-400 font-semibold">{lost.length}L</Text>
        </Text>
        <Text className="text-gray-500 text-xs text-right flex-1">
          View details →
        </Text>
      </View>
    </Pressable>
  );
}

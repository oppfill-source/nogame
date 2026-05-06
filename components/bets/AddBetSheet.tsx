import { Modal, View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { useState } from "react";
import { calcPayout, kellyFraction } from "../../lib/odds-utils";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import { useBankrollStore } from "../../stores/bankroll";
import { useTokenBalance } from "../../hooks/useTokens";
import type { Bet } from "../../types";

type BetDraft = Omit<Bet, "id" | "placed_at" | "user_id" | "status" | "potential_payout">;

type Props = {
  visible: boolean;
  draft?: Partial<BetDraft>;
  onClose: () => void;
  onConfirm: (bet: Omit<Bet, "id" | "placed_at" | "user_id">) => void;
};

export function AddBetSheet({ visible, draft, onClose, onConfirm }: Props) {
  const { balance, kellyFraction: kellyFrac } = useBankrollStore();
  const tokenBalance = useTokenBalance();
  const formatOdds = useFormatOdds();
  const [stake, setStake] = useState(draft?.stake?.toString() ?? "10");

  const stakeNum = parseFloat(stake) || 0;
  const odds = draft?.odds ?? -110;
  const payout = calcPayout(stakeNum, odds);
  const kellySuggestion = draft?.odds
    ? kellyFraction(0.52, draft.odds, kellyFrac) * balance
    : 0;

  const tokenWagered = Math.round(stakeNum);
  const tokenPayout = Math.round(payout);
  const tokenProfit = tokenPayout - tokenWagered;
  const canAfford = tokenWagered <= tokenBalance;

  function handleConfirm() {
    if (!draft?.game_id || stakeNum <= 0) return;
    onConfirm({
      game_id: draft.game_id!,
      game_description: draft.game_description ?? "Game",
      sport: draft.sport ?? "Unknown",
      bet_type: draft.bet_type ?? "moneyline",
      selection: draft.selection ?? "",
      bookmaker_key: draft.bookmaker_key,
      odds,
      stake: stakeNum,
      potential_payout: payout,
      status: "pending",
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-gray-950">
        <View className="flex-row justify-between items-center px-4 py-4 border-b border-gray-800">
          <Text className="text-white text-lg font-bold">Track Bet</Text>
          <Pressable onPress={onClose}>
            <Text className="text-gray-400 text-sm">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Practice tokens banner */}
          <View
            style={{ backgroundColor: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.25)", borderWidth: 1 }}
            className="rounded-xl px-4 py-3 mb-4 flex-row items-center gap-3"
          >
            <Text style={{ fontSize: 16 }}>🎯</Text>
            <View className="flex-1">
              <Text className="text-indigo-300 font-semibold text-sm">Practice Tokens</Text>
              <Text className="text-indigo-400 text-xs mt-0.5">
                These are virtual tokens for tracking behavior — no real money involved.
              </Text>
            </View>
          </View>

          {/* Token balance */}
          <View className="flex-row items-center justify-between mb-4 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
            <Text className="text-gray-400 text-sm">Token Balance</Text>
            <Text className={`font-bold text-base ${canAfford ? "text-indigo-400" : "text-red-400"}`}>
              {tokenBalance.toLocaleString()} tokens
            </Text>
          </View>

          {draft && (
            <View className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <Text className="text-gray-400 text-xs mb-1">{draft.game_description}</Text>
              <Text className="text-white font-bold text-lg">{draft.selection}</Text>
              <Text className="text-gray-400 text-sm mt-0.5">
                {formatOdds(odds)} • {draft.bet_type} • {draft.bookmaker_key}
              </Text>
            </View>
          )}

          <Text className="text-gray-400 text-sm mb-2">Stake Amount</Text>
          <View className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex-row items-center mb-2">
            <Text className="text-gray-400 mr-2 text-lg">$</Text>
            <TextInput
              className="text-white text-xl flex-1"
              value={stake}
              onChangeText={setStake}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#4b5563"
            />
          </View>

          {kellySuggestion > 0 && (
            <Pressable
              className="bg-gray-800 rounded-lg p-3 mb-4"
              onPress={() => setStake(kellySuggestion.toFixed(2))}
            >
              <Text className="text-gray-400 text-xs">
                Kelly Criterion suggests:{" "}
                <Text className="text-green-400 font-semibold">${kellySuggestion.toFixed(2)}</Text>
                {" "}(¼ Kelly)
              </Text>
            </Pressable>
          )}

          {/* Summary */}
          <View className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-3">
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-400">Stake</Text>
              <Text className="text-white">${stakeNum.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-400">Odds</Text>
              <Text className="text-white">{formatOdds(odds)}</Text>
            </View>
            <View className="h-px bg-gray-800 my-2" />
            <View className="flex-row justify-between">
              <Text className="text-white font-semibold">Potential Payout</Text>
              <Text className="text-green-400 font-bold">${payout.toFixed(2)}</Text>
            </View>
          </View>

          {/* Token summary */}
          {stakeNum > 0 && (
            <View
              style={{ backgroundColor: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)", borderWidth: 1 }}
              className="rounded-xl p-4 mb-6"
            >
              <Text className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-2">
                Token Wager
              </Text>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-gray-400 text-sm">Tokens risked</Text>
                <Text className="text-white text-sm font-semibold">
                  {tokenWagered.toLocaleString()} tokens
                </Text>
              </View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-gray-400 text-sm">If won</Text>
                <Text className="text-indigo-400 text-sm font-semibold">
                  +{tokenProfit.toLocaleString()} tokens
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-sm">Balance after</Text>
                <Text className={`text-sm font-semibold ${canAfford ? "text-gray-300" : "text-red-400"}`}>
                  {Math.max(0, tokenBalance - tokenWagered).toLocaleString()} tokens
                </Text>
              </View>
              {!canAfford && (
                <Text className="text-red-400 text-xs mt-2">
                  Insufficient tokens — reduce stake or wait to earn more.
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        <View className="p-4 border-t border-gray-800">
          <Pressable
            className={`rounded-xl py-4 items-center ${stakeNum > 0 && canAfford ? "bg-green-500" : "bg-gray-800"}`}
            onPress={handleConfirm}
            disabled={stakeNum <= 0 || !canAfford}
          >
            <Text className={`font-bold text-base ${stakeNum > 0 && canAfford ? "text-white" : "text-gray-600"}`}>
              {stakeNum > 0 && canAfford ? "Confirm Bet" : stakeNum <= 0 ? "Enter Stake" : "Not Enough Tokens"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

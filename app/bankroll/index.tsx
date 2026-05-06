import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBankrollStore } from "../../stores/bankroll";
import { kellyFraction } from "../../lib/odds-utils";

type Tab = "overview" | "kelly";

function BalanceRow({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-gray-800">
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className={`${color} font-semibold`}>{value}</Text>
    </View>
  );
}

export default function BankrollScreen() {
  const router = useRouter();
  const { balance, kellyFraction: kf, setBalance, setKellyFraction, adjustBalance } = useBankrollStore();
  const [tab, setTab] = useState<Tab>("overview");

  // Deposit / withdraw
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  // Kelly calculator inputs
  const [winProb, setWinProb] = useState("55");
  const [odds, setOdds] = useState("-110");
  const [kellyResult, setKellyResult] = useState<{ full: number; quarter: number; stake: number } | null>(null);

  function handleAdjust() {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return Alert.alert("Invalid amount", "Enter a positive number.");
    if (mode === "withdraw" && n > balance) return Alert.alert("Insufficient funds", "Amount exceeds balance.");
    adjustBalance(mode === "deposit" ? n : -n);
    setAmount("");
  }

  function handleKellyCalc() {
    const wp = parseFloat(winProb) / 100;
    const o = parseFloat(odds);
    if (isNaN(wp) || isNaN(o) || wp <= 0 || wp >= 1) {
      return Alert.alert("Invalid input", "Win probability must be between 1 and 99.");
    }
    const full = kellyFraction(wp, o, 1);
    const quarter = kellyFraction(wp, o, 0.25);
    setKellyResult({ full, quarter, stake: quarter * balance });
  }

  return (
    <ScrollView className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-6 pb-4">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#9ca3af" />
        </Pressable>
        <Text className="text-white text-xl font-bold">Bankroll</Text>
      </View>

      {/* Balance card */}
      <View className="mx-4 bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-4">
        <Text className="text-gray-400 text-sm mb-1">Current Balance</Text>
        <Text className="text-white text-4xl font-bold">${balance.toFixed(2)}</Text>
        <View className="flex-row items-center gap-2 mt-3">
          <View className="bg-green-500/20 px-3 py-1 rounded-full">
            <Text className="text-green-400 text-xs font-semibold">
              Kelly: {(kf * 100).toFixed(0)}% fraction
            </Text>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View className="flex-row mx-4 bg-gray-900 rounded-xl p-1 mb-4 border border-gray-800">
        {(["overview", "kelly"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-green-500" : ""}`}
          >
            <Text className={`text-sm font-semibold ${tab === t ? "text-white" : "text-gray-500"}`}>
              {t === "overview" ? "Overview" : "Kelly Calc"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "overview" && (
        <View className="mx-4">
          {/* Deposit / withdraw */}
          <View className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <Text className="text-white font-semibold mb-3">Adjust Balance</Text>

            <View className="flex-row bg-gray-800 rounded-xl p-1 mb-3">
              {(["deposit", "withdraw"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg items-center ${mode === m ? (m === "deposit" ? "bg-green-500" : "bg-red-500") : ""}`}
                >
                  <Text className={`text-sm font-semibold ${mode === m ? "text-white" : "text-gray-500"}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              className="bg-gray-800 rounded-xl px-4 py-3 text-white mb-3"
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount (e.g. 500)"
              placeholderTextColor="#4b5563"
              keyboardType="decimal-pad"
            />

            <Pressable
              className={`rounded-xl py-3 items-center ${mode === "deposit" ? "bg-green-500" : "bg-red-500"}`}
              onPress={handleAdjust}
            >
              <Text className="text-white font-bold">
                {mode === "deposit" ? "Add Funds" : "Withdraw Funds"}
              </Text>
            </Pressable>
          </View>

          {/* Kelly fraction setting */}
          <View className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <Text className="text-white font-semibold mb-1">Kelly Fraction</Text>
            <Text className="text-gray-500 text-xs mb-3">
              Lower fractions reduce variance. Quarter-Kelly (25%) is recommended for most bettors.
            </Text>
            {[
              { label: "Full Kelly (100%)", value: 1 },
              { label: "Half Kelly (50%)", value: 0.5 },
              { label: "Quarter Kelly (25%)", value: 0.25 },
              { label: "Eighth Kelly (12.5%)", value: 0.125 },
            ].map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setKellyFraction(opt.value)}
                className={`flex-row items-center px-3 py-3 rounded-xl mb-2 border ${
                  kf === opt.value ? "border-green-500 bg-green-500/10" : "border-gray-700 bg-gray-800"
                }`}
              >
                <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${
                  kf === opt.value ? "border-green-400" : "border-gray-600"
                }`}>
                  {kf === opt.value && <View className="w-2 h-2 rounded-full bg-green-400" />}
                </View>
                <Text className={kf === opt.value ? "text-green-400 font-semibold" : "text-gray-300"}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {tab === "kelly" && (
        <View className="mx-4">
          <View className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
            <Text className="text-white font-semibold mb-1">Kelly Criterion Calculator</Text>
            <Text className="text-gray-500 text-xs mb-4">
              Enter your estimated win probability and the American odds to calculate the optimal stake size.
            </Text>

            <Text className="text-gray-400 text-sm mb-2">Win Probability (%)</Text>
            <TextInput
              className="bg-gray-800 rounded-xl px-4 py-3 text-white mb-3"
              value={winProb}
              onChangeText={setWinProb}
              placeholder="e.g. 55"
              placeholderTextColor="#4b5563"
              keyboardType="decimal-pad"
            />

            <Text className="text-gray-400 text-sm mb-2">American Odds</Text>
            <TextInput
              className="bg-gray-800 rounded-xl px-4 py-3 text-white mb-4"
              value={odds}
              onChangeText={setOdds}
              placeholder="e.g. -110 or +150"
              placeholderTextColor="#4b5563"
              keyboardType="numbers-and-punctuation"
            />

            <Pressable className="bg-green-500 rounded-xl py-3 items-center" onPress={handleKellyCalc}>
              <Text className="text-white font-bold">Calculate</Text>
            </Pressable>
          </View>

          {kellyResult && (
            <View className="bg-gray-900 rounded-xl border border-green-500/30 p-4 mb-4">
              <Text className="text-green-400 font-semibold mb-3">Results</Text>
              <BalanceRow label="Full Kelly stake" value={`${(kellyResult.full * 100).toFixed(1)}% of bankroll`} />
              <BalanceRow
                label="Quarter Kelly stake"
                value={`${(kellyResult.quarter * 100).toFixed(1)}% — $${kellyResult.stake.toFixed(2)}`}
                color="text-green-400"
              />
              <Text className="text-gray-600 text-xs mt-3">
                Based on current balance of ${balance.toFixed(2)}. Using your {(kf * 100).toFixed(0)}% Kelly setting.
              </Text>
            </View>
          )}

          {/* Kelly explanation */}
          <View className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-8">
            <Text className="text-white font-semibold mb-2">How Kelly Works</Text>
            <Text className="text-gray-400 text-sm leading-5">
              The Kelly Criterion calculates the optimal fraction of your bankroll to bet in order to maximize long-term growth.{"\n\n"}
              It requires an honest estimate of your win probability — overestimating leads to overbetting and ruin.{"\n\n"}
              Quarter-Kelly (25%) is recommended because it provides 75% of the growth rate of full Kelly while dramatically reducing variance and the risk of losing your bankroll.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

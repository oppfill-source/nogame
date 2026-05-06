import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native";
import { useState, useMemo } from "react";
import { BetCard } from "../../components/bets/BetCard";
import { BankrollHeader } from "../../components/bets/BankrollHeader";
import { AddBetSheet } from "../../components/bets/AddBetSheet";
import { LoadingState } from "../../components/ui/LoadingState";
import { StatCard } from "../../components/ui/StatCard";
import { useBets, useAddBet, useUpdateBetStatus } from "../../hooks/useBets";
import { useTokenBalance } from "../../hooks/useTokens";
import { useAuthStore } from "../../stores/auth";
import { useRouter } from "expo-router";
import type { Bet, BetType } from "../../types";

type Tab = "open" | "settled" | "stats";
type DateFilter = "all" | "week" | "month";

// ─── Bankroll trend chart (View-based, no extra deps) ─────────────────────────

function BankrollChart({ bets }: { bets: Bet[] }) {
  const settled = useMemo(
    () =>
      [...bets.filter((b) => b.status !== "pending")]
        .sort(
          (a, b) =>
            new Date(a.settled_at ?? a.placed_at).getTime() -
            new Date(b.settled_at ?? b.placed_at).getTime()
        ),
    [bets]
  );

  if (settled.length < 3) return null;

  let running = 0;
  const points = settled.map((b) => {
    if (b.status === "won") running += b.potential_payout - b.stake;
    else if (b.status === "lost") running -= b.stake;
    return running;
  });

  const maxAbs = Math.max(...points.map(Math.abs), 1);
  const chartH = 56;
  const final = points[points.length - 1];

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: "#111113",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#27272A",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "600", letterSpacing: 0.8 }}>
          BANKROLL TREND
        </Text>
        <Text
          style={{ color: final >= 0 ? "#4ADE80" : "#F87171", fontSize: 12, fontWeight: "700" }}
        >
          {final >= 0 ? "+" : ""}${final.toFixed(2)} P&L
        </Text>
      </View>
      <View style={{ height: chartH, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        {points.map((val, i) => {
          const h = Math.max(4, (Math.abs(val) / maxAbs) * chartH);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                backgroundColor:
                  val >= 0 ? "rgba(74,222,128,0.55)" : "rgba(248,113,113,0.55)",
                borderRadius: 3,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: "#374151", fontSize: 10 }}>Bet 1</Text>
        <Text style={{ color: "#374151", fontSize: 10 }}>Bet {settled.length}</Text>
      </View>
    </View>
  );
}

// ─── Token P&L chart ──────────────────────────────────────────────────────────

function TokenChart({ bets }: { bets: Bet[] }) {
  const startingBalance = 1000;
  const settled = useMemo(
    () =>
      [...bets.filter((b) => b.status !== "pending")]
        .sort(
          (a, b) =>
            new Date(a.settled_at ?? a.placed_at).getTime() -
            new Date(b.settled_at ?? b.placed_at).getTime()
        ),
    [bets]
  );

  if (settled.length < 3) return null;

  // Simulate token balance over time (starting from 1000)
  let running = startingBalance;
  const points = settled.map((b) => {
    if (b.status === "won") running += Math.round(b.potential_payout - b.stake);
    else if (b.status === "lost") running = Math.max(0, running - Math.round(b.stake));
    return running;
  });

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const chartH = 56;
  const final = points[points.length - 1];
  const delta = final - startingBalance;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: "#0D0D14",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "rgba(99,102,241,0.25)",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: "#818CF8", fontSize: 11, fontWeight: "600", letterSpacing: 0.8 }}>
          🎯 TOKEN BALANCE
        </Text>
        <Text
          style={{ color: delta >= 0 ? "#818CF8" : "#F87171", fontSize: 12, fontWeight: "700" }}
        >
          {delta >= 0 ? "+" : ""}{delta.toLocaleString()} tokens
        </Text>
      </View>
      <View style={{ height: chartH, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        {points.map((val, i) => {
          const h = Math.max(4, ((val - min) / range) * chartH);
          const isPositive = val >= startingBalance;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                backgroundColor: isPositive ? "rgba(129,140,248,0.5)" : "rgba(248,113,113,0.5)",
                borderRadius: 3,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: "#374151", fontSize: 10 }}>Bet 1</Text>
        <Text style={{ color: "#818CF8", fontSize: 10 }}>{final.toLocaleString()} tokens now</Text>
      </View>
    </View>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        marginRight: 6,
        backgroundColor: active ? "#22c55e" : "#1F1F23",
        borderWidth: 1,
        borderColor: active ? "#22c55e" : "#374151",
      }}
    >
      <Text style={{ color: active ? "#fff" : "#9CA3AF", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MyBetsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<BetType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const { data: bets = [], isLoading } = useBets();
  const { mutate: addBet } = useAddBet();
  const { mutate: updateStatus } = useUpdateBetStatus();
  const tokenBalance = useTokenBalance();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const allSports = useMemo(
    () => Array.from(new Set(bets.map((b) => b.sport))).sort(),
    [bets]
  );

  const filteredBets = useMemo(() => {
    const cutoff =
      dateFilter === "week"
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : dateFilter === "month"
        ? Date.now() - 30 * 24 * 60 * 60 * 1000
        : 0;

    return bets.filter((b) => {
      if (sportFilter !== "all" && b.sport !== sportFilter) return false;
      if (typeFilter !== "all" && b.bet_type !== typeFilter) return false;
      if (cutoff && new Date(b.placed_at).getTime() < cutoff) return false;
      return true;
    });
  }, [bets, sportFilter, typeFilter, dateFilter]);

  const open = filteredBets.filter((b) => b.status === "pending");
  const settled = filteredBets.filter((b) => b.status !== "pending");
  const won = filteredBets.filter((b) => b.status === "won");
  const lost = filteredBets.filter((b) => b.status === "lost");

  const winRate =
    won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0;
  const totalStaked = filteredBets.reduce((s, b) => s + b.stake, 0);
  const totalReturned = won.reduce((s, b) => s + b.potential_payout, 0);
  const netProfit = totalReturned - lost.reduce((s, b) => s + b.stake, 0);

  // Current streak
  const streak = useMemo(() => {
    const done = [...filteredBets.filter((b) => b.status === "won" || b.status === "lost")].sort(
      (a, b) =>
        new Date(b.settled_at ?? b.placed_at).getTime() -
        new Date(a.settled_at ?? a.placed_at).getTime()
    );
    if (!done.length) return null;
    const type = done[0].status === "won" ? "W" : "L";
    let count = 0;
    for (const b of done) {
      if (b.status === (type === "W" ? "won" : "lost")) count++;
      else break;
    }
    return { type, count };
  }, [filteredBets]);

  // ROI by sport
  const sportStats = useMemo(() => {
    const map: Record<string, { won: number; lost: number; profit: number; staked: number }> = {};
    for (const b of filteredBets.filter((b) => b.status !== "pending")) {
      if (!map[b.sport]) map[b.sport] = { won: 0, lost: 0, profit: 0, staked: 0 };
      if (b.status === "won") {
        map[b.sport].won++;
        map[b.sport].profit += b.potential_payout - b.stake;
        map[b.sport].staked += b.stake;
      } else if (b.status === "lost") {
        map[b.sport].lost++;
        map[b.sport].profit -= b.stake;
        map[b.sport].staked += b.stake;
      }
    }
    return Object.entries(map)
      .map(([sport, s]) => ({ sport, ...s, roi: s.staked > 0 ? (s.profit / s.staked) * 100 : 0 }))
      .sort((a, b) => b.roi - a.roi);
  }, [filteredBets]);

  if (!user) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center px-8">
        <Text className="text-white text-xl font-bold mb-2">Sign In to Track Bets</Text>
        <Text className="text-gray-400 text-sm text-center mb-6">
          Your bets are saved to the cloud so you never lose your history.
        </Text>
        <Pressable
          className="bg-green-500 px-8 py-3 rounded-full"
          onPress={() => router.push("/(modals)/auth" as any)}
        >
          <Text className="text-white font-bold">Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) return <LoadingState message="Loading your bets..." />;

  const displayBets = activeTab === "open" ? open : settled;

  return (
    <View className="flex-1 bg-gray-950">
      <BankrollHeader bets={bets} />

      {/* ── Filters ── */}
      <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#27272A" }}>
        {allSports.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}
          >
            <Pill label="All Sports" active={sportFilter === "all"} onPress={() => setSportFilter("all")} />
            {allSports.map((s) => (
              <Pill
                key={s}
                label={s.split("_").slice(-1)[0].toUpperCase()}
                active={sportFilter === s}
                onPress={() => setSportFilter(s)}
              />
            ))}
          </ScrollView>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, flexDirection: "row" }}
        >
          {(["all", "moneyline", "spread", "total"] as const).map((t) => (
            <Pill
              key={t}
              label={t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
              active={typeFilter === t}
              onPress={() => setTypeFilter(t)}
            />
          ))}
          <View style={{ width: 12 }} />
          {(["all", "week", "month"] as const).map((d) => (
            <Pill
              key={d}
              label={d === "all" ? "All Time" : d === "week" ? "This Week" : "This Month"}
              active={dateFilter === d}
              onPress={() => setDateFilter(d)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Tab strip ── */}
      <View className="flex-row mx-4 my-2 bg-gray-900 rounded-xl p-1">
        {(["open", "settled", "stats"] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? "bg-green-500" : ""}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              className={`text-sm font-semibold ${activeTab === tab ? "text-white" : "text-gray-400"}`}
            >
              {tab === "open"
                ? `Open (${open.length})`
                : tab === "settled"
                ? `Settled (${settled.length})`
                : "Stats"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Content ── */}
      {activeTab === "stats" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <BankrollChart bets={filteredBets} />
          <TokenChart bets={filteredBets} />

          {/* Token balance card */}
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              backgroundColor: "rgba(99,102,241,0.08)",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(99,102,241,0.2)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ color: "#818CF8", fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 }}>
                🎯 PRACTICE TOKENS
              </Text>
              <Text style={{ color: "#C7D2FE", fontSize: 22, fontWeight: "800" }}>
                {tokenBalance.toLocaleString()}
              </Text>
              <Text style={{ color: "#6366F1", fontSize: 11, marginTop: 2 }}>
                These are virtual — no real money involved
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#4B5563", fontSize: 11 }}>Started with</Text>
              <Text style={{ color: "#6B7280", fontSize: 15, fontWeight: "700" }}>1,000</Text>
              <Text style={{ color: tokenBalance >= 1000 ? "#818CF8" : "#F87171", fontSize: 13, fontWeight: "700", marginTop: 4 }}>
                {tokenBalance >= 1000 ? "+" : ""}{(tokenBalance - 1000).toLocaleString()} net
              </Text>
            </View>
          </View>

          <View className="px-4 gap-3">
            <View className="flex-row gap-3">
              <StatCard
                label="Win Rate"
                value={`${winRate}%`}
                sub={`${won.length}W – ${lost.length}L`}
                positive={winRate >= 50}
              />
              <StatCard
                label="Net Profit"
                value={`${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(2)}`}
                positive={netProfit >= 0}
              />
            </View>
            <View className="flex-row gap-3">
              <StatCard label="Total Bets" value={String(filteredBets.length)} sub={`${settled.length} settled`} />
              <StatCard label="Total Staked" value={`$${totalStaked.toFixed(2)}`} />
            </View>
            <View className="flex-row gap-3">
              <StatCard
                label="ROI"
                value={totalStaked > 0 ? `${((netProfit / totalStaked) * 100).toFixed(1)}%` : "—"}
                positive={netProfit > 0}
              />
              <StatCard
                label="Streak"
                value={streak ? `${streak.count}${streak.type}` : "—"}
                positive={streak?.type === "W"}
              />
            </View>
          </View>

          {/* ROI by sport breakdown */}
          {sportStats.length > 0 && (
            <View className="mx-4 mt-4">
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">
                ROI by Sport
              </Text>
              <View
                style={{
                  backgroundColor: "#111113",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#27272A",
                  overflow: "hidden",
                }}
              >
                {sportStats.map((s, idx) => (
                  <View
                    key={s.sport}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={idx < sportStats.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "#1F1F23" } : undefined}
                  >
                    <View>
                      <Text className="text-white text-sm font-medium capitalize">
                        {s.sport.split("_").slice(-1)[0]}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {s.won}W – {s.lost}L · ${s.staked.toFixed(0)} staked
                      </Text>
                    </View>
                    <Text
                      className={`font-bold text-sm ${s.roi >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {s.roi >= 0 ? "+" : ""}
                      {s.roi.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={displayBets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BetCard
              bet={item}
              onMarkWon={item.status === "pending" ? () => updateStatus({ id: item.id, status: "won" }) : undefined}
              onMarkLost={item.status === "pending" ? () => updateStatus({ id: item.id, status: "lost" }) : undefined}
            />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <View className="items-center mt-16 px-8">
              <Text className="text-gray-500 text-lg">
                {activeTab === "open" ? "No open bets" : "No settled bets"}
              </Text>
              <Text className="text-gray-600 text-sm mt-1 text-center">
                {activeTab === "open"
                  ? "Browse games or AI picks to add a bet"
                  : "Mark open bets as won or lost"}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Pressable
        className="absolute bottom-6 right-6 bg-green-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        onPress={() => setShowAddSheet(true)}
      >
        <Text className="text-white text-3xl font-light">+</Text>
      </Pressable>

      <AddBetSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onConfirm={(bet) => addBet(bet)}
      />
    </View>
  );
}

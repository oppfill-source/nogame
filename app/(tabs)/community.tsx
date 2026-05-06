import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { PickCard } from "../../components/community/PickCard";
import { LeaderboardRow } from "../../components/community/LeaderboardRow";
import { UserCard } from "../../components/community/UserCard";
import { PostPickSheet } from "../../components/community/PostPickSheet";
import { LoadingState } from "../../components/ui/LoadingState";
import {
  useCommunityFeed, useLikePick, useCopyPick, useLikedPickIds, useCopiedPickIds,
  type FeedSort,
} from "../../hooks/useCommunityFeed";
import { useLeaderboard, type LeaderboardPeriod } from "../../hooks/useLeaderboard";
import { useFollow, useIsFollowing } from "../../hooks/useFollow";
import { useUnreadCount } from "../../hooks/useInAppNotifications";
import { useAuthStore } from "../../stores/auth";
import { SPORTS } from "../../constants/sports";
import type { LeaderboardEntry } from "../../types";

type MainTab = "feed" | "leaderboard" | "people";

// ── Pill helper ────────────────────────────────────────────────────────────────
function Chip({ label, active, onPress, accent }: { label: string; active: boolean; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, marginRight: 6,
        backgroundColor: active ? (accent ? "#6366F1" : "#22C55E") : "#1C1C20",
        borderWidth: 1, borderColor: active ? (accent ? "#6366F1" : "#22C55E") : "#27272A",
      }}
    >
      <Text style={{ color: active ? "#fff" : "#9CA3AF", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

// ── Follow-aware UserCard wrapper ─────────────────────────────────────────────
function UserCardWithFollow({ entry }: { entry: LeaderboardEntry }) {
  const { data: isFollowing } = useIsFollowing(entry.user_id);
  const { mutate: follow, isPending } = useFollow();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  function handleFollow() {
    if (!user) { router.push("/(modals)/auth" as any); return; }
    follow({ targetId: entry.user_id, following: !!isFollowing });
  }

  return <UserCard entry={entry} isFollowing={isFollowing} onFollow={isPending ? undefined : handleFollow} />;
}

// ── Feed sub-screen ────────────────────────────────────────────────────────────
function FeedTab() {
  const [sort, setSort] = useState<FeedSort>("latest");
  const [sport, setSport] = useState<string | undefined>(undefined);
  const [showPostSheet, setShowPostSheet] = useState(false);

  const { data: picks = [], isLoading, refetch, isRefetching } = useCommunityFeed(sort, sport);
  const { mutate: likePick } = useLikePick();
  const { mutate: copyPick } = useCopyPick();
  const { data: likedIds = new Set() } = useLikedPickIds();
  const { data: copiedIds = new Set() } = useCopiedPickIds();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const SORT_OPTIONS: { key: FeedSort; label: string }[] = [
    { key: "latest", label: "Latest" },
    { key: "popular", label: "Most Liked" },
    { key: "top_rated", label: "Most Copied" },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Sort bar */}
      <View style={{ paddingTop: 8, paddingBottom: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {SORT_OPTIONS.map((o) => (
            <Chip key={o.key} label={o.label} active={sort === o.key} onPress={() => setSort(o.key)} />
          ))}
        </ScrollView>
      </View>

      {/* Sport filter */}
      <View style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1F1F23" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          <Chip label="All" active={!sport} onPress={() => setSport(undefined)} />
          {SPORTS.slice(0, 8).map((s) => (
            <Chip key={s.key} label={`${s.emoji} ${s.short}`} active={sport === s.short} onPress={() => setSport(s.short)} />
          ))}
        </ScrollView>
      </View>

      {isLoading && !picks.length ? (
        <LoadingState message="Loading picks..." />
      ) : (
        <FlatList
          data={picks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PickCard
              pick={item}
              isLiked={likedIds.has(item.id)}
              isCopied={copiedIds.has(item.id)}
              onLike={() => {
                if (!user) { router.push("/(modals)/auth" as any); return; }
                likePick({ pickId: item.id, liked: likedIds.has(item.id) });
              }}
              onCopy={() => {
                if (!user) { router.push("/(modals)/auth" as any); return; }
                copyPick(item.id);
              }}
              onComment={() => router.push(`/community/pick/${item.id}` as any)}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ color: "#6B7280", fontSize: 16 }}>No picks yet</Text>
              <Text style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>Be the first to share one</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />}
        />
      )}

      {/* FAB */}
      <Pressable
        style={{ position: "absolute", bottom: 20, right: 16, width: 52, height: 52, borderRadius: 26,
          backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", elevation: 4 }}
        onPress={() => {
          if (!user) { router.push("/(modals)/auth" as any); return; }
          setShowPostSheet(true);
        }}
      >
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "300", marginTop: -2 }}>+</Text>
      </Pressable>

      <PostPickSheet visible={showPostSheet} onClose={() => setShowPostSheet(false)} />
    </View>
  );
}

// ── Leaderboard sub-screen ────────────────────────────────────────────────────
function LeaderboardTab() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const { data: entries = [], isLoading } = useLeaderboard(period);

  const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
    { key: "all",   label: "All Time" },
    { key: "month", label: "This Month" },
    { key: "week",  label: "This Week" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1F1F23" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} accent />
          ))}
        </ScrollView>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1F1F23" }}>
        <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600", width: 28 }}>#</Text>
        <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600", flex: 1, marginLeft: 48 }}>BETTOR</Text>
        <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600" }}>WIN RATE</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading leaderboard..." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item, index }) => <LeaderboardRow entry={item} rank={index + 1} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ color: "#6B7280", fontSize: 15 }}>No data yet</Text>
              <Text style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>Share picks with results to appear here</Text>
            </View>
          }
        />
      )}

      {/* Badge legend */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#111115",
        borderTopWidth: 1, borderTopColor: "#1F1F23", paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {[["🎯 Sharp","60%+ win rate, 10+ picks"],["⭐ Rising","55%+ win rate, 20+ picks"],["🔥 Active","30+ picks"]].map(([badge, desc]) => (
            <View key={badge} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: "#6B7280", fontSize: 10 }}>{badge} <Text style={{ color: "#374151" }}>= {desc}</Text></Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── People sub-screen ─────────────────────────────────────────────────────────
function PeopleTab() {
  const { data: entries = [], isLoading } = useLeaderboard("all");

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1F1F23" }}>
        <Text style={{ color: "#6B7280", fontSize: 12 }}>Top bettors to follow · sorted by win rate</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading bettors..." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => <UserCardWithFollow entry={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ color: "#6B7280" }}>No bettors yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Main community screen ─────────────────────────────────────────────────────
export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<MainTab>("feed");
  const unreadCount = useUnreadCount();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const TABS: { key: MainTab; label: string }[] = [
    { key: "feed",        label: "Feed" },
    { key: "leaderboard", label: "Leaderboard" },
    { key: "people",      label: "People" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0D" }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: "#F9FAFB", fontSize: 22, fontWeight: "800" }}>Community</Text>
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 1 }}>Picks, analysis & sharp bettors</Text>
        </View>
        <Pressable
          style={{ position: "relative" }}
          onPress={() => user ? null : router.push("/(modals)/auth" as any)}
        >
          <Text style={{ fontSize: 22 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={{ position: "absolute", top: -2, right: -4, backgroundColor: "#EF4444",
              width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Tab strip */}
      <View style={{ flexDirection: "row", marginHorizontal: 12, marginVertical: 6, backgroundColor: "#111115", borderRadius: 12, padding: 3 }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
              backgroundColor: activeTab === tab.key ? "#22C55E" : "transparent" }}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={{ color: activeTab === tab.key ? "#fff" : "#6B7280", fontSize: 13, fontWeight: "700" }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === "feed"        && <FeedTab />}
      {activeTab === "leaderboard" && <LeaderboardTab />}
      {activeTab === "people"      && <PeopleTab />}
    </View>
  );
}

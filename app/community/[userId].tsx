import { View, Text, FlatList, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { PickCard } from "../../components/community/PickCard";
import { LoadingState } from "../../components/ui/LoadingState";
import { useIsFollowing, useFollow } from "../../hooks/useFollow";
import { useLikePick, useLikedPickIds } from "../../hooks/useCommunityFeed";
import { useAuthStore } from "../../stores/auth";
import type { CommunityPick, Profile } from "../../types";

function getBadges(winRate: number, totalPicks: number, followerCount: number) {
  const badges: { label: string; icon: string; color: string }[] = [];
  if (winRate >= 60 && totalPicks >= 10) badges.push({ label: "Sharp", icon: "🎯", color: "#818CF8" });
  if (winRate >= 55 && totalPicks >= 20) badges.push({ label: "Rising Star", icon: "⭐", color: "#F59E0B" });
  if (totalPicks >= 30)                  badges.push({ label: "Most Active", icon: "🔥", color: "#F97316" });
  if (followerCount >= 50)               badges.push({ label: "Influencer",  icon: "📣", color: "#EC4899" });
  return badges;
}

function StatPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#111115", borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: "#1F1F23", alignItems: "center" }}>
      <Text style={{ color: positive === true ? "#4ADE80" : positive === false ? "#F87171" : "#F9FAFB",
        fontWeight: "800", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const router = useRouter();
  const isSelf = currentUser?.id === userId;

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      return data as Profile | null;
    },
  });

  const { data: picks = [], isLoading: picksLoading } = useQuery<CommunityPick[]>({
    queryKey: ["user-picks", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("picks")
        .select("*, profiles(username, avatar_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as CommunityPick[];
    },
  });

  const { data: isFollowing } = useIsFollowing(userId ?? "");
  const { mutate: follow, isPending: followPending } = useFollow();
  const { mutate: likePick } = useLikePick();
  const { data: likedIds = new Set() } = useLikedPickIds();

  const username = profile?.username ?? "...";
  const initials = username.slice(0, 2).toUpperCase();
  const avatarColors = ["#6366F1","#EC4899","#F59E0B","#10B981","#3B82F6","#8B5CF6"];
  const avatarColor = avatarColors[username.charCodeAt(0) % avatarColors.length];

  const won = picks.filter((p) => p.result === "won").length;
  const lost = picks.filter((p) => p.result === "lost").length;
  const settled = won + lost;
  const winRate = settled > 0 ? (won / settled) * 100 : 0;
  const followerCount = profile?.follower_count ?? 0;
  const followingCount = profile?.following_count ?? 0;
  const badges = getBadges(winRate, picks.length, followerCount);
  const trustScore = settled >= 5 ? Math.round(winRate) : null;

  function handleFollow() {
    if (!currentUser) { router.push("/(modals)/auth" as any); return; }
    follow({ targetId: userId!, following: !!isFollowing });
  }

  if (profileLoading) return <LoadingState message="Loading profile..." />;

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0D" }}>
      <FlatList
        data={picks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PickCard
            pick={item}
            isLiked={likedIds.has(item.id)}
            onLike={() => {
              if (!currentUser) { router.push("/(modals)/auth" as any); return; }
              likePick({ pickId: item.id, liked: likedIds.has(item.id) });
            }}
            onComment={() => router.push(`/community/pick/${item.id}` as any)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            {/* Profile card */}
            <View style={{ alignItems: "center", paddingTop: 24, paddingHorizontal: 20, paddingBottom: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: avatarColor + "30",
                alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Text style={{ color: avatarColor, fontWeight: "800", fontSize: 28 }}>{initials}</Text>
              </View>
              <Text style={{ color: "#F9FAFB", fontSize: 22, fontWeight: "800" }}>{username}</Text>

              {/* Badges */}
              {badges.length > 0 && (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {badges.map((b) => (
                    <View key={b.label} style={{ flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: "#111115", paddingHorizontal: 10, paddingVertical: 4,
                      borderRadius: 20, borderWidth: 1, borderColor: b.color + "40" }}>
                      <Text style={{ fontSize: 12 }}>{b.icon}</Text>
                      <Text style={{ color: b.color, fontSize: 11, fontWeight: "700" }}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Trust score */}
              {trustScore !== null && (
                <View style={{ marginTop: 10, backgroundColor: "#111115", paddingHorizontal: 16, paddingVertical: 6,
                  borderRadius: 20, borderWidth: 1, borderColor: "#27272A" }}>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>
                    Trust score:{" "}
                    <Text style={{ color: trustScore >= 55 ? "#4ADE80" : "#F87171", fontWeight: "700" }}>
                      {trustScore}/100
                    </Text>
                  </Text>
                </View>
              )}

              {/* Follow / edit */}
              {!isSelf && (
                <Pressable
                  style={{ marginTop: 14, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 24,
                    backgroundColor: isFollowing ? "#1F2937" : "#6366F1",
                    borderWidth: 1, borderColor: isFollowing ? "#374151" : "#6366F1" }}
                  onPress={followPending ? undefined : handleFollow}
                >
                  <Text style={{ color: isFollowing ? "#9CA3AF" : "#fff", fontWeight: "700", fontSize: 14 }}>
                    {followPending ? "..." : isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Follower stats */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 32, marginBottom: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#F9FAFB", fontWeight: "800", fontSize: 18 }}>{followerCount}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Followers</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#1F1F23" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#F9FAFB", fontWeight: "800", fontSize: 18 }}>{followingCount}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Following</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#1F1F23" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#F9FAFB", fontWeight: "800", fontSize: 18 }}>{picks.length}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>Picks</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 16 }}>
              <StatPill
                label="Win Rate"
                value={settled > 0 ? `${winRate.toFixed(1)}%` : "—"}
                positive={winRate >= 50}
              />
              <StatPill label="Record" value={`${won}W–${lost}L`} />
              <StatPill label="Total Picks" value={String(picks.length)} />
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ color: "#F9FAFB", fontWeight: "700", fontSize: 15 }}>Recent Picks</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          picksLoading ? <LoadingState /> : (
            <View style={{ alignItems: "center", marginTop: 32 }}>
              <Text style={{ color: "#6B7280" }}>No picks shared yet</Text>
            </View>
          )
        }
      />
    </View>
  );
}

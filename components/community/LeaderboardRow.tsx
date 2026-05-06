import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { LeaderboardEntry } from "../../types";

type Props = { entry: LeaderboardEntry; rank: number };

function getBadges(entry: LeaderboardEntry): string[] {
  const badges: string[] = [];
  if (entry.win_rate >= 60 && entry.total_picks >= 10) badges.push("🎯 Sharp");
  if (entry.total_picks >= 20 && entry.win_rate >= 55)  badges.push("⭐ Rising");
  if (entry.total_picks >= 30)                          badges.push("🔥 Active");
  return badges;
}

function rankColor(rank: number) {
  if (rank === 1) return "#F59E0B";
  if (rank === 2) return "#94A3B8";
  if (rank === 3) return "#CD7C2F";
  return "#374151";
}

export function LeaderboardRow({ entry, rank }: Props) {
  const router = useRouter();
  const badges = getBadges(entry);
  const settled = entry.won_picks + entry.lost_picks;
  const initials = entry.username.slice(0, 2).toUpperCase();
  const avatarColors = ["#6366F1","#EC4899","#F59E0B","#10B981","#3B82F6","#8B5CF6"];
  const avatarColor = avatarColors[entry.username.charCodeAt(0) % avatarColors.length];

  return (
    <Pressable
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: "#1F1F23" }}
      onPress={() => router.push(`/community/${entry.user_id}` as any)}
    >
      {/* Rank */}
      <View style={{ width: 28, alignItems: "center" }}>
        <Text style={{ color: rankColor(rank), fontWeight: "800", fontSize: rank <= 3 ? 16 : 14 }}>
          {rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : String(rank)}
        </Text>
      </View>

      {/* Avatar */}
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: avatarColor + "25",
        alignItems: "center", justifyContent: "center", marginHorizontal: 10 }}>
        <Text style={{ color: avatarColor, fontWeight: "700", fontSize: 13 }}>{initials}</Text>
      </View>

      {/* Name + badges */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: "#F9FAFB", fontWeight: "700", fontSize: 14 }}>{entry.username}</Text>
          {badges.map((b) => (
            <View key={b} style={{ backgroundColor: "#1E293B", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}>
              <Text style={{ color: "#94A3B8", fontSize: 9, fontWeight: "700" }}>{b}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 1 }}>
          {settled}W+L · {entry.follower_count} followers
        </Text>
      </View>

      {/* Win rate */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: entry.win_rate >= 55 ? "#4ADE80" : entry.win_rate >= 45 ? "#F59E0B" : "#F87171",
          fontWeight: "800", fontSize: 16 }}>
          {entry.win_rate.toFixed(1)}%
        </Text>
        <Text style={{ color: "#374151", fontSize: 10 }}>win rate</Text>
      </View>
    </Pressable>
  );
}

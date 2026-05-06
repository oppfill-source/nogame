import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { LeaderboardEntry } from "../../types";

type Props = {
  entry: LeaderboardEntry;
  isFollowing?: boolean;
  onFollow?: () => void;
};

export function UserCard({ entry, isFollowing, onFollow }: Props) {
  const router = useRouter();
  const initials = entry.username.slice(0, 2).toUpperCase();
  const avatarColors = ["#6366F1","#EC4899","#F59E0B","#10B981","#3B82F6","#8B5CF6"];
  const avatarColor = avatarColors[entry.username.charCodeAt(0) % avatarColors.length];
  const settled = entry.won_picks + entry.lost_picks;

  return (
    <Pressable
      style={{ backgroundColor: "#16161A", borderRadius: 14, borderWidth: 1, borderColor: "#27272A",
        marginHorizontal: 12, marginBottom: 8, padding: 14, flexDirection: "row", alignItems: "center" }}
      onPress={() => router.push(`/community/${entry.user_id}` as any)}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: avatarColor + "25",
        alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ color: avatarColor, fontWeight: "800", fontSize: 16 }}>{initials}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: "#F9FAFB", fontWeight: "700", fontSize: 15 }}>{entry.username}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 3 }}>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            {entry.total_picks} picks ·{" "}
            <Text style={{ color: entry.win_rate >= 55 ? "#4ADE80" : "#F59E0B" }}>
              {entry.win_rate.toFixed(0)}% win
            </Text>
          </Text>
          <Text style={{ color: "#374151", fontSize: 12 }}>{entry.follower_count} followers</Text>
        </View>
      </View>

      <Pressable
        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
          backgroundColor: isFollowing ? "#1F2937" : "#6366F1",
          borderWidth: 1, borderColor: isFollowing ? "#374151" : "#6366F1" }}
        onPress={(e) => { e.stopPropagation(); onFollow?.(); }}
      >
        <Text style={{ color: isFollowing ? "#9CA3AF" : "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

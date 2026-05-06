import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Badge } from "../ui/Badge";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import { formatDistanceToNow } from "date-fns";
import type { CommunityPick } from "../../types";

type Props = {
  pick: CommunityPick;
  onLike?: () => void;
  onCopy?: () => void;
  onComment?: () => void;
  isLiked?: boolean;
  isCopied?: boolean;
};

function getBadges(pick: CommunityPick) {
  const badges: { label: string; color: string; bg: string }[] = [];
  if (pick.result === "won")  badges.push({ label: "WON",  color: "#4ADE80", bg: "rgba(74,222,128,0.15)" });
  if (pick.result === "lost") badges.push({ label: "LOST", color: "#F87171", bg: "rgba(248,113,113,0.15)" });
  if (pick.result === "push") badges.push({ label: "PUSH", color: "#94A3B8", bg: "rgba(148,163,184,0.15)" });
  return badges;
}

function Avatar({ username }: { username: string }) {
  const initials = username.slice(0, 2).toUpperCase();
  const colors = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];
  const color = colors[username.charCodeAt(0) % colors.length];
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{initials}</Text>
    </View>
  );
}

export function PickCard({ pick, onLike, onCopy, onComment, isLiked, isCopied }: Props) {
  const router = useRouter();
  const formatOdds = useFormatOdds();
  const username = pick.profiles?.username ?? "Anonymous";
  const timeAgo = formatDistanceToNow(new Date(pick.created_at), { addSuffix: true });
  const resultBadges = getBadges(pick);

  return (
    <Pressable
      style={{ backgroundColor: "#16161A", borderColor: "#27272A", borderWidth: 1, borderRadius: 14, marginHorizontal: 12, marginBottom: 10 }}
      onPress={() => router.push(`/community/pick/${pick.id}` as any)}
    >
      {/* Result accent bar */}
      {pick.result === "won"  && <View style={{ height: 2, backgroundColor: "#4ADE80", borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />}
      {pick.result === "lost" && <View style={{ height: 2, backgroundColor: "#F87171", borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />}

      <View style={{ padding: 14 }}>
        {/* Author row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            onPress={() => router.push(`/community/${pick.user_id}` as any)}
          >
            <Avatar username={username} />
            <View>
              <Text style={{ color: "#F9FAFB", fontWeight: "600", fontSize: 13 }}>{username}</Text>
              <Text style={{ color: "#6B7280", fontSize: 11 }}>{timeAgo}</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {resultBadges.map((b) => (
              <View key={b.label} style={{ backgroundColor: b.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: b.color, fontSize: 10, fontWeight: "700" }}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pick details */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
          <Badge label={pick.sport} variant="success" />
          <View style={{ backgroundColor: "#1E293B", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "600" }}>{pick.bet_type.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 2 }}>{pick.matchup}</Text>
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16, marginBottom: 2 }}>{pick.selection}</Text>
        <Text style={{ color: "#6B7280", fontSize: 13 }}>
          {formatOdds(pick.odds)}{pick.bookmaker_key ? ` · ${pick.bookmaker_key}` : ""}
        </Text>

        {pick.note ? (
          <Text style={{ color: "#D1D5DB", fontSize: 13, marginTop: 8, lineHeight: 19 }} numberOfLines={3}>
            {pick.note}
          </Text>
        ) : null}

        {/* Actions row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1F2937", gap: 16 }}>
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={onLike}>
            <Text style={{ fontSize: 15 }}>{isLiked ? "❤️" : "🤍"}</Text>
            <Text style={{ color: isLiked ? "#EC4899" : "#6B7280", fontSize: 13, fontWeight: "600" }}>{pick.like_count}</Text>
          </Pressable>
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={onComment}>
            <Text style={{ fontSize: 15 }}>💬</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "600" }}>{pick.comment_count}</Text>
          </Pressable>
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={onCopy}>
            <Text style={{ fontSize: 15 }}>{isCopied ? "📋" : "📄"}</Text>
            <Text style={{ color: isCopied ? "#818CF8" : "#6B7280", fontSize: 13, fontWeight: "600" }}>{pick.copy_count}</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ color: "#374151", fontSize: 11 }}>View →</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

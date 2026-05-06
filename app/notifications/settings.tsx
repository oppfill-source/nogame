import { View, Text, Switch, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

type PrefKey =
  | "notif_engie_picks"
  | "notif_community"
  | "notif_bet_settlement"
  | "notif_leaderboard"
  | "notif_follows"
  | "notif_daily_digest";

const PREFS: { key: PrefKey; label: string; description: string; icon: string }[] = [
  {
    key: "notif_engie_picks",
    label: "Engie Picks",
    description: "New AI-generated picks with high confidence",
    icon: "flash-outline",
  },
  {
    key: "notif_community",
    label: "Community Activity",
    description: "Likes, comments, and copies on your picks",
    icon: "people-outline",
  },
  {
    key: "notif_bet_settlement",
    label: "Bet Settlement",
    description: "When your bets are marked won, lost, or push",
    icon: "trophy-outline",
  },
  {
    key: "notif_leaderboard",
    label: "Leaderboard",
    description: "When your leaderboard rank changes",
    icon: "bar-chart-outline",
  },
  {
    key: "notif_follows",
    label: "New Followers",
    description: "When someone follows you or posts a new pick",
    icon: "person-add-outline",
  },
  {
    key: "notif_daily_digest",
    label: "Daily Digest",
    description: "Morning (8am) and evening (6pm) summary",
    icon: "newspaper-outline",
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const user = useAuthStore((s) => s.user);

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    notif_engie_picks:    (profile as any)?.notif_engie_picks    ?? true,
    notif_community:      (profile as any)?.notif_community      ?? true,
    notif_bet_settlement: (profile as any)?.notif_bet_settlement ?? true,
    notif_leaderboard:    (profile as any)?.notif_leaderboard    ?? true,
    notif_follows:        (profile as any)?.notif_follows        ?? true,
    notif_daily_digest:   (profile as any)?.notif_daily_digest   ?? true,
  });

  async function toggle(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    if (!user) return;
    const updated = await supabase
      .from("profiles")
      .update({ [key]: value })
      .eq("id", user.id)
      .select("*")
      .single();
    if (updated.data) setProfile(updated.data as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0D" }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#111115",
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={22} color="#9CA3AF" />
        </Pressable>
        <Text style={{ color: "#F9FAFB", fontSize: 17, fontWeight: "700" }}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 }}>
          NOTIFICATION TYPES
        </Text>

        <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1F1F23" }}>
          {PREFS.map((pref, i) => (
            <View
              key={pref.key}
              style={{
                flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
                backgroundColor: "#111115",
                borderBottomWidth: i < PREFS.length - 1 ? 1 : 0,
                borderBottomColor: "#1F1F23",
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.12)",
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}>
                <Ionicons name={pref.icon as any} size={18} color="#818CF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#F9FAFB", fontWeight: "600", fontSize: 14 }}>{pref.label}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 1 }}>{pref.description}</Text>
              </View>
              <Switch
                value={prefs[pref.key]}
                onValueChange={(v) => toggle(pref.key, v)}
                trackColor={{ false: "#27272A", true: "rgba(99,102,241,0.4)" }}
                thumbColor={prefs[pref.key] ? "#818CF8" : "#52525B"}
              />
            </View>
          ))}
        </View>

        <Text style={{ color: "#374151", fontSize: 12, textAlign: "center", marginTop: 8 }}>
          Push notifications require app permissions to be granted in your device settings.
        </Text>
      </ScrollView>
    </View>
  );
}

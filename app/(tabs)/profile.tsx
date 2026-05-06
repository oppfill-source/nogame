import {
  View, Text, Pressable, ScrollView, Modal, TextInput, Share, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useBankrollStore } from "../../stores/bankroll";
import { useTokenBalance } from "../../hooks/useTokens";
import { useUIStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { supabase } from "../../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import type { OddsFormat } from "../../lib/odds-utils";
import type { CommunityPick } from "../../types";

function SettingsRow({
  icon, label, onPress, right,
}: {
  icon: string; label: string; onPress?: () => void; right?: React.ReactNode;
}) {
  return (
    <Pressable className="flex-row items-center px-4 py-4 border-b border-gray-800" onPress={onPress}>
      <Ionicons name={icon as any} size={20} color="#6b7280" />
      <Text className="text-white ml-3 flex-1">{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color="#4b5563" />}
    </Pressable>
  );
}

function PickRow({ pick }: { pick: CommunityPick }) {
  const resultColor = pick.result === "won" ? "#4ADE80" : pick.result === "lost" ? "#F87171" : "#6B7280";
  const oddsStr = pick.odds > 0 ? `+${pick.odds}` : String(pick.odds);
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11,
      borderBottomWidth: 1, borderBottomColor: "#111115", gap: 10,
    }}>
      {pick.result && (
        <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: resultColor }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#D1D5DB", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
          {pick.selection}
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 1 }}>
          {pick.matchup} · {oddsStr} · {pick.sport}
        </Text>
      </View>
      {pick.result ? (
        <View style={{ backgroundColor: resultColor + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
          <Text style={{ color: resultColor, fontWeight: "700", fontSize: 11 }}>
            {pick.result.toUpperCase()}
          </Text>
        </View>
      ) : (
        <Text style={{ color: "#374151", fontSize: 11 }}>
          {formatDistanceToNow(new Date(pick.created_at), { addSuffix: true })}
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const { balance } = useBankrollStore();
  const tokenBalance = useTokenBalance();
  const router = useRouter();
  const { oddsFormat, setOddsFormat } = useUIStore();
  const session = useAuthStore((s) => s.session);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [editVisible, setEditVisible] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: myPicks = [] } = useQuery<CommunityPick[]>({
    queryKey: ["my-picks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("picks")
        .select("*, profiles(username, avatar_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as CommunityPick[];
    },
  });

  async function handleOddsFormatChange(format: OddsFormat) {
    setOddsFormat(format);
    if (session?.user) {
      await supabase.from("profiles").update({ odds_format: format }).eq("id", session.user.id);
    }
  }

  async function handleSaveUsername() {
    const trimmed = editUsername.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message.includes("unique") ? "That username is taken." : error.message);
      return;
    }
    if (data) setProfile(data as any);
    setEditVisible(false);
  }

  async function handleShare() {
    const username = profile?.username ?? user?.email?.split("@")[0] ?? "me";
    await Share.share({
      message: `Check out my picks on Engie! Follow @${username} for daily betting analysis.`,
      title: `@${username} on Engie`,
    });
  }

  if (!user) {
    return (
      <View className="flex-1 bg-gray-950">
        <View className="items-center py-10">
          <View className="w-20 h-20 rounded-full bg-gray-800 items-center justify-center mb-4">
            <Ionicons name="person" size={36} color="#6b7280" />
          </View>
          <Text className="text-white text-xl font-bold">Guest</Text>
          <Text className="text-gray-400 text-sm mt-1">Sign in to sync bets and join the community</Text>
          <Pressable
            className="mt-5 bg-green-500 px-8 py-3 rounded-full"
            onPress={() => router.push("/(modals)/auth" as any)}
          >
            <Text className="text-white font-bold text-base">Sign In / Register</Text>
          </Pressable>
        </View>
        <View className="mx-4 rounded-xl overflow-hidden border border-gray-800">
          <SettingsRow icon="shield-checkmark-outline" label="Responsible Gambling" />
          <SettingsRow icon="information-circle-outline" label="About BetEdge" />
          <SettingsRow icon="link-outline" label="Affiliate Disclosure" />
        </View>
      </View>
    );
  }

  const username = profile?.username ?? user.email?.split("@")[0] ?? "User";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <ScrollView className="flex-1 bg-gray-950">
      {/* Avatar + name */}
      <View className="items-center py-8">
        <View className="w-20 h-20 rounded-full bg-green-500 items-center justify-center mb-3">
          <Text className="text-white text-2xl font-bold">{initials}</Text>
        </View>
        <Text className="text-white text-xl font-bold">{username}</Text>
        <Text className="text-gray-400 text-sm mt-1">{user.email}</Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View className="bg-green-500/20 px-3 py-1 rounded-full">
            <Text className="text-green-400 text-sm font-semibold">
              Bankroll: ${balance.toFixed(2)}
            </Text>
          </View>
          <View style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: "#818CF8", fontSize: 13, fontWeight: "600" }}>
              🎯 {tokenBalance.toLocaleString()} tokens
            </Text>
          </View>
        </View>
        <Text style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>
          Practice tokens — tracking behavior, no real money
        </Text>

        {/* Edit profile + Share */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8,
              borderRadius: 20, backgroundColor: "#1A1A1F", borderWidth: 1, borderColor: "#27272A" }}
            onPress={() => { setEditUsername(username); setEditVisible(true); }}
          >
            <Ionicons name="pencil-outline" size={14} color="#9CA3AF" />
            <Text style={{ color: "#9CA3AF", fontSize: 13, fontWeight: "600" }}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8,
              borderRadius: 20, backgroundColor: "#1A1A1F", borderWidth: 1, borderColor: "#27272A" }}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={14} color="#9CA3AF" />
            <Text style={{ color: "#9CA3AF", fontSize: 13, fontWeight: "600" }}>Share</Text>
          </Pressable>
        </View>
      </View>

      {/* Recent picks */}
      {myPicks.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: "#F9FAFB", fontWeight: "700", fontSize: 14 }}>My Recent Picks</Text>
            <Pressable onPress={() => router.push(`/community/${user.id}` as any)}>
              <Text style={{ color: "#818CF8", fontSize: 12 }}>View all</Text>
            </Pressable>
          </View>
          <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1F1F23" }}>
            {myPicks.map((p) => <PickRow key={p.id} pick={p} />)}
          </View>
        </View>
      )}

      {/* Settings */}
      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-4">
        <SettingsRow icon="wallet-outline" label="Bankroll Settings" onPress={() => router.push("/bankroll" as any)} />
        <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications/settings" as any)} />
        <SettingsRow icon="trophy-outline" label="Favorite Sports" />
        <View className="flex-row items-center px-4 py-4 border-b border-gray-800">
          <Ionicons name="stats-chart-outline" size={20} color="#6b7280" />
          <Text className="text-white ml-3 flex-1">Odds Format</Text>
          <View className="flex-row gap-2">
            {(["american", "decimal"] as OddsFormat[]).map((fmt) => (
              <Pressable
                key={fmt}
                onPress={() => handleOddsFormatChange(fmt)}
                className="px-3 py-1 rounded-lg"
                style={{
                  backgroundColor: oddsFormat === fmt ? "rgba(99,102,241,0.2)" : "#27272A",
                  borderWidth: 1,
                  borderColor: oddsFormat === fmt ? "#6366F1" : "#3F3F46",
                }}
              >
                <Text style={{ color: oddsFormat === fmt ? "#818CF8" : "#6B7280", fontWeight: "600", fontSize: 12 }}>
                  {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-4">
        <SettingsRow icon="shield-checkmark-outline" label="Responsible Gambling" />
        <SettingsRow icon="link-outline" label="Affiliate Disclosure" />
        <SettingsRow icon="information-circle-outline" label="About BetEdge" />
      </View>

      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-8">
        <Pressable className="flex-row items-center px-4 py-4" onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text className="text-red-400 ml-3 font-semibold">Sign Out</Text>
        </Pressable>
      </View>

      {/* Edit username modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 }}
          onPress={() => setEditVisible(false)}
        >
          <Pressable
            style={{ width: "100%", backgroundColor: "#111115", borderRadius: 20, padding: 24,
              borderWidth: 1, borderColor: "#27272A" }}
            onPress={() => {}}
          >
            <Text style={{ color: "#F9FAFB", fontWeight: "800", fontSize: 17, marginBottom: 16 }}>Edit Profile</Text>
            <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 6, fontWeight: "600" }}>USERNAME</Text>
            <TextInput
              style={{ backgroundColor: "#1A1A1F", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                color: "#F9FAFB", fontSize: 15, borderWidth: 1, borderColor: "#27272A", marginBottom: 20 }}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Your username"
              placeholderTextColor="#374151"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1A1A1F",
                  alignItems: "center", borderWidth: 1, borderColor: "#27272A" }}
                onPress={() => setEditVisible(false)}
              >
                <Text style={{ color: "#6B7280", fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: editUsername.trim() ? "#6366F1" : "#27272A", alignItems: "center" }}
                onPress={handleSaveUsername}
                disabled={!editUsername.trim() || saving}
              >
                <Text style={{ color: editUsername.trim() ? "#fff" : "#374151", fontWeight: "700" }}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useBankrollStore } from "../../stores/bankroll";
import { useTokenBalance } from "../../hooks/useTokens";
import { useUIStore } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { supabase } from "../../lib/supabase";
import type { OddsFormat } from "../../lib/odds-utils";

function SettingsRow({
  icon,
  label,
  onPress,
  right,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      className="flex-row items-center px-4 py-4 border-b border-gray-800"
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={20} color="#6b7280" />
      <Text className="text-white ml-3 flex-1">{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color="#4b5563" />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const { balance } = useBankrollStore();
  const tokenBalance = useTokenBalance();
  const router = useRouter();
  const { oddsFormat, setOddsFormat } = useUIStore();
  const session = useAuthStore((s) => s.session);

  async function handleOddsFormatChange(format: OddsFormat) {
    setOddsFormat(format);
    if (session?.user) {
      await supabase.from("profiles").update({ odds_format: format }).eq("id", session.user.id);
    }
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
        <View className="flex-row items-center gap-2 mt-3 flex-wrap justify-center">
          <View className="bg-green-500/20 px-3 py-1 rounded-full">
            <Text className="text-green-400 text-sm font-semibold">
              Bankroll: ${balance.toFixed(2)}
            </Text>
          </View>
          <View
            style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 999 }}
            className="px-3 py-1"
          >
            <Text style={{ color: "#818CF8", fontSize: 13, fontWeight: "600" }}>
              🎯 {tokenBalance.toLocaleString()} tokens
            </Text>
          </View>
        </View>
        <Text style={{ color: "#4B5563", fontSize: 11, marginTop: 6 }}>
          Practice tokens — tracking behavior, no real money
        </Text>
      </View>

      {/* Settings */}
      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-4">
        <SettingsRow
          icon="wallet-outline"
          label="Bankroll Settings"
          onPress={() => router.push("/bankroll" as any)}
        />
        <SettingsRow icon="notifications-outline" label="Notifications" />
        <SettingsRow icon="trophy-outline" label="Favorite Sports" />
        <View className="flex-row items-center px-4 py-4 border-b border-gray-800">
          <Ionicons name="stats-chart-outline" size={20} color="#6b7280" />
          <Text className="text-white ml-3 flex-1">Odds Format</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleOddsFormatChange("american")}
              className="px-3 py-1 rounded-lg"
              style={{
                backgroundColor: oddsFormat === "american" ? "rgba(99,102,241,0.2)" : "#27272A",
                borderWidth: 1,
                borderColor: oddsFormat === "american" ? "#6366F1" : "#3F3F46",
              }}
            >
              <Text style={{ color: oddsFormat === "american" ? "#818CF8" : "#6B7280", fontWeight: "600", fontSize: 12 }}>
                American
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleOddsFormatChange("decimal")}
              className="px-3 py-1 rounded-lg"
              style={{
                backgroundColor: oddsFormat === "decimal" ? "rgba(99,102,241,0.2)" : "#27272A",
                borderWidth: 1,
                borderColor: oddsFormat === "decimal" ? "#6366F1" : "#3F3F46",
              }}
            >
              <Text style={{ color: oddsFormat === "decimal" ? "#818CF8" : "#6B7280", fontWeight: "600", fontSize: 12 }}>
                Decimal
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-4">
        <SettingsRow icon="shield-checkmark-outline" label="Responsible Gambling" />
        <SettingsRow icon="link-outline" label="Affiliate Disclosure" />
        <SettingsRow icon="information-circle-outline" label="About BetEdge" />
      </View>

      <View className="mx-4 rounded-xl overflow-hidden border border-gray-800 mb-8">
        <Pressable
          className="flex-row items-center px-4 py-4"
          onPress={signOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text className="text-red-400 ml-3 font-semibold">Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

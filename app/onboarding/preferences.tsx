import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useUIStore, ONBOARDING_COMPLETE_KEY } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { COLORS } from "../../constants/colors";
import type { OddsFormat } from "../../lib/odds-utils";

const OPTIONS: { format: OddsFormat; label: string; example: string; description: string }[] = [
  {
    format: "american",
    label: "American",
    example: "-110 / +150",
    description: "Standard US sportsbook format. Negative = favorite, positive = underdog.",
  },
  {
    format: "decimal",
    label: "Decimal",
    example: "1.91 / 2.50",
    description: "European format. Multiply your stake by the decimal to get total payout.",
  },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { setOddsFormat } = useUIStore();
  const session = useAuthStore((s) => s.session);
  const [selected, setSelected] = useState<OddsFormat>("american");
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    setLoading(true);
    setOddsFormat(selected);

    if (session?.user) {
      await supabase
        .from("profiles")
        .update({ odds_format: selected })
        .eq("id", session.user.id);
    }

    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setLoading(false);
    router.replace("/(tabs)");
  }

  return (
    <View className="flex-1 px-6 pt-20" style={{ backgroundColor: COLORS.bgDeep }}>
      <Text className="text-white text-2xl font-bold mb-2">Choose odds format</Text>
      <Text className="text-gray-400 text-sm mb-8">You can change this anytime in your profile.</Text>

      <View className="gap-3 mb-8">
        {OPTIONS.map((opt) => {
          const active = selected === opt.format;
          return (
            <Pressable
              key={opt.format}
              onPress={() => setSelected(opt.format)}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: active ? "rgba(99,102,241,0.12)" : COLORS.bgCard,
                borderWidth: 1.5,
                borderColor: active ? COLORS.brand : COLORS.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white font-semibold text-base">{opt.label}</Text>
                <Text style={{ color: active ? COLORS.brand : COLORS.textMuted, fontWeight: "700", fontSize: 15 }}>
                  {opt.example}
                </Text>
              </View>
              <Text className="text-gray-500 text-sm">{opt.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleFinish}
        disabled={loading}
        className="rounded-xl py-4 items-center"
        style={{ backgroundColor: COLORS.brand }}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? "Saving…" : "Get started"}
        </Text>
      </Pressable>
    </View>
  );
}

import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { COLORS } from "../../constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_COMPLETE_KEY } from "../../stores/ui";

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setError("");
    setLoading(true);
    const fullPhone = `+1${digits}`;
    const { error: err } = await supabase.auth.updateUser({ phone: fullPhone });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      router.push({ pathname: "/onboarding/verify", params: { phone: fullPhone } });
    }
  }

  async function handleSkip() {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: COLORS.bgDeep }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-20">
        <Text className="text-white text-2xl font-bold mb-2">Add your number</Text>
        <Text className="text-gray-400 text-sm mb-8">
          We'll send a one-time code to verify. US numbers only (+1).
        </Text>

        <View
          className="flex-row items-center rounded-xl px-4 mb-3"
          style={{ backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border }}
        >
          <Text className="text-gray-400 text-base mr-2">+1</Text>
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="(555) 000-0000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={14}
          />
        </View>

        {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleContinue}
          disabled={loading}
          className="rounded-xl py-4 items-center mb-4"
          style={{ backgroundColor: COLORS.brand }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Send Code</Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} className="items-center py-2">
          <Text className="text-gray-500 text-sm">Skip for now</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

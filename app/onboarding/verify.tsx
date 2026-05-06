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
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { COLORS } from "../../constants/colors";

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  async function handleVerify() {
    if (code.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: phone ?? "",
      token: code,
      type: "phone_change",
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      router.replace("/onboarding/preferences");
    }
  }

  async function handleResend() {
    if (!phone) return;
    setResending(true);
    await supabase.auth.updateUser({ phone });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: COLORS.bgDeep }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-20">
        <Text className="text-white text-2xl font-bold mb-2">Check your texts</Text>
        <Text className="text-gray-400 text-sm mb-8">
          We sent a 6-digit code to {phone}.
        </Text>

        <TextInput
          className="rounded-xl px-4 text-white text-2xl tracking-widest text-center py-4 mb-3"
          style={{ backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, letterSpacing: 8 }}
          placeholder="------"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        {error ? <Text className="text-red-400 text-sm mb-3 text-center">{error}</Text> : null}

        <Pressable
          onPress={handleVerify}
          disabled={loading}
          className="rounded-xl py-4 items-center mb-4"
          style={{ backgroundColor: COLORS.brand }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Verify</Text>
          )}
        </Pressable>

        <Pressable onPress={handleResend} disabled={resending} className="items-center py-2">
          {resending ? (
            <ActivityIndicator color={COLORS.textMuted} size="small" />
          ) : (
            <Text className="text-gray-500 text-sm">
              {resent ? "Code resent!" : "Resend code"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

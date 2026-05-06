import { View, Text, TextInput, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

type Mode = "login" | "signup";

export default function AuthModal() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!email || !password) return Alert.alert("Missing fields", "Please enter email and password.");
    if (mode === "signup" && !username) return Alert.alert("Missing fields", "Please choose a username.");

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: username } },
        });
        if (error) throw error;
        Alert.alert("Account created!", "Check your email to confirm your account, then sign in.");
        setMode("login");
        return;
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-950"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 pt-6 pb-4">
          <Text className="text-white text-xl font-bold">
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-gray-400">✕</Text>
          </Pressable>
        </View>

        <View className="px-4 mt-4">
          {mode === "signup" && (
            <>
              <Text className="text-gray-400 text-sm mb-2">Username</Text>
              <TextInput
                className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
                value={username}
                onChangeText={setUsername}
                placeholder="Pick a username"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
              />
            </>
          )}

          <Text className="text-gray-400 text-sm mb-2">Email</Text>
          <TextInput
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#4b5563"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text className="text-gray-400 text-sm mb-2">Password</Text>
          <TextInput
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-6"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#4b5563"
            secureTextEntry
          />

          <Pressable
            className={`rounded-xl py-4 items-center ${loading ? "bg-gray-700" : "bg-green-500"}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-white font-bold text-base">
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          </Pressable>

          <Pressable className="mt-4 items-center py-2" onPress={() => setMode(mode === "login" ? "signup" : "login")}>
            <Text className="text-gray-400 text-sm">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text className="text-green-400 font-semibold">
                {mode === "login" ? "Sign Up" : "Sign In"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

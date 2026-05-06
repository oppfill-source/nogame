import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { COLORS } from "../constants/colors";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/query-client";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import { useUIStore } from "../stores/ui";
import { useNotifications } from "../hooks/useNotifications";
import type { OddsFormat } from "../lib/odds-utils";

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setProfile } = useAuthStore();
  const { setOddsFormat, loadOddsFormat } = useUIStore();

  useEffect(() => {
    loadOddsFormat();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              if (data.odds_format) setOddsFormat(data.odds_format as OddsFormat);
            }
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (data) {
            setProfile(data);
            if (data.odds_format) setOddsFormat(data.odds_format as OddsFormat);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Wire up push notification listeners
  useNotifications();

  return <>{children}</>;
}

const HEADER_STYLE = {
  headerStyle: { backgroundColor: COLORS.bgMidnight },
  headerTintColor: COLORS.textPrimary,
  headerTitleStyle: { fontWeight: "bold" as const },
  contentStyle: { backgroundColor: COLORS.bgVoid },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <Stack screenOptions={HEADER_STYLE}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(modals)/auth" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="game/[id]" options={{ title: "Game Details" }} />
            <Stack.Screen name="community/[userId]" options={{ title: "Player Profile" }} />
            <Stack.Screen name="community/pick/[pickId]" options={{ title: "Pick Details" }} />
            <Stack.Screen name="bankroll/index" options={{ title: "Bankroll" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

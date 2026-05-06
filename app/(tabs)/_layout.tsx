import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAiPicks } from "../../hooks/useAiPicks";
import { useUIStore, ONBOARDING_COMPLETE_KEY } from "../../stores/ui";
import { useAuthStore } from "../../stores/auth";
import { COLORS } from "../../constants/colors";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

const TAB_BAR_STYLE = {
  tabBarActiveTintColor: COLORS.brand,
  tabBarInactiveTintColor: COLORS.textMuted,
  tabBarStyle: { backgroundColor: COLORS.bgMidnight, borderTopColor: COLORS.border },
  headerStyle: { backgroundColor: COLORS.bgMidnight },
  headerTintColor: COLORS.textPrimary,
  headerTitleStyle: { fontWeight: "bold" as const },
};

export default function TabsLayout() {
  const { data: picks } = useAiPicks();
  const viewedIds = useUIStore((s) => s.viewedAiPickIds);
  const unviewedCount = (picks ?? []).filter((p) => !viewedIds.has(p.id)).length;
  const session = useAuthStore((s) => s.session);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!session) {
      setOnboardingChecked(true);
      return;
    }
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY).then((val) => {
      setNeedsOnboarding(!val);
      setOnboardingChecked(true);
    });
  }, [session]);

  if (!onboardingChecked) return null;
  if (needsOnboarding) return <Redirect href="/onboarding/phone" />;

  return (
    <Tabs screenOptions={TAB_BAR_STYLE}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Games",
          tabBarIcon: ({ color, size }) => <TabIcon name="football-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ai-picks"
        options={{
          title: "AI Picks",
          tabBarBadge: unviewedCount > 0 ? unviewedCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.brand },
          tabBarIcon: ({ color, size }) => <TabIcon name="flash-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "AI Chat",
          tabBarIcon: ({ color, size }) => <TabIcon name="chatbubble-ellipses-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my-bets"
        options={{
          title: "My Bets",
          tabBarIcon: ({ color, size }) => <TabIcon name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => <TabIcon name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <TabIcon name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

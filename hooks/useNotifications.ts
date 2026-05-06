import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { registerPushToken, addNotificationListener, addResponseListener } from "../lib/notifications";
import { useAuthStore } from "../stores/auth";
import { useUIStore } from "../stores/ui";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    // Register for push notifications when user is signed in
    registerPushToken(user.id).catch(() => {
      // Silently fail — permissions may not be granted
    });

    // Handle notifications received while app is open (show in-app toast)
    notificationListener.current = addNotificationListener((notification) => {
      addToast({
        message: notification.request.content.body ?? "New notification",
        type: "info",
      });
    });

    // Handle notification taps — navigate to the relevant screen
    responseListener.current = addResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.screen) {
        router.push(`/(tabs)/${data.screen}` as any);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);
}

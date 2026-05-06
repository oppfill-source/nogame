import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import type { Notification } from "../types";

export function useInAppNotifications() {
  const user = useAuthStore((s) => s.user);

  return useQuery<Notification[]>({
    queryKey: ["inapp-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*, actor:actor_id(username, avatar_url), pick:pick_id(matchup, selection)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notification[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  const { data = [] } = useInAppNotifications();
  return data.filter((n) => !n.read).length;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inapp-notifications"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";

export function useIsFollowing(targetUserId: string) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ["is-following", user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId) return false;
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetUserId,
    staleTime: 30_000,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ targetId, following }: { targetId: string; following: boolean }) => {
      if (!user) throw new Error("Sign in to follow users");
      if (following) {
        await supabase.from("follows").delete().match({ follower_id: user.id, following_id: targetId });
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      }
    },
    onSuccess: (_d, { targetId }) => {
      qc.invalidateQueries({ queryKey: ["is-following"] });
      qc.invalidateQueries({ queryKey: ["profile", targetId] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

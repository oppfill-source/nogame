import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import type { CommunityPick } from "../types";

export type FeedSort = "latest" | "popular" | "top_rated";

const MOCK_COMMUNITY_PICKS: CommunityPick[] = [
  {
    id: "c1", user_id: "u1", game_id: "mock-1", sport: "NBA",
    matchup: "Boston Celtics @ LA Lakers", selection: "Celtics ML",
    bet_type: "moneyline", odds: -105, bookmaker_key: "draftkings",
    note: "Celtics are 8-2 ATS in their last 10 road games. Strong defensive unit vs Lakers slow halfcourt offense.",
    like_count: 24, comment_count: 7, copy_count: 12, created_at: new Date(Date.now() - 3600000).toISOString(),
    profiles: { username: "SharpBettor_88" },
  },
  {
    id: "c2", user_id: "u2", game_id: "mock-4", sport: "NFL",
    matchup: "Buffalo Bills @ Kansas City Chiefs", selection: "Bills +3.5",
    bet_type: "spread", odds: -110, bookmaker_key: "fanduel",
    note: "Getting 3.5 with Buffalo at home in a divisional matchup? The value here is undeniable. Josh Allen at home = cash.",
    like_count: 41, comment_count: 15, copy_count: 31, created_at: new Date(Date.now() - 7200000).toISOString(),
    profiles: { username: "ValueBetKing" },
  },
  {
    id: "c3", user_id: "u3", game_id: "mock-2", sport: "MLB",
    matchup: "Houston Astros @ NY Yankees", selection: "Under 8.5",
    bet_type: "total", odds: -108,
    note: "Two elite starters going today. Both bullpens are well-rested. Low-scoring game incoming.",
    like_count: 18, comment_count: 4, copy_count: 8, created_at: new Date(Date.now() - 10800000).toISOString(),
    profiles: { username: "MLBAnalyst" },
  },
  {
    id: "c4", user_id: "u4", game_id: "mock-3", sport: "NHL",
    matchup: "Montreal Canadiens @ Toronto Maple Leafs", selection: "Toronto ML",
    bet_type: "moneyline", odds: -150, bookmaker_key: "caesars",
    note: "Toronto's goaltending has been elite at home (.935 SV%). Montreal struggling on road. Take the chalk.",
    like_count: 9, comment_count: 2, copy_count: 3, created_at: new Date(Date.now() - 14400000).toISOString(),
    profiles: { username: "PuckDrop_Pro" },
  },
];

export function useCommunityFeed(sort: FeedSort = "latest", sportFilter?: string) {
  return useQuery<CommunityPick[]>({
    queryKey: ["community-feed", sort, sportFilter],
    queryFn: async (): Promise<CommunityPick[]> => {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return applyFilters(MOCK_COMMUNITY_PICKS, sort, sportFilter);

      try {
        let q = supabase
          .from("picks")
          .select("*, profiles(username, avatar_url)")
          .limit(50);

        if (sportFilter) q = q.eq("sport", sportFilter);

        if (sort === "latest") q = q.order("created_at", { ascending: false });
        else if (sort === "popular") q = q.order("like_count", { ascending: false });
        else if (sort === "top_rated") q = q.order("copy_count", { ascending: false });

        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as CommunityPick[];
      } catch {
        return applyFilters(MOCK_COMMUNITY_PICKS, sort, sportFilter);
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: MOCK_COMMUNITY_PICKS,
  });
}

function applyFilters(picks: CommunityPick[], sort: FeedSort, sportFilter?: string) {
  let filtered = sportFilter ? picks.filter((p) => p.sport === sportFilter) : picks;
  if (sort === "popular") return [...filtered].sort((a, b) => b.like_count - a.like_count);
  if (sort === "top_rated") return [...filtered].sort((a, b) => b.copy_count - a.copy_count);
  return filtered;
}

export function useFollowedFeed() {
  const user = useAuthStore((s) => s.user);

  return useQuery<CommunityPick[]>({
    queryKey: ["followed-feed", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get IDs of users this user follows
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (!follows?.length) return [];
      const ids = follows.map((f) => f.following_id);
      const { data } = await supabase
        .from("picks")
        .select("*, profiles(username, avatar_url)")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as CommunityPick[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSharePick() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (pick: Omit<CommunityPick, "id" | "user_id" | "like_count" | "comment_count" | "copy_count" | "created_at" | "profiles">) => {
      if (!user) throw new Error("Sign in to share picks");
      const { data, error } = await supabase
        .from("picks")
        .insert({ ...pick, user_id: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export function useLikePick() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ pickId, liked }: { pickId: string; liked: boolean }) => {
      if (!user) throw new Error("Sign in to like picks");
      if (liked) {
        await supabase.from("pick_likes").delete().match({ pick_id: pickId, user_id: user.id });
      } else {
        await supabase.from("pick_likes").insert({ pick_id: pickId, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export function useCopyPick() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (pickId: string) => {
      if (!user) throw new Error("Sign in to copy picks");
      const { error } = await supabase
        .from("pick_copies")
        .insert({ pick_id: pickId, user_id: user.id });
      if (error && error.code !== "23505") throw new Error(error.message); // ignore duplicate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-feed"] });
      qc.invalidateQueries({ queryKey: ["copied-picks"] });
    },
  });
}

export function useCopiedPickIds() {
  const user = useAuthStore((s) => s.user);
  return useQuery<Set<string>>({
    queryKey: ["copied-picks", user?.id],
    queryFn: async () => {
      if (!user) return new Set();
      const { data } = await supabase
        .from("pick_copies")
        .select("pick_id")
        .eq("user_id", user.id);
      return new Set((data ?? []).map((r) => r.pick_id));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useLikedPickIds() {
  const user = useAuthStore((s) => s.user);
  return useQuery<Set<string>>({
    queryKey: ["liked-picks", user?.id],
    queryFn: async () => {
      if (!user) return new Set();
      const { data } = await supabase
        .from("pick_likes")
        .select("pick_id")
        .eq("user_id", user.id);
      return new Set((data ?? []).map((r) => r.pick_id));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

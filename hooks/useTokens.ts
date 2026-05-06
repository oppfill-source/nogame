import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import type { TokenTransaction } from "../types";

export function useTokenBalance(): number {
  const profile = useAuthStore((s) => s.profile);
  return profile?.token_balance ?? 1000;
}

export function useTokenHistory() {
  const user = useAuthStore((s) => s.user);
  return useQuery<TokenTransaction[]>({
    queryKey: ["token-transactions", user?.id ?? "guest"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("token_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

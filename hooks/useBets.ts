import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import { useBankrollStore } from "../stores/bankroll";
import type { Bet, BetStatus } from "../types";

// ── Token helpers ─────────────────────────────────────────────────────────────

async function updateTokenBalance(
  userId: string,
  delta: number,
  type: string,
  betId?: string,
  note?: string
) {
  // Read current balance fresh from DB to avoid stale reads
  const { data: prof } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", userId)
    .single();

  const current = (prof?.token_balance as number) ?? 1000;
  const newBalance = Math.max(0, current + delta);

  await supabase
    .from("profiles")
    .update({ token_balance: newBalance })
    .eq("id", userId);

  await supabase.from("token_transactions").insert({
    user_id: userId,
    type,
    amount: delta,
    balance_after: newBalance,
    bet_id: betId ?? null,
    note: note ?? null,
  });

  // Sync auth store so UI is immediately updated
  const { data: updated } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (updated) useAuthStore.getState().setProfile(updated);
}

// ── Queries / mutations ───────────────────────────────────────────────────────

export function useBets() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ["bets", user?.id ?? "guest"],
    queryFn: async (): Promise<Bet[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAddBet() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const adjustBalance = useBankrollStore((s) => s.adjustBalance);

  return useMutation({
    mutationFn: async (bet: Omit<Bet, "id" | "placed_at" | "user_id">) => {
      if (!user) throw new Error("Sign in to save bets");
      const { data, error } = await supabase
        .from("bets")
        .insert({ ...bet, user_id: user.id, placed_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Bet;
    },
    onSuccess: async (bet) => {
      adjustBalance(-bet.stake);
      const tokenWagered = Math.round(bet.stake);
      await updateTokenBalance(
        bet.user_id!,
        -tokenWagered,
        "bet_placed",
        bet.id,
        `${bet.game_description} — ${bet.selection}`
      );
      qc.invalidateQueries({ queryKey: ["bets"] });
      qc.invalidateQueries({ queryKey: ["token-transactions"] });
    },
  });
}

export function useUpdateBetStatus() {
  const qc = useQueryClient();
  const adjustBalance = useBankrollStore((s) => s.adjustBalance);

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BetStatus }) => {
      const { data, error } = await supabase
        .from("bets")
        .update({ status, settled_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Bet;
    },
    onSuccess: async (bet) => {
      if (bet.status === "won") {
        adjustBalance(bet.potential_payout);
        const tokenWagered = Math.round(bet.stake);
        const tokenPayout = Math.round(bet.potential_payout);
        // Stake was already deducted on placement; credit full payout back
        await updateTokenBalance(
          bet.user_id!,
          tokenPayout,
          "bet_won",
          bet.id,
          `Won: ${bet.selection} — +${tokenPayout} tokens`
        );
      } else if (bet.status === "push") {
        adjustBalance(bet.stake);
        const tokenWagered = Math.round(bet.stake);
        await updateTokenBalance(
          bet.user_id!,
          tokenWagered,
          "bet_push",
          bet.id,
          `Push: ${bet.selection} — stake refunded`
        );
      } else if (bet.status === "lost") {
        // Tokens already deducted on placement; just log the settlement
        await updateTokenBalance(
          bet.user_id!,
          0,
          "bet_lost",
          bet.id,
          `Lost: ${bet.selection}`
        );
      }
      qc.invalidateQueries({ queryKey: ["bets"] });
      qc.invalidateQueries({ queryKey: ["token-transactions"] });
    },
  });
}

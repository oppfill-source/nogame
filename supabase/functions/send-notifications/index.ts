import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotifType =
  | "engie_pick"
  | "community"
  | "bet_settlement"
  | "leaderboard"
  | "follow"
  | "daily_digest";

interface NotifRequest {
  type: NotifType;
  userId?: string; // omit for daily_digest broadcast
  data?: {
    // engie_pick
    selection?: string;
    confidence?: number;
    odds?: number;
    // community
    actorUsername?: string;
    actionType?: "comment" | "like" | "copy";
    pickMatchup?: string;
    // bet_settlement
    result?: "won" | "lost" | "push";
    amount?: number;
    // leaderboard
    rank?: number;
    // follow
    followerUsername?: string;
  };
}

const PREF_COLUMN: Record<NotifType, string> = {
  engie_pick:     "notif_engie_picks",
  community:      "notif_community",
  bet_settlement: "notif_bet_settlement",
  leaderboard:    "notif_leaderboard",
  follow:         "notif_follows",
  daily_digest:   "notif_daily_digest",
};

function buildMessage(type: NotifType, data: NotifRequest["data"] = {}): { title: string; body: string; screen?: string } {
  switch (type) {
    case "engie_pick":
      return {
        title: "⚡ New Engie Pick",
        body: `${data.selection ?? "New pick"} at ${data.odds ? (data.odds > 0 ? "+" + data.odds : data.odds) : "—"}${data.confidence ? ` (${data.confidence}% confidence)` : ""}`,
        screen: "ai-picks",
      };
    case "community":
      if (data.actionType === "comment") return { title: "💬 New Comment", body: `${data.actorUsername ?? "Someone"} commented on your ${data.pickMatchup ?? "pick"}`, screen: "community" };
      if (data.actionType === "like")    return { title: "❤️ Pick Liked",   body: `${data.actorUsername ?? "Someone"} liked your ${data.pickMatchup ?? "pick"}`, screen: "community" };
      return                                    { title: "📋 Pick Copied",  body: `${data.actorUsername ?? "Someone"} copied your ${data.pickMatchup ?? "pick"}`, screen: "community" };
    case "bet_settlement":
      if (data.result === "won")  return { title: "🎉 Bet Won!",  body: `+$${(data.amount ?? 0).toFixed(2)} — ${data.selection ?? "your bet"} came through!`, screen: "my-bets" };
      if (data.result === "push") return { title: "↩️ Bet Push",  body: `Push — your stake on ${data.selection ?? "your bet"} was refunded`, screen: "my-bets" };
      return                             { title: "❌ Bet Lost",   body: `${data.selection ?? "Your bet"} didn't land. Better luck next time.`, screen: "my-bets" };
    case "leaderboard":
      return { title: "🏆 Leaderboard Update", body: `You're #${data.rank ?? "?"} on the leaderboard!`, screen: "community" };
    case "follow":
      return { title: "👤 New Follower", body: `${data.followerUsername ?? "Someone"} started following you`, screen: "community" };
    case "daily_digest":
      return { title: "📊 Daily Digest", body: "Check your picks summary and today's best Engie picks →", screen: "ai-picks" };
  }
}

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown> = {}) {
  const resp = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify([{ to: token, sound: "default", title, body, data }]),
  });
  return resp.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: NotifRequest = await req.json();
    const { type, userId, data = {} } = payload;

    if (!type) {
      return new Response(JSON.stringify({ error: "type is required" }), { status: 400, headers: corsHeaders });
    }

    const prefCol = PREF_COLUMN[type];
    const msg = buildMessage(type, data);

    if (type === "daily_digest" && !userId) {
      // Broadcast to all users who have digest enabled
      const { data: users } = await supabase
        .from("profiles")
        .select("id, push_token, notif_daily_digest")
        .eq("notif_daily_digest", true)
        .not("push_token", "is", null);

      let sent = 0;
      for (const u of users ?? []) {
        if (!u.push_token?.startsWith("ExponentPushToken[")) continue;
        const ok = await sendPush(u.push_token, msg.title, msg.body, { screen: msg.screen });
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required for this type" }), { status: 400, headers: corsHeaders });
    }

    // Fetch target user — check their preference and push token in one query
    const { data: profile } = await supabase
      .from("profiles")
      .select(`id, push_token, ${prefCol}`)
      .eq("id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "user not found" }), { status: 404, headers: corsHeaders });
    }

    if (!profile[prefCol]) {
      return new Response(JSON.stringify({ skipped: "user has disabled this notification type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = profile.push_token as string | null;
    if (!token?.startsWith("ExponentPushToken[")) {
      return new Response(JSON.stringify({ skipped: "no valid push token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = await sendPush(token, msg.title, msg.body, { screen: msg.screen, ...data });

    return new Response(JSON.stringify({ sent: ok ? 1 : 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-notifications error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

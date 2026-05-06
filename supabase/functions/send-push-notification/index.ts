import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Optional: target a specific user instead of broadcasting */
  userId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: PushPayload = await req.json();
    const { title, body, data, userId } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch push tokens — either one user or all who have a token
    let query = supabase.from("profiles").select("id, push_token").not("push_token", "is", null);
    if (userId) query = query.eq("id", userId);

    const { data: profiles, error } = await query;
    if (error) throw error;

    const tokens = (profiles ?? [])
      .map((p: any) => p.push_token as string)
      .filter((t: string) => t.startsWith("ExponentPushToken["));

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: "no valid tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expo Push API accepts up to 100 messages per request
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) {
      chunks.push(tokens.slice(i, i + 100));
    }

    let totalSent = 0;
    for (const chunk of chunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: data ?? {},
      }));

      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });

      if (resp.ok) totalSent += chunk.length;
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

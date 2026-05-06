import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import type { ChatMessage } from "../types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useChat() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const { messages, addMessage, updateMessage, clearChat } = useChatStore();
  const isLoading = messages.some((m) => m.isLoading);
  const [personalityType, setPersonalityType] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const loadedForUser = useRef<string | null>(null);

  // Load persisted conversation on sign-in (once per user session)
  useEffect(() => {
    if (!user || loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    supabase
      .from("conversations")
      .select("messages")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          clearChat();
          for (const m of data.messages as { role: string; content: string }[]) {
            addMessage({
              id: makeId(),
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(),
            });
          }
        }
        setHistoryLoaded(true);
      });
  }, [user?.id]);

  // Also mark history as loaded for guests immediately
  useEffect(() => {
    if (!user) setHistoryLoaded(true);
  }, [user]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      addMessage(userMsg);

      const loadingId = makeId();
      addMessage({
        id: loadingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      });

      try {
        // Full history to send (exclude the loading placeholder)
        const history = [...messages, userMsg]
          .filter((m) => !m.isLoading)
          .map((m) => ({ role: m.role, content: m.content }));

        const { data, error } = await supabase.functions.invoke("chat-agent", {
          body: { messages: history },
        });

        if (error) throw new Error(error.message);
        if (!data?.reply) throw new Error("Empty response from AI");

        if (data.personalityType) setPersonalityType(data.personalityType);

        updateMessage(loadingId, {
          content: data.reply,
          isLoading: false,
          timestamp: new Date(),
        });
      } catch {
        updateMessage(loadingId, {
          content: "Sorry, I hit an error. Try again.",
          isLoading: false,
          timestamp: new Date(),
        });
      }
    },
    [messages, isLoading, session, addMessage, updateMessage]
  );

  const newChat = useCallback(async () => {
    clearChat();
    loadedForUser.current = null;
    // Delete persisted conversation so the next session starts fresh
    if (user) {
      await supabase.from("conversations").delete().eq("user_id", user.id);
    }
  }, [user, clearChat]);

  return { messages, isLoading, sendMessage, clearChat: newChat, personalityType, historyLoaded };
}

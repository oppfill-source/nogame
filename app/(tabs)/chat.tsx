import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRef } from "react";
import { ChatMessage } from "../../components/chat/ChatMessage";
import { ChatInput } from "../../components/chat/ChatInput";
import { useChat } from "../../hooks/useChat";
import { useAuthStore } from "../../stores/auth";

const PERSONALITY_LABELS: Record<string, { label: string; color: string }> = {
  conservative: { label: "Conservative",  color: "#3B82F6" },
  aggressive:   { label: "Aggressive",    color: "#F97316" },
  chaser:       { label: "⚠ Chaser risk", color: "#EF4444" },
  data_driven:  { label: "Data-Driven",   color: "#8B5CF6" },
  balanced:     { label: "Balanced",      color: "#22C55E" },
};

const SUGGESTED_PROMPTS = [
  "What are today's best value picks?",
  "How's my betting performance this month?",
  "Should I bet the Lakers tonight?",
  "Explain my win rate by sport",
  "What patterns do you see in my betting?",
];

function EmptyState({ onPrompt, historyLoaded }: { onPrompt: (p: string) => void; historyLoaded: boolean }) {
  const user = useAuthStore((s) => s.user);
  if (!historyLoaded) return null;

  return (
    <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 16, paddingHorizontal: 16 }}>
      {/* Branding */}
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(99,102,241,0.15)", borderWidth: 1, borderColor: "rgba(99,102,241,0.3)",
          marginBottom: 12,
        }}>
          <Text style={{ fontSize: 28 }}>⚡</Text>
        </View>
        <Text style={{ color: "#F9FAFB", fontSize: 20, fontWeight: "800", marginBottom: 4 }}>Engie</Text>
        <Text style={{ color: "#6B7280", fontSize: 13, textAlign: "center", maxWidth: 260, lineHeight: 19 }}>
          {user
            ? "Your personal betting advisor — knows your history, patterns, and style."
            : "Data-driven betting analysis. Sign in to unlock personalized insights."}
        </Text>
      </View>

      {/* Quick prompts */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: "#374151", fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 }}>
          TRY ASKING
        </Text>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => onPrompt(prompt)}
            style={{
              backgroundColor: "#111115", borderWidth: 1, borderColor: "#27272A",
              borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#D1D5DB", fontSize: 13 }}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { messages, isLoading, sendMessage, clearChat, personalityType, historyLoaded } = useChat();
  const user = useAuthStore((s) => s.user);
  const listRef = useRef<FlatList>(null);

  function handleSend(text: string) {
    sendMessage(text);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const personality = personalityType ? PERSONALITY_LABELS[personalityType] : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0A0A0D" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: "#111115",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#818CF8" }} />
          <Text style={{ color: "#F9FAFB", fontWeight: "700", fontSize: 15 }}>Engie</Text>
          <View style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#818CF8", fontSize: 10, fontWeight: "700" }}>BETA</Text>
          </View>
          {personality && (
            <View style={{
              backgroundColor: personality.color + "20", borderRadius: 99,
              paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1,
              borderColor: personality.color + "40",
            }}>
              <Text style={{ color: personality.color, fontSize: 10, fontWeight: "700" }}>
                {personality.label}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {messages.length > 0 && user && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#22C55E" }} />
              <Text style={{ color: "#374151", fontSize: 10 }}>saved</Text>
            </View>
          )}
          {messages.length > 0 && (
            <Pressable onPress={clearChat}>
              <Text style={{ color: "#4B5563", fontSize: 12 }}>New chat</Text>
            </Pressable>
          )}
        </View>
      </View>

      {messages.length === 0 ? (
        <EmptyState onPrompt={handleSend} historyLoaded={historyLoaded} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessage message={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </KeyboardAvoidingView>
  );
}

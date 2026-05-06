import { View, Text } from "react-native";
import type { ChatMessage as ChatMessageType } from "../../types";

type Props = { message: ChatMessageType };

function TypingIndicator() {
  return (
    <View className="flex-row items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-500"
        />
      ))}
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View className="flex-row justify-end px-4 mb-3">
        <View className="max-w-[78%]">
          <View className="bg-green-500 rounded-2xl rounded-tr-sm px-4 py-3">
            <Text className="text-white text-sm leading-5">{message.content}</Text>
          </View>
          <Text className="text-gray-600 text-xs mt-1 text-right">
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row justify-start px-4 mb-3">
      <View className="max-w-[84%]">
        {/* AI label */}
        <View className="flex-row items-center gap-1.5 mb-1.5">
          <View className="w-5 h-5 rounded-full bg-indigo-500/20 items-center justify-center">
            <Text style={{ fontSize: 10 }}>⚡</Text>
          </View>
          <Text className="text-indigo-400 text-xs font-semibold">Engie</Text>
        </View>

        <View
          className="rounded-2xl rounded-tl-sm px-4 py-3"
          style={{ backgroundColor: "#1C1C1F", borderWidth: 1, borderColor: "#27272A" }}
        >
          {message.isLoading ? (
            <TypingIndicator />
          ) : (
            <Text className="text-gray-100 text-sm leading-5">{message.content}</Text>
          )}
        </View>

        {!message.isLoading && (
          <Text className="text-gray-600 text-xs mt-1">
            {formatTime(message.timestamp)}
          </Text>
        )}
      </View>
    </View>
  );
}

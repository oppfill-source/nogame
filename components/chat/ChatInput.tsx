import { useState, useRef } from "react";
import { View, TextInput, Pressable, Text } from "react-native";

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View
      className="flex-row items-end px-3 py-2 gap-2"
      style={{ backgroundColor: "#18181B", borderTopWidth: 1, borderTopColor: "#27272A" }}
    >
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder="Ask about picks, odds, strategy…"
        placeholderTextColor="#52525B"
        multiline
        maxLength={500}
        style={{
          flex: 1,
          backgroundColor: "#27272A",
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          color: "#FAFAFA",
          fontSize: 15,
          maxHeight: 120,
          lineHeight: 20,
        }}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        returnKeyType="default"
        editable={!disabled}
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: canSend ? "#22C55E" : "#27272A",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 1,
        }}
      >
        <Text style={{ fontSize: 18, color: canSend ? "#fff" : "#52525B" }}>↑</Text>
      </Pressable>
    </View>
  );
}

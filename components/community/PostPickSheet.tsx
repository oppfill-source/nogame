import { View, Text, TextInput, Pressable, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";
import { useAuthStore } from "../../stores/auth";
import { useSharePick } from "../../hooks/useCommunityFeed";
import { SPORTS } from "../../constants/sports";
import { useFormatOdds } from "../../hooks/useFormatOdds";

interface PostPickSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-fill from a game/bet if available */
  prefill?: {
    game_id?: string;
    sport?: string;
    matchup?: string;
    selection?: string;
    odds?: number;
    bookmaker_key?: string;
    ai_pick_id?: string;
  };
}

export function PostPickSheet({ visible, onClose, prefill }: PostPickSheetProps) {
  const user = useAuthStore((s) => s.user);
  const { mutate: sharePick, isPending } = useSharePick();
  const formatOdds = useFormatOdds();

  const [sport, setSport] = useState(prefill?.sport ?? "basketball_nba");
  const [matchup, setMatchup] = useState(prefill?.matchup ?? "");
  const [selection, setSelection] = useState(prefill?.selection ?? "");
  const [oddsText, setOddsText] = useState(prefill?.odds ? String(prefill.odds) : "");
  const [note, setNote] = useState("");

  function handleSubmit() {
    if (!user) return;
    const odds = parseInt(oddsText, 10);
    if (!matchup.trim() || !selection.trim() || isNaN(odds)) {
      return Alert.alert("Missing fields", "Please fill in matchup, selection, and odds.");
    }

    sharePick(
      {
        game_id:       prefill?.game_id ?? `manual-${Date.now()}`,
        sport,
        matchup:       matchup.trim(),
        selection:     selection.trim(),
        bet_type:      "moneyline",
        odds,
        bookmaker_key: prefill?.bookmaker_key,
        note:          note.trim() || undefined,
        ai_pick_id:    prefill?.ai_pick_id,
      },
      {
        onSuccess: () => {
          setMatchup(""); setSelection(""); setOddsText(""); setNote("");
          onClose();
        },
        onError: (e) => Alert.alert("Error", e.message),
      }
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-950"
      >
        <ScrollView>
          {/* Header */}
          <View className="flex-row justify-between items-center px-4 pt-6 pb-4 border-b border-gray-800">
            <Text className="text-white text-lg font-bold">Share a Pick</Text>
            <Pressable onPress={onClose}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </Pressable>
          </View>

          <View className="px-4 mt-4">
            {/* Sport selector */}
            <Text className="text-gray-400 text-sm mb-2">Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {SPORTS.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => setSport(s.key)}
                    className={`px-3 py-2 rounded-xl border ${sport === s.key ? "bg-green-500 border-green-500" : "bg-gray-900 border-gray-700"}`}
                  >
                    <Text className={`text-sm font-semibold ${sport === s.key ? "text-white" : "text-gray-400"}`}>
                      {s.emoji} {s.short}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Matchup */}
            <Text className="text-gray-400 text-sm mb-2">Matchup</Text>
            <TextInput
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
              value={matchup}
              onChangeText={setMatchup}
              placeholder="e.g. Lakers @ Celtics"
              placeholderTextColor="#4b5563"
            />

            {/* Selection */}
            <Text className="text-gray-400 text-sm mb-2">Your Pick</Text>
            <TextInput
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
              value={selection}
              onChangeText={setSelection}
              placeholder="e.g. Los Angeles Lakers"
              placeholderTextColor="#4b5563"
            />

            {/* Odds */}
            <Text className="text-gray-400 text-sm mb-2">American Odds</Text>
            <TextInput
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
              value={oddsText}
              onChangeText={setOddsText}
              placeholder="-110"
              placeholderTextColor="#4b5563"
              keyboardType="numbers-and-punctuation"
            />

            {/* Preview */}
            {oddsText && !isNaN(parseInt(oddsText)) && (
              <View className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-700 mb-4">
                <Text className="text-gray-500 text-xs">Preview</Text>
                <Text className="text-white font-semibold mt-1">{selection || "—"}</Text>
                <Text className="text-green-400 text-sm">{formatOdds(parseInt(oddsText))} moneyline</Text>
              </View>
            )}

            {/* Note */}
            <Text className="text-gray-400 text-sm mb-2">Note (optional)</Text>
            <TextInput
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white mb-6"
              value={note}
              onChangeText={setNote}
              placeholder="Why do you like this pick?"
              placeholderTextColor="#4b5563"
              multiline
              numberOfLines={3}
            />

            <Pressable
              className={`rounded-xl py-4 items-center mb-8 ${isPending ? "bg-gray-700" : "bg-green-500"}`}
              onPress={handleSubmit}
              disabled={isPending}
            >
              <Text className="text-white font-bold text-base">
                {isPending ? "Sharing..." : "Share Pick"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

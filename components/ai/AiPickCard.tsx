import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import { Badge } from "../ui/Badge";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import { openBookmaker, BOOKMAKER_BY_KEY } from "../../lib/affiliates";
import type { AiPick, AiPickOddsEntry } from "../../types";

const CONFIDENCE_LABELS: Record<number, { label: string; color: string; ratingBg: string }> = {
  10: { label: "Elite Value",    color: "text-yellow-300", ratingBg: "bg-yellow-400/20" },
  9:  { label: "Strong Value",   color: "text-yellow-400", ratingBg: "bg-yellow-400/15" },
  8:  { label: "Good Value",     color: "text-green-400",  ratingBg: "bg-green-500/20" },
  7:  { label: "Value",          color: "text-green-400",  ratingBg: "bg-green-500/15" },
  6:  { label: "Slight Value",   color: "text-yellow-400", ratingBg: "bg-yellow-500/15" },
  5:  { label: "Marginal",       color: "text-gray-400",   ratingBg: "bg-gray-700" },
};

function getConfidenceStyle(rating: number) {
  const key = Math.max(5, Math.min(10, rating));
  return CONFIDENCE_LABELS[key] ?? CONFIDENCE_LABELS[5];
}

type Props = {
  pick: AiPick;
  onTrack?: (pick: AiPick) => void;
};

export function AiPickCard({ pick, onTrack }: Props) {
  const formatOdds = useFormatOdds();
  const [expanded, setExpanded] = useState(false);
  const bm = BOOKMAKER_BY_KEY[pick.bookmaker_key];
  const conf = getConfidenceStyle(pick.value_rating);

  // odds_data may come back as a parsed array (Supabase JSONB) or a JSON string
  const oddsEntries: AiPickOddsEntry[] = (() => {
    if (!pick.odds_data) return [];
    if (typeof pick.odds_data === "string") {
      try { return JSON.parse(pick.odds_data); } catch { return []; }
    }
    return Array.isArray(pick.odds_data) ? pick.odds_data : [];
  })();

  return (
    <View className="bg-gray-900 mx-4 mb-3 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <Badge label={pick.sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).split(" ").slice(-1)[0]} variant="success" />
          <Badge label="AI Pick" variant="ai" />
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xs font-semibold ${conf.color}`}>{conf.label}</Text>
          <View className={`rounded-lg px-2 py-0.5 ${conf.ratingBg}`}>
            <Text className={`font-bold text-sm ${conf.color}`}>{pick.value_rating}/10</Text>
          </View>
        </View>
      </View>

      {/* Matchup */}
      <View className="px-4 pb-3">
        <Text className="text-gray-400 text-xs mb-1">
          {pick.away_team} @ {pick.home_team}
        </Text>
        <Text className="text-white text-lg font-bold">{pick.selection}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <Text className="text-green-400 font-semibold text-base">{formatOdds(pick.recommended_odds)}</Text>
          <Text className="text-gray-500">•</Text>
          <Text className="text-gray-400 text-sm capitalize">{pick.bet_type}</Text>
          {pick.confidence_pct !== undefined && (
            <>
              <Text className="text-gray-500">•</Text>
              <Text className="text-gray-400 text-sm">{pick.confidence_pct}% win est.</Text>
            </>
          )}
        </View>
      </View>

      {/* Odds comparison across bookmakers */}
      {oddsEntries.length > 1 && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#27272A",
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.03)",
          }}
        >
          <View className="flex-row items-center justify-between px-3 py-2"
            style={{ borderBottomWidth: 1, borderBottomColor: "#27272A" }}>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
              Odds Comparison
            </Text>
            <Text className="text-green-500 text-xs font-semibold">Best ↑</Text>
          </View>
          {oddsEntries.slice(0, 5).map((entry, idx) => (
            <View
              key={entry.key}
              className="flex-row items-center justify-between px-3 py-2"
              style={idx < oddsEntries.slice(0, 5).length - 1
                ? { borderBottomWidth: 1, borderBottomColor: "#1F1F23" }
                : undefined}
            >
              <View className="flex-row items-center gap-2">
                {idx === 0 && (
                  <View
                    style={{
                      backgroundColor: "rgba(34,197,94,0.15)",
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: "#4ADE80", fontSize: 10, fontWeight: "700" }}>BEST</Text>
                  </View>
                )}
                <Text
                  className={`text-sm ${idx === 0 ? "text-white font-medium" : "text-gray-400"}`}
                >
                  {entry.title}
                </Text>
              </View>
              <Text
                className={`text-sm font-mono font-semibold ${
                  idx === 0 ? "text-green-400" : "text-gray-500"
                }`}
              >
                {formatOdds(entry.odds)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Engie Analysis (expandable) */}
      <Pressable
        className="px-4 py-2 bg-gray-800/50 flex-row items-center justify-between"
        onPress={() => setExpanded((e) => !e)}
      >
        <Text className="text-indigo-400 text-xs font-medium">Engie Analysis</Text>
        <Text className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && (
        <View className="px-4 py-3 bg-gray-800/30">
          <Text className="text-gray-300 text-sm leading-5">{pick.reasoning}</Text>
        </View>
      )}

      {/* Value bar */}
      <View className="h-1 bg-gray-800">
        <View
          className="h-1 bg-green-500"
          style={{ width: `${(pick.value_rating / 10) * 100}%` }}
        />
      </View>

      {/* Actions */}
      <View className="flex-row p-3 gap-2">
        {bm && (
          <Pressable
            className="flex-1 border border-green-500 rounded-lg py-2 items-center"
            onPress={() => openBookmaker(pick.bookmaker_key)}
          >
            <Text className="text-green-400 font-semibold text-sm">Open {bm.title}</Text>
          </Pressable>
        )}
        {onTrack && (
          <Pressable
            className="flex-1 bg-green-500 rounded-lg py-2 items-center"
            onPress={() => onTrack(pick)}
          >
            <Text className="text-white font-semibold text-sm">Track Bet</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

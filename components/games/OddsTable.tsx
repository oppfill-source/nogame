import { View, Text, Pressable } from "react-native";
import { Badge } from "../ui/Badge";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import { openBookmaker } from "../../lib/affiliates";
import type { BookmakerOddsRow } from "../../lib/affiliates";

type Props = {
  rows: BookmakerOddsRow[];
  homeTeam: string;
  awayTeam: string;
  onSelectBet?: (bookmakerKey: string, side: "home" | "away", odds: number) => void;
  selectedKey?: string;
  selectedSide?: "home" | "away";
};

export function OddsTable({ rows, homeTeam, awayTeam, onSelectBet, selectedKey, selectedSide }: Props) {
  const formatOdds = useFormatOdds();
  if (rows.length === 0) return null;

  return (
    <View className="rounded-xl overflow-hidden border border-gray-800">
      {/* Header */}
      <View className="flex-row bg-gray-800 px-4 py-2 items-center">
        <Text className="text-gray-400 text-xs flex-1">Bookmaker</Text>
        <Text className="text-gray-400 text-xs w-20 text-center" numberOfLines={1}>
          {awayTeam.split(" ").slice(-1)[0]}
        </Text>
        <Text className="text-gray-400 text-xs w-20 text-center" numberOfLines={1}>
          {homeTeam.split(" ").slice(-1)[0]}
        </Text>
        <Text className="text-gray-400 text-xs w-14 text-center">Bet</Text>
      </View>

      {rows.map((row, i) => (
        <View
          key={row.bookmaker.key}
          className={`flex-row px-4 py-3 items-center ${
            i < rows.length - 1 ? "border-b border-gray-800" : ""
          }`}
        >
          {/* Bookmaker name + best badge */}
          <View className="flex-1 gap-1">
            <Text className="text-white text-sm font-medium">{row.bookmaker.title}</Text>
            {(row.isBestHome || row.isBestAway) && (
              <Badge label="BEST ODDS" variant="success" size="xs" />
            )}
          </View>

          {/* Away odds */}
          <Pressable
            className={`w-20 py-1.5 rounded-lg items-center mx-1 ${
              selectedKey === row.bookmaker.key && selectedSide === "away"
                ? "bg-green-500/30 border border-green-500"
                : row.isBestAway
                ? "bg-green-500/10"
                : "bg-gray-800"
            }`}
            onPress={() => onSelectBet?.(row.bookmaker.key, "away", row.awayOdds)}
          >
            <Text className={`text-sm font-bold ${row.isBestAway ? "text-green-400" : "text-white"}`}>
              {formatOdds(row.awayOdds)}
            </Text>
          </Pressable>

          {/* Home odds */}
          <Pressable
            className={`w-20 py-1.5 rounded-lg items-center mx-1 ${
              selectedKey === row.bookmaker.key && selectedSide === "home"
                ? "bg-green-500/30 border border-green-500"
                : row.isBestHome
                ? "bg-green-500/10"
                : "bg-gray-800"
            }`}
            onPress={() => onSelectBet?.(row.bookmaker.key, "home", row.homeOdds)}
          >
            <Text className={`text-sm font-bold ${row.isBestHome ? "text-green-400" : "text-white"}`}>
              {formatOdds(row.homeOdds)}
            </Text>
          </Pressable>

          {/* Affiliate CTA */}
          <Pressable
            className="w-14 bg-green-500 rounded-lg py-1.5 items-center"
            onPress={() => openBookmaker(row.bookmaker.key)}
          >
            <Text className="text-white text-xs font-bold">BET</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

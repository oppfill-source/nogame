import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { OddsTable } from "../../components/games/OddsTable";
import { AddBetSheet } from "../../components/bets/AddBetSheet";
import { LoadingState } from "../../components/ui/LoadingState";
import { Badge } from "../../components/ui/Badge";
import { calcPayout } from "../../lib/odds-utils";
import { useFormatOdds } from "../../hooks/useFormatOdds";
import { getBookmakerOddsRows } from "../../lib/affiliates";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingGames } from "../../lib/odds-api";
import { useAddBet } from "../../hooks/useBets";
import { useAuthStore } from "../../stores/auth";
import type { Bet } from "../../types";
import { SPORTS } from "../../constants/sports";

// Mock data used when the game ID starts with "mock-"
const MOCK_GAME_DETAIL = {
  id: "mock-1",
  home_team: "Los Angeles Lakers",
  away_team: "Boston Celtics",
  sport_title: "NBA",
  sport_key: "basketball_nba",
  commence_time: new Date().toISOString(),
  bookmakers: [
    {
      key: "draftkings", title: "DraftKings", last_update: new Date().toISOString(),
      markets: [
        { key: "h2h", last_update: "", outcomes: [{ name: "Boston Celtics", price: -108 }, { name: "Los Angeles Lakers", price: -112 }] },
        { key: "spreads", last_update: "", outcomes: [{ name: "Boston Celtics", price: -110, point: -3.5 }, { name: "Los Angeles Lakers", price: -110, point: 3.5 }] },
        { key: "totals", last_update: "", outcomes: [{ name: "Over", price: -110, point: 224.5 }, { name: "Under", price: -110, point: 224.5 }] },
      ],
    },
    {
      key: "fanduel", title: "FanDuel", last_update: new Date().toISOString(),
      markets: [
        { key: "h2h", last_update: "", outcomes: [{ name: "Boston Celtics", price: -110 }, { name: "Los Angeles Lakers", price: -110 }] },
        { key: "spreads", last_update: "", outcomes: [{ name: "Boston Celtics", price: -115, point: -3.5 }, { name: "Los Angeles Lakers", price: -105, point: 3.5 }] },
        { key: "totals", last_update: "", outcomes: [{ name: "Over", price: -108, point: 224.5 }, { name: "Under", price: -112, point: 224.5 }] },
      ],
    },
    {
      key: "betmgm", title: "BetMGM", last_update: new Date().toISOString(),
      markets: [
        { key: "h2h", last_update: "", outcomes: [{ name: "Boston Celtics", price: -105 }, { name: "Los Angeles Lakers", price: -115 }] },
        { key: "spreads", last_update: "", outcomes: [{ name: "Boston Celtics", price: -112, point: -3.5 }, { name: "Los Angeles Lakers", price: -108, point: 3.5 }] },
        { key: "totals", last_update: "", outcomes: [{ name: "Over", price: -112, point: 224.5 }, { name: "Under", price: -108, point: 224.5 }] },
      ],
    },
    {
      key: "caesars", title: "Caesars", last_update: new Date().toISOString(),
      markets: [
        { key: "h2h", last_update: "", outcomes: [{ name: "Boston Celtics", price: -112 }, { name: "Los Angeles Lakers", price: -108 }] },
        { key: "spreads", last_update: "", outcomes: [{ name: "Boston Celtics", price: -110, point: -3.0 }, { name: "Los Angeles Lakers", price: -110, point: 3.0 }] },
        { key: "totals", last_update: "", outcomes: [{ name: "Over", price: -110, point: 224.5 }, { name: "Under", price: -110, point: 224.5 }] },
      ],
    },
  ],
};

// Sports to try if no sport param is in the URL (ordered by likelihood of having games)
const FALLBACK_SPORTS = [
  "basketball_nba",
  "baseball_mlb",
  "icehockey_nhl",
  "americanfootball_nfl",
  "soccer_usa_mls",
  "soccer_epl",
  "mma_mixed_martial_arts",
];

type BetSelection = {
  bookmakerKey: string;
  side: "home" | "away";
  odds: number;
  betType: "moneyline" | "spread" | "total";
  label: string;
};

export default function GameDetailScreen() {
  const { id, sport } = useLocalSearchParams<{ id: string; sport?: string }>();
  const { mutate: addBet, isPending } = useAddBet();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const formatOdds = useFormatOdds();
  const [selection, setSelection] = useState<BetSelection | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const isMock = id?.startsWith("mock-");

  const { data: game, isLoading } = useQuery({
    queryKey: ["game-detail", id, sport],
    queryFn: async () => {
      if (isMock) return null;
      const apiKey = process.env.EXPO_PUBLIC_ODDS_API_KEY;
      if (!apiKey) return null;

      // Try the specified sport first, then fall back through common sports
      const sportsToTry = sport
        ? [sport, ...FALLBACK_SPORTS.filter((s) => s !== sport)]
        : FALLBACK_SPORTS;

      for (const s of sportsToTry) {
        try {
          const games = await getUpcomingGames(s);
          const found = games.find((g) => g.id === id);
          if (found) return found;
        } catch {
          // try next sport
        }
      }
      return null;
    },
    enabled: !isMock,
    staleTime: 30_000,
  });

  const gameData = isMock ? MOCK_GAME_DETAIL : game;

  if (isLoading && !isMock) return <LoadingState message="Loading live odds..." />;
  if (!gameData) return <LoadingState message="Loading game..." />;

  const oddsRows = getBookmakerOddsRows(gameData as any);
  const selectedTeam =
    selection?.side === "home" ? gameData.home_team : gameData.away_team;

  // Find sport label for display
  const sportConfig = SPORTS.find((s) => s.key === (gameData as any).sport_key);
  const sportLabel = (gameData as any).sport_title ?? sportConfig?.label ?? sport ?? "Game";

  // Game time
  const gameTime = gameData.commence_time
    ? new Date(gameData.commence_time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "";

  function handleSelectBet(
    bookmakerKey: string,
    side: "home" | "away",
    odds: number,
    betType?: "moneyline" | "spread" | "total",
    label?: string
  ) {
    setSelection({
      bookmakerKey,
      side,
      odds,
      betType: betType ?? "moneyline",
      label: label ?? (side === "home" ? gameData!.home_team : gameData!.away_team),
    });
  }

  function handleTrackBet() {
    if (!user) {
      Alert.alert("Sign In Required", "Sign in to track bets.", [
        { text: "Sign In", onPress: () => router.push("/(modals)/auth" as any) },
        { text: "Cancel" },
      ]);
      return;
    }
    if (!selection) return;
    setShowAddSheet(true);
  }

  // Summary odds label
  const payout = selection
    ? calcPayout(100, selection.odds).toFixed(2)
    : null;

  return (
    <ScrollView className="flex-1 bg-gray-950">
      <View className="p-4">
        {/* Matchup header */}
        <View className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge label={sportLabel} variant="success" />
            {gameTime ? (
              <Text className="text-gray-500 text-xs">{gameTime}</Text>
            ) : null}
          </View>
          <View className="flex-row justify-between items-center mt-1">
            <View className="flex-1 items-center">
              <Text className="text-white font-bold text-base text-center" numberOfLines={2}>
                {gameData.away_team}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Away</Text>
            </View>
            <View className="px-4">
              <Text className="text-gray-400 font-bold text-lg">@</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-white font-bold text-base text-center" numberOfLines={2}>
                {gameData.home_team}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Home</Text>
            </View>
          </View>
        </View>

        {/* Odds comparison */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-lg font-bold">Live Odds</Text>
          <Text className="text-gray-500 text-xs">Tap a line to select</Text>
        </View>

        <OddsTable
          rows={oddsRows}
          homeTeam={gameData.home_team}
          awayTeam={gameData.away_team}
          onSelectBet={handleSelectBet}
          selectedKey={selection?.bookmakerKey}
          selectedSide={selection?.side}
        />

        {/* Selected bet summary */}
        {selection && (
          <View
            className="mt-4 rounded-xl p-4 border border-green-500/20"
            style={{ backgroundColor: "rgba(34,197,94,0.08)" }}
          >
            <Text className="text-green-400 font-bold text-base">{selection.label}</Text>
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-gray-400 text-sm">
                {formatOdds(selection.odds)} · {selection.betType} · {selection.bookmakerKey}
              </Text>
              {payout && (
                <Text className="text-gray-400 text-xs">
                  ${payout} per $100
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Track bet CTA */}
        <Pressable
          className={`mt-4 rounded-xl py-4 items-center ${
            selection ? "bg-green-500" : "bg-gray-800"
          }`}
          onPress={handleTrackBet}
          disabled={!selection || isPending}
        >
          <Text
            className={`font-bold text-base ${
              selection ? "text-white" : "text-gray-600"
            }`}
          >
            {selection ? "Track This Bet" : "Select a Line Above"}
          </Text>
        </Pressable>

        <Text className="text-gray-600 text-xs text-center mt-4 px-4">
          NoGame may earn a commission when you open a sportsbook via our links.
          This does not affect the odds shown.
        </Text>
      </View>

      <AddBetSheet
        visible={showAddSheet}
        draft={
          selection
            ? {
                game_id: id!,
                game_description: `${gameData.away_team} @ ${gameData.home_team}`,
                sport: sportLabel,
                bet_type: selection.betType,
                selection: selection.label,
                bookmaker_key: selection.bookmakerKey,
                odds: selection.odds,
              }
            : undefined
        }
        onClose={() => setShowAddSheet(false)}
        onConfirm={(bet) => {
          addBet(bet, {
            onSuccess: () => setShowAddSheet(false),
            onError: (e) => Alert.alert("Error", e.message),
          });
        }}
      />
    </ScrollView>
  );
}

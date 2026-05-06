import { ScrollView, Pressable, Text, View } from "react-native";
import { SPORTS, ALL_SPORTS_KEY } from "../../constants/sports";

type Props = {
  selected: string;
  onChange: (key: string) => void;
};

export function SportFilterBar({ selected, onChange }: Props) {
  const chips = [{ key: ALL_SPORTS_KEY, short: "All", emoji: "🏆" }, ...SPORTS];

  return (
    <View className="border-b border-gray-700">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {chips.map((sport) => {
          const active = selected === sport.key;
          return (
            <Pressable
              key={sport.key}
              onPress={() => onChange(sport.key)}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${
                active
                  ? "bg-green-500 border-green-500"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <Text className="text-sm">{sport.emoji}</Text>
              <Text className={`text-sm font-medium ${active ? "text-white" : "text-gray-400"}`}>
                {sport.short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

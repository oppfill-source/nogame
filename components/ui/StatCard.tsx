import { View, Text } from "react-native";

type Props = { label: string; value: string; sub?: string; positive?: boolean };

export function StatCard({ label, value, sub, positive }: Props) {
  return (
    <View className="bg-gray-900 rounded-xl p-4 flex-1 border border-gray-800">
      <Text className="text-gray-400 text-xs mb-1">{label}</Text>
      <Text
        className={`text-2xl font-bold ${
          positive === undefined ? "text-white" : positive ? "text-green-400" : "text-red-400"
        }`}
      >
        {value}
      </Text>
      {sub && <Text className="text-gray-500 text-xs mt-1">{sub}</Text>}
    </View>
  );
}

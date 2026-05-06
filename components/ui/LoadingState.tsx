import { View, ActivityIndicator, Text } from "react-native";

type Props = { message?: string };

export function LoadingState({ message }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size="large" color="#22C55E" />
      {message && <Text className="text-gray-400 text-sm">{message}</Text>}
    </View>
  );
}

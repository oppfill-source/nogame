import { View, Text, Pressable } from "react-native";

type Props = { message?: string; onRetry?: () => void };

export function ErrorState({ message = "Something went wrong", onRetry }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-red-400 text-4xl">⚠️</Text>
      <Text className="text-white text-lg font-semibold text-center">Oops!</Text>
      <Text className="text-gray-400 text-sm text-center">{message}</Text>
      {onRetry && (
        <Pressable className="bg-green-500 px-6 py-2 rounded-full mt-2" onPress={onRetry}>
          <Text className="text-white font-semibold">Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

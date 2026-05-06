import { View, Text } from "react-native";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "ai" | "premium";

const STYLES: Record<Variant, { bg: string; text: string }> = {
  default:  { bg: "bg-gray-700",          text: "text-gray-300" },
  success:  { bg: "bg-green-500/20",      text: "text-green-400" },
  warning:  { bg: "bg-yellow-500/20",     text: "text-yellow-400" },
  danger:   { bg: "bg-red-500/20",        text: "text-red-400" },
  info:     { bg: "bg-blue-500/20",       text: "text-blue-400" },
  ai:       { bg: "bg-indigo-500/20",     text: "text-indigo-400" },
  premium:  { bg: "bg-yellow-400/20",     text: "text-yellow-300" },
};

type Props = { label: string; variant?: Variant; size?: "xs" | "sm" };

export function Badge({ label, variant = "default", size = "sm" }: Props) {
  const s = STYLES[variant];
  return (
    <View className={`rounded ${size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5"} ${s.bg}`}>
      <Text className={`font-semibold ${size === "xs" ? "text-xs" : "text-xs"} ${s.text}`}>
        {label}
      </Text>
    </View>
  );
}

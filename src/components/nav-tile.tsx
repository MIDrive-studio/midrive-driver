import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";

type IconName = keyof typeof Feather.glyphMap;

export function NavTile({ icon, label, subtitle, href }: { icon: IconName; label: string; subtitle: string; href: Href }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-[48%] items-center rounded-xl border border-line bg-surface px-3 py-5 active:bg-surface-sunken"
    >
      <Feather name={icon} size={22} color="#1f5089" />
      <Text className="mt-2 text-sm font-semibold text-ink">{label}</Text>
      {/* Was 11px in a near-invisible grey. This is read at arm's length, in a
          yard, often in sunlight. */}
      <Text className="mt-0.5 text-center text-xs text-ink-subtle">{subtitle}</Text>
    </Pressable>
  );
}

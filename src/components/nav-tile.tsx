import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";

type IconName = keyof typeof Feather.glyphMap;

export function NavTile({ icon, label, subtitle, href }: { icon: IconName; label: string; subtitle: string; href: Href }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(href)} className="w-[48%] items-center rounded-xl border border-slate-200 bg-white px-3 py-5 active:bg-slate-50">
      <Feather name={icon} size={22} color="#475569" />
      <Text className="mt-2 text-xs font-bold text-slate-900">{label}</Text>
      <Text className="mt-0.5 text-center text-[11px] text-slate-400">{subtitle}</Text>
    </Pressable>
  );
}

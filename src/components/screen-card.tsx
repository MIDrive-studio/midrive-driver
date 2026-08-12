import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

export function ScreenCard({ title, subtitle, href }: { title: string; subtitle: string; href: "/(tabs)/availability" | "/(tabs)/payroll" | "/(tabs)/performance" }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(href)} className="mb-3 rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50">
      <Text className="text-base font-semibold text-slate-900">{title}</Text>
      <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text>
    </Pressable>
  );
}

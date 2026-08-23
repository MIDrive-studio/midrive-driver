import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { AvailabilityStatusResponse } from "@/types/availability";

export function HomeAvailabilityTile() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "none" | "action_required" | "submitted">("loading");

  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke<AvailabilityStatusResponse>("availability-status").then(({ data }) => {
      if (cancelled) return;
      const result = data?.data;
      if (!result?.activeRequest) {
        setState("none");
        return;
      }
      const hasSubmittedAll = result.mySubmissions.length > 0;
      setState(hasSubmittedAll ? "submitted" : "action_required");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "action_required") {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/availability")}
        accessibilityRole="button"
        accessibilityLabel="Availability, action required"
        className="w-[48%] items-center rounded-xl border border-warn-line bg-warn-surface px-3 py-5 active:bg-amber-100"
      >
        <View className="relative">
          <Feather name="calendar" size={22} color="#b45309" />
          <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-warn" />
        </View>
        <Text className="mt-2 text-sm font-semibold text-warn-strong">Availability</Text>
        <Text className="mt-0.5 text-xs font-medium text-warn">Needs your answer</Text>
      </Pressable>
    );
  }

  if (state === "submitted") {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/availability")}
        accessibilityRole="button"
        accessibilityLabel="Availability, submitted"
        className="w-[48%] items-center rounded-xl border border-ok-line bg-ok-surface px-3 py-5 active:bg-emerald-100"
      >
        <Feather name="check-circle" size={22} color="#047857" />
        <Text className="mt-2 text-sm font-semibold text-ok-strong">Availability</Text>
        <Text className="mt-0.5 text-xs text-ok">Submitted</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/availability")}
      accessibilityRole="button"
      accessibilityLabel="Availability"
      className="w-[48%] items-center rounded-xl border border-line bg-surface px-3 py-5 active:bg-surface-sunken"
    >
      <Feather name="calendar" size={22} color="#1f5089" />
      <Text className="mt-2 text-sm font-semibold text-ink">Availability</Text>
      <Text className="mt-0.5 text-center text-xs text-ink-subtle">
        {state === "loading" ? " " : "Nothing to answer"}
      </Text>
    </Pressable>
  );
}

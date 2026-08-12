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
      <Pressable onPress={() => router.push("/(tabs)/availability")} className="w-[48%] items-center rounded-xl border-2 border-red-400 bg-red-50 px-3 py-5">
        <View className="relative">
          <Feather name="calendar" size={22} color="#991b1b" />
          <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-red-500" />
        </View>
        <Text className="mt-2 text-xs font-bold text-red-800">Availability</Text>
        <Text className="mt-0.5 text-[11px] font-medium text-red-600">Action Required</Text>
      </Pressable>
    );
  }

  if (state === "submitted") {
    return (
      <Pressable onPress={() => router.push("/(tabs)/availability")} className="w-[48%] items-center rounded-xl border-2 border-green-300 bg-green-50 px-3 py-5">
        <Feather name="calendar" size={22} color="#166534" />
        <Text className="mt-2 text-xs font-bold text-green-800">Availability</Text>
        <Text className="mt-0.5 text-[11px] text-green-600">Submitted ✓</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => router.push("/(tabs)/availability")} className="w-[48%] items-center rounded-xl border border-slate-200 bg-white px-3 py-5">
      <Feather name="calendar" size={22} color="#475569" />
      <Text className="mt-2 text-xs font-bold text-slate-900">Availability</Text>
      <Text className="mt-0.5 text-[11px] text-slate-400">{state === "loading" ? " " : "No active request"}</Text>
    </Pressable>
  );
}

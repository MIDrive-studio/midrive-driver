import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { availabilityState, availabilityWords, type AvailabilityState } from "@/lib/availability-state";
import type { AvailabilityStatusResponse } from "@/types/availability";

// Whether the office is waiting on this driver for next week's rota.
//
// It used to read `mySubmissions.length > 0` and call that submitted, which is
// true of a driver who answered a different request months ago. A new request
// would arrive and this tile sat there green saying Submitted, over a question
// nobody had answered. lib/availability-state.ts now counts the days of THIS
// request, by id.
//
// Reloaded on focus rather than only on mount: answering the request and coming
// back should not leave a stale amber tile, and a request that arrives while
// the app is open is picked up the next time the driver lands here.

export function HomeAvailabilityTile() {
  const router = useRouter();
  const [state, setState] = useState<AvailabilityState | "loading">("loading");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      supabase.functions
        .invoke<AvailabilityStatusResponse>("availability-status")
        .then(({ data }) => {
          if (cancelled) return;
          const result = data?.data;
          setState(availabilityState(result?.activeRequest, result?.mySubmissions));
        })
        .catch(() => {
          // A tile that cannot load says nothing rather than guessing, because
          // guessing here means telling somebody they have nothing to answer.
          if (!cancelled) setState("loading");
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (state === "loading") {
    return (
      <View className="w-[48%] items-center rounded-xl border border-line bg-surface px-3 py-5">
        <Feather name="calendar" size={22} color="#94a3b8" />
        <Text className="mt-2 text-sm font-semibold text-ink-subtle">Availability</Text>
        <Text className="mt-0.5 text-xs text-ink-faint"> </Text>
      </View>
    );
  }

  const words = availabilityWords(state);

  if (state.kind === "outstanding") {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/availability")}
        accessibilityRole="button"
        accessibilityLabel={`Availability, ${words.detail}`}
        className="w-[48%] items-center rounded-xl border-2 border-warn bg-warn-surface px-3 py-5 active:bg-amber-100"
      >
        <View className="relative">
          <Feather name="calendar" size={22} color="#b45309" />
          {/* A dot, not a decoration: this is the only thing on the home screen
              that says somebody is waiting on the driver. */}
          <View className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-red-600" />
        </View>
        <Text className="mt-2 text-sm font-bold text-warn-strong">Availability</Text>
        <Text className="mt-0.5 text-center text-xs font-semibold text-warn">{words.detail}</Text>
      </Pressable>
    );
  }

  if (state.kind === "answered") {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/availability")}
        accessibilityRole="button"
        accessibilityLabel="Availability, answered"
        className="w-[48%] items-center rounded-xl border border-ok-line bg-ok-surface px-3 py-5 active:bg-emerald-100"
      >
        <Feather name="check-circle" size={22} color="#047857" />
        <Text className="mt-2 text-sm font-semibold text-ok-strong">Availability</Text>
        <Text className="mt-0.5 text-xs text-ok">{words.detail}</Text>
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
      <Text className="mt-0.5 text-center text-xs text-ink-subtle">{words.detail}</Text>
    </Pressable>
  );
}

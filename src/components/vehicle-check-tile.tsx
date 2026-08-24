import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { checksForDate, isSubmitted, type CompletedCheck } from "@/lib/inspection";
import { todayISODate } from "@/lib/dates";

// The first thing a driver does in the morning, so it sits above everything
// else on the home screen and says whether it is still outstanding.
//
// Three states rather than two, and the middle one is the point. Outstanding,
// it is marine and unmissable. Part-done, it offers to pick up where they left
// off. Done, it collapses into a log of what was handed in and when -- because
// a driver who has already done the check should see the check, with a time
// against it, not a button asking them to do it again.
//
// Reloaded on focus rather than only on mount. Coming back from the walk-around
// is exactly the moment this has to be right, and a tile that still said
// "Vehicle check" after one had just been submitted was the single most
// confusing thing on the screen.

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const RESULT: Record<string, string> = {
  analysed: "No new damage",
  approved: "Checked and approved",
  requires_review: "With the office",
  rejected: "Needs doing again",
  submitted: "Being checked",
  processing: "Being checked",
};

export function VehicleCheckTile() {
  const router = useRouter();
  const [checks, setChecks] = useState<CompletedCheck[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        try {
          const rows = await checksForDate(todayISODate());
          if (!cancelled) setChecks(rows);
        } catch {
          // A tile that cannot load is a tile that shows nothing. It must never
          // be the reason the home screen fails to render.
          if (!cancelled) setChecks([]);
        }
      }

      load();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (checks === null) return null;

  const done = checks.filter(isSubmitted);
  const inProgress = checks.find((check) => check.status === "in_progress");

  // Nothing today: the plain prompt.
  if (done.length === 0) {
    return (
      <Pressable
        onPress={() => router.push("/vehicle-check")}
        accessibilityRole="button"
        accessibilityLabel={inProgress ? "Finish your vehicle check" : "Start your vehicle check"}
        className="mb-4 flex-row items-center gap-3 rounded-xl border border-marine-200 bg-marine-600 px-4 py-4 active:bg-marine-700"
      >
        <Feather name="camera" size={22} color="#ffffff" />

        <View className="flex-1">
          <Text className="text-base font-bold text-white">
            {inProgress ? "Finish your vehicle check" : "Vehicle check"}
          </Text>
          <Text className="mt-0.5 text-xs text-marine-100">
            {inProgress
              ? "You started one earlier — pick up where you left off"
              : "Nine photos of your van before you set off"}
          </Text>
        </View>

        <Feather name="chevron-right" size={20} color="#ffffff" />
      </Pressable>
    );
  }

  // Done: the log, and a quiet way to do another.
  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-ok-line bg-surface">
      <View className="flex-row items-center gap-2 bg-ok-surface px-4 py-2.5">
        <Feather name="check-circle" size={16} color="#047857" />
        <Text className="flex-1 text-sm font-bold text-ok-strong">
          {done.length === 1 ? "Vehicle check done" : `${done.length} vehicle checks done`}
        </Text>
      </View>

      {done.map((check) => (
        <View key={check.id} className="flex-row items-center gap-3 border-t border-line px-4 py-3">
          <Feather name="truck" size={15} color="#64748b" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink">{check.van_registration}</Text>
            <Text className="text-xs text-ink-subtle">
              {check.submitted_at ? formatTime(check.submitted_at) : "Earlier today"}
              {" · "}
              {RESULT[check.status] ?? "Recorded"}
            </Text>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => router.push("/vehicle-check")}
        accessibilityRole="button"
        accessibilityLabel={inProgress ? "Finish your other vehicle check" : "Check another van"}
        className="flex-row items-center gap-2 border-t border-line px-4 py-3 active:bg-surface-sunken"
      >
        <Feather name={inProgress ? "camera" : "plus-circle"} size={15} color="#1f5089" />
        <Text className="flex-1 text-sm font-semibold text-marine-700">
          {inProgress ? "Finish your other check" : "Check another van"}
        </Text>
        <Feather name="chevron-right" size={16} color="#1f5089" />
      </Pressable>
    </View>
  );
}

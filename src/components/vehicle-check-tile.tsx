import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/dates";

// The first thing a driver does in the morning, so it sits above everything
// else on the home screen and states whether it is still outstanding.
//
// Two states, and the difference between them is the whole point. Outstanding,
// it is marine and unmissable. Done, it collapses to a quiet green line -- the
// same restraint the accident tile was given, and for the same reason: a
// prompt that looks urgent on the days it has already been dealt with stops
// being read on the days it has not.

type Today = { id: string; status: string } | null;

const DONE_STATUSES = ["submitted", "processing", "analysed", "requires_review", "approved"];

export function VehicleCheckTile() {
  const router = useRouter();
  const [today, setToday] = useState<Today>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Their own check, through the driver policy. No permission on the fleet is
    // involved and none is needed.
    const { data } = await supabase
      .from("vehicle_inspections")
      .select("id, status")
      .eq("date", todayISODate())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setToday((data as Today) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  if (loading) return null;

  const complete = today ? DONE_STATUSES.includes(today.status) : false;
  const resumable = today?.status === "in_progress";

  if (complete) {
    return (
      <View className="mb-4 flex-row items-center gap-3 rounded-xl border border-ok-line bg-ok-surface px-4 py-3">
        <Feather name="check-circle" size={18} color="#047857" />
        <Text className="flex-1 text-sm font-semibold text-ok-strong">Vehicle check done for today</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push("/vehicle-check")}
      accessibilityRole="button"
      accessibilityLabel={resumable ? "Finish your vehicle check" : "Start your vehicle check"}
      className="mb-4 flex-row items-center gap-3 rounded-xl border border-marine-200 bg-marine-600 px-4 py-4 active:bg-marine-700"
    >
      <Feather name="camera" size={22} color="#ffffff" />

      <View className="flex-1">
        <Text className="text-base font-bold text-white">
          {resumable ? "Finish your vehicle check" : "Vehicle check"}
        </Text>
        <Text className="mt-0.5 text-xs text-marine-100">
          {resumable
            ? "You started one earlier — pick up where you left off"
            : "Eight photos of your van before you set off"}
        </Text>
      </View>

      <Feather name="chevron-right" size={20} color="#ffffff" />
    </Pressable>
  );
}

import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/dates";
import { useWorkingSite } from "@/lib/working-site";

// What the driver is doing today.
//
// The home screen opened on a greeting, a profile-completion card and three
// navigation tiles -- none of which answer the only question anyone opens this
// app in the morning to ask. Route, van and depot were all already in the
// database and reachable from here; the screen simply never showed them.
//
// Everything comes from one row: rota_assignments holds the route and the
// shift, and carries vehicle_id since the van assignment work, so the van comes
// back on the same query rather than a second round trip on a phone signal.

type Assignment = {
  route: string | null;
  shift: string | null;
  notes: string | null;
  vehicle: { registration: string } | null;
};

// Amazon shifts do not carry a clock time on the rota, so the wave is named
// rather than invented -- a made-up start time is worse than none.
const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning wave",
  afternoon: "Afternoon wave",
  evening: "Evening wave",
  night: "Night wave",
};

function Detail({ icon, label, value, muted }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; muted?: boolean }) {
  return (
    <View className="flex-1 flex-row items-start gap-2">
      <Feather name={icon} size={15} color={muted ? "#94a3b8" : "#1f5089"} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-xs text-ink-subtle">{label}</Text>
        <Text className={`text-base font-semibold ${muted ? "text-ink-faint" : "text-ink"}`} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function TodayCard({ driverId }: { driverId: string }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const { site } = useWorkingSite(driverId);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("rota_assignments")
        .select("route, shift, notes, vehicle:vehicles(registration)")
        .eq("driver_id", driverId)
        .eq("date", todayISODate())
        .maybeSingle();

      if (cancelled) return;

      // PostgREST embeds a to-one relation as an object; the generated types
      // describe every embed as an array. Normalised so the card does not care.
      const row = data as (Omit<Assignment, "vehicle"> & { vehicle: { registration: string }[] | { registration: string } | null }) | null;
      setAssignment(
        row
          ? { ...row, vehicle: Array.isArray(row.vehicle) ? (row.vehicle[0] ?? null) : (row.vehicle ?? null) }
          : null
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  if (loading) {
    return (
      <View className="mb-4 items-center rounded-xl border border-line bg-surface p-6">
        <ActivityIndicator color="#1f5089" />
      </View>
    );
  }

  // A rest day is a real answer, and a better one than an empty card.
  if (!assignment) {
    return (
      <View className="mb-4 rounded-xl border border-line bg-surface p-5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Today</Text>
        <Text className="mt-1.5 text-lg font-bold text-ink">No route assigned</Text>
        <Text className="mt-1 text-sm text-ink-subtle">
          Nothing is on the rota for you today. If you were expecting a route, speak to your site manager.
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-marine-200 bg-surface">
      <View className="flex-row items-center justify-between bg-marine-600 px-4 py-2.5">
        <Text className="text-xs font-bold uppercase tracking-wide text-white">Today</Text>
        {site?.site_name && (
          <Text className="text-xs font-medium text-marine-100">
            {site.site_name}
            {site.on_loan ? " · on loan" : ""}
          </Text>
        )}
      </View>

      <View className="gap-4 p-4">
        <View className="flex-row gap-3">
          <Detail
            icon="map"
            label="Route"
            value={assignment.route || "Not set"}
            muted={!assignment.route}
          />
          <Detail
            icon="truck"
            label="Van"
            value={assignment.vehicle?.registration ?? "Not assigned"}
            muted={!assignment.vehicle}
          />
        </View>

        <Detail
          icon="clock"
          label="Shift"
          value={assignment.shift ? (SHIFT_LABELS[assignment.shift] ?? assignment.shift) : "Not set"}
          muted={!assignment.shift}
        />

        {assignment.notes && (
          <View className="flex-row items-start gap-2 rounded-lg border border-warn-line bg-warn-surface p-3">
            <Feather name="alert-circle" size={15} color="#b45309" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-sm text-warn-strong">{assignment.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { todayISODate } from "@/lib/dates";
import { assignedVehicleId, startInspection, vehicleCheckContext } from "@/lib/inspection";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { VanOutline } from "@/components/van-outline";
import type { VehicleCheckContext } from "@/types/inspection";

// Confirm the van, then start.
//
// The driver is told which vehicle this is rather than asked. They are standing
// in front of it, the rota already knows which one they were given, and a
// registration typed by someone in a hurry is the single most likely place for
// a whole day's photographs to be filed against the wrong van.
//
// Mileage is the one thing asked for, because it is the one thing only the
// person in the cab can read.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const LAST_RESULT: Record<string, { text: string; tone: "ok" | "warn" | "muted" }> = {
  analysed: { text: "No new damage", tone: "ok" },
  approved: { text: "Checked and approved", tone: "ok" },
  requires_review: { text: "With the office", tone: "warn" },
  rejected: { text: "Rejected — redo needed", tone: "warn" },
  submitted: { text: "Still being checked", tone: "muted" },
  processing: { text: "Still being checked", tone: "muted" },
};

export default function VehicleCheckStart() {
  const router = useRouter();
  const { driver } = useAuth();
  const { begin } = useVehicleCheck();

  const [context, setContext] = useState<VehicleCheckContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mileage, setMileage] = useState("");
  const [starting, setStarting] = useState(false);

  const today = todayISODate();

  const load = useCallback(async () => {
    try {
      const vehicleId = await assignedVehicleId(today);

      if (!vehicleId) {
        setContext(null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await vehicleCheckContext(vehicleId, today);
      setContext(result);
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    }

    setLoading(false);
  }, [today]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  async function start() {
    if (!context || !driver) return;

    setStarting(true);
    setError(null);

    try {
      const mileageValue = mileage.trim() === "" ? null : Number(mileage.replace(/[^\d]/g, ""));
      const inspectionId = await startInspection(context.vehicle_id, today, mileageValue);

      begin(inspectionId, context);
      router.push("/vehicle-check/capture");
    } catch (startError) {
      setError((startError as Error).message);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#1f5089" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <Feather name="arrow-left" size={20} color="#475569" />
        </Pressable>
        <Text className="text-xl font-bold text-ink">Vehicle check</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 pt-2">
        {error && (
          <View className="mb-4 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
          </View>
        )}

        {!context ? (
          <View className="items-center rounded-xl border border-line bg-surface px-5 py-10">
            <Feather name="truck" size={28} color="#94a3b8" />
            <Text className="mt-3 text-center text-base font-semibold text-ink">No van assigned today</Text>
            <Text className="mt-1 text-center text-sm text-ink-subtle">
              The rota has not got a van against your name for {formatDate(today)}. Speak to your manager, then pull
              down to try again.
            </Text>
            <Pressable
              onPress={load}
              accessibilityRole="button"
              className="mt-5 rounded-lg border border-line-strong px-4 py-2.5 active:bg-surface-sunken"
            >
              <Text className="text-sm font-semibold text-ink">Check again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="overflow-hidden rounded-xl border border-line bg-surface">
              {/* The van, drawn rather than photographed. A stock photograph of
                  someone else's Transit would be decoration; this is the same
                  outline they are about to line the real one up with. */}
              <View className="items-center bg-marine-900 py-4">
                <View className="h-28 w-full">
                  <VanOutline shape="three_quarter_front" colour="#82aee1" strokeWidth={7} opacity={0.9} />
                </View>
              </View>

              <View className="px-5 py-4">
                <Text className="text-3xl font-bold tracking-tight text-ink">{context.registration}</Text>
                <Text className="mt-0.5 text-sm text-ink-subtle">
                  {[context.colour, context.make, context.model].filter(Boolean).join(" ") || "Panel van"}
                </Text>

                <View className="mt-4 gap-3 border-t border-line pt-4">
                  <Row icon="user" label="Driver" value={driver?.full_name ?? "You"} />
                  <Row
                    icon="calendar"
                    label="Last checked"
                    value={
                      context.last_inspection
                        ? `${formatDate(context.last_inspection.date)}${
                            context.last_inspection.driver_name ? ` by ${context.last_inspection.driver_name}` : ""
                          }`
                        : "Never — this is the first check"
                    }
                  />
                  <Row
                    icon="shield"
                    label="Last result"
                    value={
                      context.last_inspection
                        ? (LAST_RESULT[context.last_inspection.status]?.text ?? "Recorded")
                        : "Nothing on record yet"
                    }
                    tone={context.last_inspection ? LAST_RESULT[context.last_inspection.status]?.tone : "muted"}
                  />
                  {context.open_damage_count > 0 && (
                    <Row
                      icon="alert-circle"
                      label="Already recorded"
                      value={`${context.open_damage_count} existing ${
                        context.open_damage_count === 1 ? "mark" : "marks"
                      } on this van`}
                      tone="muted"
                    />
                  )}
                </View>
              </View>
            </View>

            <View className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
              <Text className="text-sm font-semibold text-ink">Mileage</Text>
              <Text className="mt-0.5 text-xs text-ink-subtle">
                Read it off the dash. {context.mileage ? `Last recorded ${context.mileage.toLocaleString()}.` : ""}
              </Text>
              <TextInput
                value={mileage}
                onChangeText={setMileage}
                keyboardType="number-pad"
                placeholder={context.mileage ? String(context.mileage) : "e.g. 84291"}
                placeholderTextColor="#94a3b8"
                accessibilityLabel="Current mileage"
                className="mt-3 rounded-lg border border-line-strong bg-surface px-4 py-3 text-lg font-semibold text-ink"
              />
            </View>

            <View className="mt-4 rounded-xl border border-marine-200 bg-marine-50 px-4 py-3.5">
              <Text className="text-sm font-semibold text-marine-800">Eight photographs, one lap of the van</Text>
              <Text className="mt-1 text-xs leading-5 text-marine-700">
                An outline of a van appears over the camera at each corner. Stand back until the real van sits inside
                it, then take the photograph. Taking them the same way each day is what lets the office tell new damage
                from marks that were already there.
              </Text>
            </View>

            <Pressable
              onPress={start}
              disabled={starting}
              accessibilityRole="button"
              accessibilityLabel="Start vehicle check"
              className={`mt-5 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4 ${
                starting ? "bg-marine-300" : "bg-marine-600 active:bg-marine-700"
              }`}
            >
              {starting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Feather name="camera" size={18} color="#ffffff" />
              )}
              <Text className="text-base font-bold text-white">
                {starting ? "Starting…" : "Start vehicle check"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "muted";
}) {
  const colour = tone === "ok" ? "#047857" : tone === "warn" ? "#b45309" : tone === "muted" ? "#64748b" : "#0f172a";

  return (
    <View className="flex-row items-start gap-3">
      <Feather name={icon} size={16} color="#1f5089" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-xs text-ink-subtle">{label}</Text>
        <Text className="text-base font-semibold" style={{ color: colour }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

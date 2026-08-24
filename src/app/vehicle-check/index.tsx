import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { todayISODate } from "@/lib/dates";
import {
  assignedVehicleId,
  checksForDate,
  isSubmitted,
  lookupVehicle,
  startInspection,
  vehicleCheckContext,
  type CompletedCheck,
} from "@/lib/inspection";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { VanOutline } from "@/components/van-outline";
import type { VehicleCheckContext } from "@/types/inspection";

// The hub for the day's vehicle checks.
//
// Two things this screen has to get right, both learned the hard way.
//
// It never pretends nothing has happened. A driver who has already done a check
// this morning sees it, with the time they submitted it, before anything else.
// Sending them straight back to "Start vehicle check" made a completed job look
// like an outstanding one, which is the single worst thing a screen like this
// can do.
//
// And the assigned van is a suggestion, not a fact. The rota says which van
// they were given; what they actually drove is whatever was serviceable at
// seven in the morning. So the van is a question with a real second answer,
// rather than something to be corrected by an administrator afterwards.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const LAST_RESULT: Record<string, { text: string; tone: "ok" | "warn" | "muted" }> = {
  analysed: { text: "No new damage", tone: "ok" },
  approved: { text: "Checked and approved", tone: "ok" },
  requires_review: { text: "With the office", tone: "warn" },
  rejected: { text: "Rejected — redo needed", tone: "warn" },
  submitted: { text: "Still being checked", tone: "muted" },
  processing: { text: "Still being checked", tone: "muted" },
};

type Stage = "loading" | "confirm" | "manual";

export default function VehicleCheckStart() {
  const router = useRouter();
  const { driver } = useAuth();
  const { begin } = useVehicleCheck();

  const [stage, setStage] = useState<Stage>("loading");
  const [context, setContext] = useState<VehicleCheckContext | null>(null);
  const [rosteredId, setRosteredId] = useState<string | null>(null);
  const [todaysChecks, setTodaysChecks] = useState<CompletedCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mileage, setMileage] = useState("");
  const [starting, setStarting] = useState(false);

  // Manual registration entry
  const [registration, setRegistration] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const today = todayISODate();

  const load = useCallback(async () => {
    try {
      const [vehicleId, checks] = await Promise.all([assignedVehicleId(today), checksForDate(today)]);

      setTodaysChecks(checks.filter(isSubmitted));
      setRosteredId(vehicleId);
      setContext(vehicleId ? await vehicleCheckContext(vehicleId, today) : null);
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    }

    setStage((current) => (current === "loading" ? "confirm" : current));
  }, [today]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  async function findVan() {
    const typed = registration.trim();

    if (typed.length < 3) {
      setLookupError("Type the registration as it appears on the plate.");
      return;
    }

    setLookingUp(true);
    setLookupError(null);

    try {
      const found = await lookupVehicle(typed);

      if (!found) {
        setLookupError(`No van on the fleet with the registration ${typed.toUpperCase()}. Check the plate and try again.`);
      } else {
        setContext(found);
        setMileage("");
        setStage("confirm");
      }
    } catch (findError) {
      setLookupError((findError as Error).message);
    }

    setLookingUp(false);
  }

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

  if (stage === "loading") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#1f5089" />
      </SafeAreaView>
    );
  }

  const isSwap = context !== null && rosteredId !== null && context.vehicle_id !== rosteredId;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-3">
        <Pressable
          onPress={() => (stage === "manual" ? setStage("confirm") : router.back())}
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

        {/* Done first. A driver who has already handed one in this morning sees
            that before they see a button asking them to do it again. */}
        {todaysChecks.length > 0 && (
          <View className="mb-4 overflow-hidden rounded-xl border border-ok-line bg-surface">
            <View className="flex-row items-center gap-2 border-b border-ok-line bg-ok-surface px-4 py-2.5">
              <Feather name="check-circle" size={16} color="#047857" />
              <Text className="text-sm font-bold text-ok-strong">
                {todaysChecks.length === 1 ? "Done today" : `${todaysChecks.length} done today`}
              </Text>
            </View>

            {todaysChecks.map((check) => (
              <View key={check.id} className="flex-row items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <Feather name="truck" size={15} color="#64748b" />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">{check.van_registration}</Text>
                  <Text className="text-xs text-ink-subtle">
                    Submitted {check.submitted_at ? formatTime(check.submitted_at) : "earlier"}
                    {" · "}
                    {LAST_RESULT[check.status]?.text ?? "Recorded"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {stage === "manual" ? (
          <View className="rounded-xl border border-line bg-surface px-5 py-5">
            <Text className="text-base font-bold text-ink">Which van are you checking?</Text>
            <Text className="mt-1 text-sm leading-5 text-ink-subtle">
              Type the registration exactly as it appears on the plate. Spaces do not matter.
            </Text>

            <TextInput
              value={registration}
              onChangeText={(value) => {
                setRegistration(value.toUpperCase());
                setLookupError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. FJ23 WFL"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Vehicle registration"
              className="mt-4 rounded-lg border border-line-strong bg-surface px-4 py-3.5 text-center text-2xl font-bold tracking-widest text-ink"
            />

            {lookupError && <Text className="mt-2 text-sm text-bad-strong">{lookupError}</Text>}

            <Pressable
              onPress={findVan}
              disabled={lookingUp}
              accessibilityRole="button"
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4 ${
                lookingUp ? "bg-marine-300" : "bg-marine-600 active:bg-marine-700"
              }`}
            >
              {lookingUp && <ActivityIndicator color="#ffffff" />}
              <Text className="text-base font-bold text-white">{lookingUp ? "Looking…" : "Find this van"}</Text>
            </Pressable>

            {rosteredId && (
              <Pressable onPress={() => setStage("confirm")} accessibilityRole="button" className="mt-2 items-center py-3">
                <Text className="text-sm font-semibold text-marine-700">Back to my rostered van</Text>
              </Pressable>
            )}
          </View>
        ) : !context ? (
          <View className="items-center rounded-xl border border-line bg-surface px-5 py-8">
            <Feather name="truck" size={28} color="#94a3b8" />
            <Text className="mt-3 text-center text-base font-semibold text-ink">No van assigned today</Text>
            <Text className="mt-1 text-center text-sm leading-5 text-ink-subtle">
              The rota has not got a van against your name for {formatDate(today)}. If you have been given one, enter
              its registration.
            </Text>
            <Pressable
              onPress={() => setStage("manual")}
              accessibilityRole="button"
              className="mt-5 rounded-xl bg-marine-600 px-5 py-3.5 active:bg-marine-700"
            >
              <Text className="text-base font-bold text-white">Enter a registration</Text>
            </Pressable>
            <Pressable onPress={load} accessibilityRole="button" className="mt-2 px-4 py-3">
              <Text className="text-sm font-semibold text-marine-700">Check the rota again</Text>
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
                  <VanOutline shape="three_quarter_front" colour="#82aee1" strokeWidth={6} opacity={0.9} />
                </View>
              </View>

              <View className="px-5 py-4">
                <Text className="text-3xl font-bold tracking-tight text-ink">{context.registration}</Text>
                <Text className="mt-0.5 text-sm text-ink-subtle">
                  {[context.colour, context.make, context.model].filter(Boolean).join(" ") || "Panel van"}
                </Text>

                {isSwap && (
                  <View className="mt-3 flex-row items-start gap-2 rounded-lg border border-warn-line bg-warn-surface px-3 py-2">
                    <Feather name="repeat" size={14} color="#b45309" style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-xs leading-5 text-warn-strong">
                      This is not the van on your rota. That is fine — the office will be told which van you actually
                      checked.
                    </Text>
                  </View>
                )}

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

            {/* The question, asked plainly. Not a dropdown, not a setting -- one
                line and two answers, because the driver is standing in front of
                a van and knows the answer immediately. */}
            <View className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
              <Text className="text-base font-bold text-ink">Are you checking this van?</Text>
              <Text className="mt-0.5 text-xs text-ink-subtle">
                Say no if you have been given a different one this morning.
              </Text>

              <Pressable
                onPress={() => {
                  setRegistration("");
                  setLookupError(null);
                  setStage("manual");
                }}
                accessibilityRole="button"
                className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-line-strong px-5 py-3.5 active:bg-surface-sunken"
              >
                <Feather name="repeat" size={16} color="#475569" />
                <Text className="text-base font-semibold text-ink">No — a different van</Text>
              </Pressable>
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
              <Text className="text-sm font-semibold text-marine-800">Nine photographs, one lap of the van</Text>
              <Text className="mt-1 text-xs leading-5 text-marine-700">
                An outline appears over the camera at each corner. Stand back until the real van sits inside it, then
                take the photograph. The last one is the dashboard, from the driver&rsquo;s seat with the ignition on.
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
              {starting ? <ActivityIndicator color="#ffffff" /> : <Feather name="camera" size={18} color="#ffffff" />}
              <Text className="text-base font-bold text-white">
                {starting
                  ? "Starting…"
                  : todaysChecks.length > 0
                    ? `Check ${context.registration} as well`
                    : "Start vehicle check"}
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

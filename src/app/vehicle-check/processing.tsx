import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { inspectionProgress, type InspectionProgress } from "@/lib/inspection";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { VanOutline } from "@/components/van-outline";

// What happens after the driver presses submit.
//
// The stages below are tied to the inspection's real status rather than to a
// timer. That is the whole design decision on this screen: a stepper that
// marches through six convincing lines on a setTimeout looks better and is a
// lie, and it lies at exactly the moment it matters -- when the analysis has
// actually failed and the driver is being shown a tick beside "Comparing
// previous inspection" that never happened.
//
// So there are four stages, because four is how many distinct states the
// database can actually report, and each one is true when it is shown.
//
// The driver is never held here. Their check is submitted the moment they got
// to this screen, and Close is available from the first second.

const STAGES = [
  { key: "received", label: "Photographs received" },
  { key: "queued", label: "Queued for checking" },
  { key: "comparing", label: "Comparing with the last check" },
  { key: "done", label: "Check complete" },
] as const;

// Every three seconds for two minutes. A typical run is eight vision requests
// over sixteen photographs and lands well inside that; anything longer is a
// backlog or an outage, and neither is worth making someone watch. After that
// the screen says so and stops asking.
const POLL_MS = 3000;
const GIVE_UP_MS = 120_000;

function stageIndexFor(status: string | undefined): number {
  switch (status) {
    case "submitted":
      return 1;
    case "processing":
      return 2;
    case "analysed":
    case "requires_review":
    case "approved":
      return 3;
    default:
      return 0;
  }
}

export default function ProcessingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { vehicle, reset } = useVehicleCheck();

  const [progress, setProgress] = useState<InspectionProgress | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  const finished = progress ? ["analysed", "requires_review", "approved"].includes(progress.status) : false;

  const poll = useCallback(async () => {
    if (!id) return true;

    const result = await inspectionProgress(id);
    if (result) setProgress(result);

    return result ? ["analysed", "requires_review", "approved", "rejected"].includes(result.status) : false;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;

      const complete = await poll();
      if (cancelled || complete) return;

      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }

      timer = setTimeout(tick, POLL_MS);
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  function close() {
    reset();
    router.dismissAll();
  }

  const stage = stageIndexFor(progress?.status);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 px-6 pt-8">
        <View className="items-center">
          <View className="h-24 w-full max-w-xs">
            <VanOutline shape="side" colour={finished ? "#047857" : "#1f5089"} strokeWidth={7} opacity={0.9} />
          </View>

          <Text className="mt-5 text-center text-2xl font-bold text-ink">
            {finished ? "Vehicle check done" : "Check submitted"}
          </Text>
          <Text className="mt-1.5 text-center text-sm leading-5 text-ink-subtle">
            {finished
              ? `Your photographs of ${vehicle?.registration ?? "the van"} have been checked against the last inspection.`
              : `Your photographs of ${vehicle?.registration ?? "the van"} are safely in. You can carry on — this finishes on its own.`}
          </Text>
        </View>

        <View className="mt-8 rounded-xl border border-line bg-surface px-5 py-4">
          {STAGES.map((item, index) => {
            const complete = index < stage || finished;
            const active = index === stage && !finished && !timedOut;

            return (
              <View key={item.key} className={`flex-row items-center gap-3 ${index > 0 ? "mt-3.5" : ""}`}>
                <View className="h-6 w-6 items-center justify-center">
                  {complete ? (
                    <Feather name="check-circle" size={20} color="#047857" />
                  ) : active ? (
                    <ActivityIndicator size="small" color="#1f5089" />
                  ) : (
                    <Feather name="circle" size={18} color="#cbd5e1" />
                  )}
                </View>
                <Text
                  className={`text-sm ${
                    complete ? "font-semibold text-ink" : active ? "font-semibold text-marine-700" : "text-ink-faint"
                  }`}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* What the driver is told about the result, and no more. Whether a mark
            is new, how sure the model was, and what happens next are the
            office's business -- the driver's job was to photograph the van. */}
        {finished && (
          <View
            className={`mt-4 rounded-xl border px-4 py-3.5 ${
              progress && progress.new_damage_count > 0
                ? "border-warn-line bg-warn-surface"
                : "border-ok-line bg-ok-surface"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                progress && progress.new_damage_count > 0 ? "text-warn-strong" : "text-ok-strong"
              }`}
            >
              {progress && progress.new_damage_count > 0
                ? `${progress.new_damage_count} thing${progress.new_damage_count === 1 ? "" : "s"} passed to the office`
                : "Nothing new found"}
            </Text>
            <Text
              className={`mt-1 text-xs leading-5 ${
                progress && progress.new_damage_count > 0 ? "text-warn" : "text-ok"
              }`}
            >
              {progress && progress.new_damage_count > 0
                ? "Someone will look at the photographs and decide. You do not need to do anything."
                : "Your van looks the same as it did at the last check."}
            </Text>
          </View>
        )}

        {timedOut && !finished && (
          <View className="mt-4 rounded-xl border border-line bg-surface px-4 py-3.5">
            <Text className="text-sm font-semibold text-ink">Still going</Text>
            <Text className="mt-1 text-xs leading-5 text-ink-subtle">
              The checking is taking longer than usual. Nothing is lost — your photographs are submitted and the office
              will see the result when it finishes. Go and start your day.
            </Text>
          </View>
        )}
      </View>

      <View className="px-6 pb-8">
        <Pressable
          onPress={close}
          accessibilityRole="button"
          className="items-center rounded-xl bg-marine-600 px-5 py-4 active:bg-marine-700"
        >
          <Text className="text-base font-bold text-white">{finished ? "Done" : "Close"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

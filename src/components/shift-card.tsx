import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { isShiftActive, locationAlreadyAgreed, shiftStartedAt, shiftStoppedNotice, clearShiftStoppedNotice, startShift } from "@/lib/location";
import { startedAtLabel, workedLabel } from "@/lib/worked";
import { checksForDate, isSubmitted } from "@/lib/inspection";
import { useInspectionSync } from "@/lib/inspection-sync";
import { todayISODate } from "@/lib/dates";
import type { Driver } from "@/types/driver";

// The shift, which now begins with the vehicle check rather than with a button.
//
// There was a green Start Shift button, and it was a second thing to remember
// after the walk-around -- a driver who did the check and drove off was not on
// shift, and nobody found out until the day's hours were short. The check is
// the thing that actually marks the start of the working day, so it starts it.
//
// WHAT IS NOT AUTOMATIC
//
// Being on shift means the phone reports where it is, in the background, all
// day. That cannot begin because a form was submitted. Google requires the
// disclosure before the request, and more to the point a person is entitled to
// be asked before their employer starts following them about.
//
// So: agreed already, the shift starts quietly the moment the check is in.
// Not agreed, the card says what will happen and waits to be pressed.
//
// Ending is manual, and no longer a single tap either: end-shift.tsx asks
// about new damage first, then actually ends it (see lib/location.ts). And a
// check that has already opened a shift can't open a second one -- the
// server enforces that now, not just this screen -- so finishing a shift and
// starting another always costs a fresh walk-around.

/**
 * The prominent disclosure, shown before the system asks for background
 * location.
 *
 * Google requires this and reviews the wording: it has to name what is
 * collected, what it is used for, and that collection continues when the app is
 * closed or not in use. Missing or vague disclosure is the most common reason a
 * background-location app is rejected.
 */
function askForDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Sharing your location on shift",
      "MiDrive DA collects your location and shares it with your dispatch team so they can see " +
        "where the fleet is during the working day.\n\n" +
        "This continues in the background, even when the app is closed or not in use.\n\n" +
        "It starts when your shift starts and stops the moment you end it. It is not collected at " +
        "any other time.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

type ReadyCheck = { inspectionId: string; vehicleId: string; registration: string };

export function ShiftCard({ driver }: { driver: Driver }) {
  const router = useRouter();
  const { completeCheckFor } = useInspectionSync();
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [readyCheck, setReadyCheck] = useState<ReadyCheck | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [stoppedNotice, setStoppedNotice] = useState<string | null>(null);

  // Re-rendered each minute so the timer moves. A second-by-second clock on a
  // screen nobody is watching is battery spent for nothing.
  const [, setTick] = useState(0);

  // Keyed to a specific check, not "has this ever run" -- a driver who does a
  // second check later in the same app session (no restart in between) must
  // get the same no-button start the first check got, not a silent fall-back
  // to a manual press.
  const autoStartedFor = useRef<string | null>(null);
  // Which check the current `error` is about, so a stale rejection from a
  // check that's since been superseded by a fresh one doesn't keep the "do
  // another check" card showing once there's a check it no longer applies to.
  const erroredCheckId = useRef<string | null>(null);

  const begin = useCallback(
    async (check: ReadyCheck, withDisclosure: boolean) => {
      setError(null);
      setPermissionDenied(false);
      setBusy(true);

      const result = await startShift(
        {
          driverId: driver.id,
          companyId: driver.company_id,
          siteId: driver.site_id,
          inspectionId: check.inspectionId,
          vehicleId: check.vehicleId,
          registration: check.registration,
        },
        withDisclosure ? askForDisclosure : async () => true
      );

      setBusy(false);

      if (result.ok) {
        erroredCheckId.current = null;
        setActive(true);
        setStartedAt(await shiftStartedAt());
        return;
      }

      // An empty reason means they declined the explanation, which needs no
      // error shown back at them -- they know what they chose.
      erroredCheckId.current = check.inspectionId;
      setError(result.reason || null);
      setPermissionDenied(result.needsSettings);
    },
    [driver.company_id, driver.id, driver.site_id]
  );

  // Read on focus rather than on mount, because the moment this has to be right
  // is the moment the driver comes back from submitting a walk-around.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function read() {
        const today = todayISODate();

        const [on, started, checks, notice] = await Promise.all([
          isShiftActive(),
          shiftStartedAt(),
          checksForDate(today).catch(() => []),
          shiftStoppedNotice(),
        ]);
        if (cancelled) return;

        if (notice) {
          setStoppedNotice(notice);
          await clearShiftStoppedNotice();
        }

        // A check the server has confirmed wins, since starting against it
        // can be enforced immediately rather than left to reconcile later.
        // Failing that, one finished on the phone but still making its way
        // there (poor signal on the walk-around) means the same thing to a
        // driver standing in the yard: done, go. See lib/inspection-sync.ts.
        const confirmed = checks.find(isSubmitted);
        const check: ReadyCheck | null = confirmed
          ? { inspectionId: confirmed.id, vehicleId: confirmed.vehicle_id, registration: confirmed.van_registration }
          : completeCheckFor(today);

        setActive(on);
        setStartedAt(started);

        // A rejection from an earlier check (e.g. a stale "Start your shift"
        // press landing on a check that's since been spent) must not keep
        // haunting a later, genuinely fresh check -- only still show it while
        // it's still about the check actually on screen.
        if (erroredCheckId.current && check?.inspectionId !== erroredCheckId.current) {
          erroredCheckId.current = null;
          setError(null);
          setPermissionDenied(false);
        }

        setReadyCheck(check);
        setReady(true);

        // The automatic start. Per check, not per app run -- a driver who
        // does a second check later in the same session must get the same
        // no-button start the first check got. Only after a check is in, and
        // only where location has already been agreed to.
        if (!on && check && autoStartedFor.current !== check.inspectionId) {
          autoStartedFor.current = check.inspectionId;
          if (await locationAlreadyAgreed()) {
            if (!cancelled) await begin(check, false);
          }
        }
      }

      void read();

      return () => {
        cancelled = true;
      };
    }, [begin, completeCheckFor])
  );

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  if (!ready) return null;

  // Matched on the exact wording start_shift() raises in the migration --
  // the one rejection a repeat press of the same button can never fix.
  const needsFreshCheck = Boolean(error?.includes("already started a shift"));

  // On shift: the timer, and the only way out.
  if (active) {
    return (
      <View className="mb-4 overflow-hidden rounded-xl border border-ok-line bg-surface">
        {stoppedNotice && (
          <View className="border-b border-warn-line bg-warn-surface px-4 py-2.5">
            <Text className="text-xs font-semibold text-warn-strong">A previous shift was stopped</Text>
            <Text className="mt-0.5 text-xs text-warn">{stoppedNotice}</Text>
          </View>
        )}

        <View className="flex-row items-center justify-between bg-ok-surface px-4 py-2.5">
          <View className="flex-row items-center gap-2">
            <Feather name="clock" size={15} color="#047857" />
            <Text className="text-sm font-bold text-ok-strong">On shift</Text>
          </View>
          <Text className="text-xs font-medium text-ok">Since {startedAtLabel(startedAt)}</Text>
        </View>

        <View className="items-center px-4 py-5">
          <Text className="text-xs uppercase tracking-wide text-ink-subtle">Worked today</Text>
          <Text className="mt-1 text-4xl font-bold text-ink">{workedLabel(startedAt)}</Text>

          <View className="mt-2 flex-row items-center gap-1.5">
            <Feather name="map-pin" size={11} color="#dc2626" />
            <Text className="text-xs text-ink-subtle">Sharing your location with dispatch</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/end-shift")}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="End shift"
          className="flex-row items-center justify-center gap-2 border-t border-line bg-red-600 py-3.5 active:bg-red-700 disabled:opacity-50"
        >
          <Feather name="square" size={16} color="white" />
          <Text className="text-base font-bold text-white">End shift</Text>
        </Pressable>
      </View>
    );
  }

  // The one way this specific check can fail to start a shift that pressing
  // the same button again can never fix -- it has already opened and closed
  // one. Telling a driver that and leaving a "Start shift" button underneath
  // it, which would just fail the same way again, is worse than not telling
  // them anything -- so this swaps the whole card for a prompt to go do the
  // only thing that actually unblocks them.
  if (needsFreshCheck) {
    return (
      <View className="mb-4 rounded-xl border border-marine-200 bg-surface p-4">
        <Text className="text-base font-bold text-ink">Do another vehicle check</Text>
        <Text className="mt-1 text-sm text-ink-subtle">
          That van check has already been used to start a shift. Check your van again to start a new one.
        </Text>

        <Pressable
          onPress={() => router.push("/vehicle-check")}
          accessibilityRole="button"
          accessibilityLabel="Do another vehicle check"
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-3 active:bg-marine-700"
        >
          <Feather name="camera" size={16} color="white" />
          <Text className="font-semibold text-white">Check your van</Text>
        </Pressable>
      </View>
    );
  }

  // No check yet: the shift starts with the walk-around, and the tile above
  // already asks for it. Nothing to say here.
  if (!readyCheck) return null;

  // Checked in, but location has never been agreed to. This is the one case
  // that still needs a press.
  return (
    <View className="mb-4 rounded-xl border border-marine-200 bg-surface p-4">
      {stoppedNotice && (
        <View className="mb-3 rounded-lg border border-warn-line bg-warn-surface px-3 py-2">
          <Text className="text-xs font-semibold text-warn-strong">A previous shift was stopped</Text>
          <Text className="mt-0.5 text-xs text-warn">{stoppedNotice}</Text>
        </View>
      )}

      {error && (
        <View className="mb-3">
          <Text className="text-sm text-red-600">{error}</Text>
          {permissionDenied && (
            <Pressable onPress={() => Linking.openSettings()} className="mt-1 flex-row items-center gap-1">
              <Feather name="settings" size={12} color="#475569" />
              <Text className="text-xs font-medium text-slate-600">Open Settings</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text className="text-base font-bold text-ink">Start your shift</Text>
      <Text className="mt-1 text-sm text-ink-subtle">
        Your check is in. Your shift shares your location with dispatch while you are working, and stops
        when you end it.
      </Text>

      <Pressable
        onPress={() => begin(readyCheck, true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Start shift"
        className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 active:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Feather name="play" size={16} color="white" />
            <Text className="font-semibold text-white">Start shift</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  endShift,
  isShiftActive,
  locationAlreadyAgreed,
  shiftStartedAt,
  startShift,
} from "@/lib/location";
import { startedAtLabel, workedLabel } from "@/lib/worked";
import { checksForDate, isSubmitted } from "@/lib/inspection";
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
// Not agreed, the card says what will happen and waits to be pressed. Either
// way ending is manual, because only the driver knows when they have finished.

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

export function ShiftCard({ driver }: { driver: Driver }) {
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Re-rendered each minute so the timer moves. A second-by-second clock on a
  // screen nobody is watching is battery spent for nothing.
  const [, setTick] = useState(0);
  const autoStarted = useRef(false);

  const begin = useCallback(
    async (withDisclosure: boolean) => {
      setError(null);
      setPermissionDenied(false);
      setBusy(true);

      const result = await startShift(
        { driverId: driver.id, companyId: driver.company_id, siteId: driver.site_id },
        withDisclosure ? askForDisclosure : async () => true
      );

      setBusy(false);

      if (result.ok) {
        setActive(true);
        setStartedAt(await shiftStartedAt());
        return;
      }

      // An empty reason means they declined the explanation, which needs no
      // error shown back at them -- they know what they chose.
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
        const [on, started, checks] = await Promise.all([
          isShiftActive(),
          shiftStartedAt(),
          checksForDate(todayISODate()).catch(() => []),
        ]);
        if (cancelled) return;

        const hasCheck = checks.some(isSubmitted);
        setActive(on);
        setStartedAt(started);
        setCheckedIn(hasCheck);
        setReady(true);

        // The automatic start. Once per app run, only after a check is in, and
        // only where location has already been agreed to.
        if (!on && hasCheck && !autoStarted.current) {
          autoStarted.current = true;
          if (await locationAlreadyAgreed()) {
            if (!cancelled) await begin(false);
          }
        }
      }

      void read();

      return () => {
        cancelled = true;
      };
    }, [begin])
  );

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  async function finish() {
    setBusy(true);
    await endShift();
    setActive(false);
    setStartedAt(null);
    setBusy(false);
  }

  function confirmEnd() {
    Alert.alert(
      "End your shift?",
      `You have been on shift for ${workedLabel(startedAt)}. This stops sharing your location with dispatch.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "End shift", style: "destructive", onPress: finish },
      ]
    );
  }

  if (!ready) return null;

  // On shift: the timer, and the only way out.
  if (active) {
    return (
      <View className="mb-4 overflow-hidden rounded-xl border border-ok-line bg-surface">
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
          onPress={confirmEnd}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="End shift"
          className="flex-row items-center justify-center gap-2 border-t border-line bg-red-600 py-3.5 active:bg-red-700 disabled:opacity-50"
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Feather name="square" size={16} color="white" />
              <Text className="text-base font-bold text-white">End shift</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  // No check yet: the shift starts with the walk-around, and the tile above
  // already asks for it. Nothing to say here.
  if (!checkedIn) return null;

  // Checked in, but location has never been agreed to. This is the one case
  // that still needs a press, and it says why.
  return (
    <View className="mb-4 rounded-xl border border-marine-200 bg-surface p-4">
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
        onPress={() => begin(true)}
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

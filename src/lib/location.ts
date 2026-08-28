import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "@/lib/supabase";

export const LOCATION_TASK_NAME = "driver-location-task";
const DRIVER_CONTEXT_KEY = "driver-location-context";

// A shift that nobody ended.
//
// Sharing stops when the driver presses End Shift, which is the design -- but
// "the driver always remembers" is not a privacy model. Somebody finishes at
// six, puts the phone on charge, and without this the app is still reporting
// their position at midnight, and on Sunday, and next week. That is both a real
// intrusion and the sort of thing a store reviewer asks about.
//
// Sixteen hours sits beyond any legal driving day rather than near one, so the
// cap only ever catches a forgotten shift and never a long one.
const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;

type DriverLocationContext = {
  driverId: string;
  companyId: string;
  siteId: string;
  /** When the shift began, so a forgotten one can time itself out. */
  startedAt?: number;
};

// Runs outside the React tree (background task), so it can't read component
// state -- the driver/company/site ids it needs are stashed in AsyncStorage
// by startShift() below, and the Supabase session it needs is already in
// AsyncStorage too (persistSession: true in lib/supabase.ts), so this insert
// works whether or not the app is currently in the foreground.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);

  // No context means no shift. Stopping rather than merely returning matters:
  // returning leaves the task registered, so the phone keeps waking to collect
  // positions this app has already decided not to record.
  if (!raw) {
    await endShift();
    return;
  }

  const context = JSON.parse(raw) as DriverLocationContext;

  if (context.startedAt && Date.now() - context.startedAt > MAX_SHIFT_MS) {
    await endShift();
    return;
  }

  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  await supabase.from("driver_locations").insert({
    company_id: context.companyId,
    site_id: context.siteId,
    driver_id: context.driverId,
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
  });
});

export async function isShiftActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
}

/** When the current shift began, or null when there is no shift. */
export async function shiftStartedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  if (!raw) return null;

  const context = JSON.parse(raw) as DriverLocationContext;
  return context.startedAt ?? null;
}

export type StartShiftResult =
  | { ok: true }
  | { ok: false; reason: string; needsSettings: boolean };

/**
 * Begins a shift, and with it location sharing.
 *
 * `onDisclosure` is asked before the background permission is requested, and a
 * false answer stops everything. Google requires a prominent in-app explanation
 * of background collection *before* the system prompt appears; a request made
 * without one is the most common reason a location app is rejected. It is a
 * parameter rather than a dialog in here so the wording lives in the UI layer,
 * where it can be read and reviewed as copy rather than buried in a helper.
 */
export async function startShift(
  context: DriverLocationContext,
  onDisclosure: () => Promise<boolean>
): Promise<StartShiftResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return {
      ok: false,
      reason: "Location permission is needed to start a shift.",
      needsSettings: !foreground.canAskAgain,
    };
  }

  if (!(await onDisclosure())) {
    // Declining the explanation is a decision, not a failure, so there is
    // nothing to apologise for and nothing to show.
    return { ok: false, reason: "", needsSettings: false };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return {
      ok: false,
      reason:
        "Dispatch needs to see where you are while you are driving, which means allowing location " +
        "all the time. Ending your shift stops it.",
      needsSettings: !background.canAskAgain,
    };
  }

  await AsyncStorage.setItem(
    DRIVER_CONTEXT_KEY,
    JSON.stringify({ ...context, startedAt: Date.now() } satisfies DriverLocationContext)
  );

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60_000,
    distanceInterval: 100,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "MiDrive DA",
      notificationBody: "Sharing your location while on shift.",
    },
  });

  return { ok: true };
}

/**
 * Ends the shift and stops location sharing.
 *
 * The stored context is cleared first, deliberately. If unregistering the task
 * then fails for any reason, the task's own guard finds no context on its next
 * run and stops itself -- so the worst case is one more position considered and
 * discarded, rather than tracking that outlives the shift.
 */
export async function endShift(): Promise<void> {
  await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);

  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (registered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

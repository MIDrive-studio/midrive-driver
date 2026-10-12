import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "@/lib/supabase";

export const LOCATION_TASK_NAME = "driver-location-task";
const DRIVER_CONTEXT_KEY = "driver-location-context";
const SHIFT_STOPPED_NOTICE_KEY = "driver-shift-stopped-notice";

// A shift that nobody ended.
//
// Sharing stops when the driver presses End Shift, which is the design -- but
// "the driver always remembers" is not a privacy model. Somebody finishes at
// six, puts the phone on charge, and without this the app is still reporting
// their position at midnight, and on Sunday, and next week. That is both a real
// intrusion and the sort of thing a store reviewer asks about.
//
// Twelve hours sits beyond any legal driving day rather than near one, so the
// cap only ever catches a forgotten shift and never a long one.
const MAX_SHIFT_MS = 12 * 60 * 60 * 1000;

export type DriverLocationContext = {
  driverId: string;
  companyId: string;
  siteId: string;
  /** The vehicle check that justified starting this shift. */
  inspectionId: string;
  vehicleId: string;
  registration: string;
  /** When the shift began, so a forgotten one can time itself out. */
  startedAt?: number;
  /**
   * The server's own record of this shift, once it has one. Null means
   * sharing is already live on the phone but the server hasn't confirmed it
   * yet -- a shift must never wait on signal to begin, so this is filled in
   * whenever it can be, not before.
   */
  serverShiftId: string | null;
  /** Set by endShift() when it couldn't reach the server yet. */
  locallyEndedAt: number | null;
};

type RpcAttempt =
  | { kind: "ok"; value: string }
  | { kind: "network" }
  | { kind: "rejected"; reason: string };

// Matched against start_shift()'s own exception text (see migration
// 20261007000001) for the one rejection that isn't really a refusal: the
// inspection row exists and belongs to this driver, its photos just haven't
// all reached the server yet (submit_vehicle_inspection only runs client-side
// once every upload has landed). A driver on bad signal gets exactly this
// the instant their check auto-starts a shift -- treating it as final would
// mean the walk-around they just finished still blocks their day on signal,
// which is the one thing this whole file exists to avoid.
const NOT_FINISHED_YET = "not finished yet";

/**
 * Calls a shift RPC with a timeout, and -- the reason this isn't just
 * withTimeout() -- keeps apart the two ways it can fail. A Postgres
 * exception comes back as an ordinary resolved response with `.error` set,
 * never a rejected promise, so it reaches here as `rejected`: the server
 * looked at this and said no, and retrying won't change that. Only a timeout
 * or the fetch itself throwing (no signal at all) counts as `network`: try
 * again once there's a chance of a different answer. NOT_FINISHED_YET is the
 * one exception to that: a definitive-looking rejection that is actually a
 * timing problem, not a refusal, so it is folded into `network` here rather
 * than at each call site, so start_shift and reconcileActiveShift agree.
 */
async function callShiftRpc(fn: "start_shift" | "end_shift", args: Record<string, string>, ms: number): Promise<RpcAttempt> {
  try {
    const result = await Promise.race([
      supabase.rpc(fn, args),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
    ]);

    if (result === "timeout") return { kind: "network" };

    const { data, error } = result;
    if (error) {
      if (error.message.includes(NOT_FINISHED_YET)) return { kind: "network" };
      return { kind: "rejected", reason: error.message };
    }
    return { kind: "ok", value: data as string };
  } catch {
    return { kind: "network" };
  }
}

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

/**
 * Whether location sharing has already been agreed to, without asking again.
 *
 * The shift now begins with the vehicle check rather than with a button, and
 * that must never mean background location starting on its own. Google requires
 * the prominent disclosure before the request, and a driver is entitled to
 * decide once and have the answer remembered -- not to be asked every morning,
 * and not to be tracked because a check happened to be submitted.
 *
 * So the automatic start is conditional on this: already agreed, the shift
 * begins quietly; not agreed, the driver is asked, once, in the open.
 */
export async function locationAlreadyAgreed(): Promise<boolean> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  return foreground.status === "granted" && background.status === "granted";
}

/** When the current shift began, or null when there is no shift. */
export async function shiftStartedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  if (!raw) return null;

  const context = JSON.parse(raw) as DriverLocationContext;
  return context.startedAt ?? null;
}

/**
 * The shift currently running, for whatever needs more than just "is one
 * active" -- the end-of-shift damage report needs to know which van and
 * which server-side shift id to attach itself to.
 */
export async function currentShiftContext(): Promise<DriverLocationContext | null> {
  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as DriverLocationContext;
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
 *
 * `context.inspectionId` is the vehicle check this shift is being opened
 * against. start_shift() on the server refuses a check that has already
 * opened a shift before -- that rule is the entire reason this now talks to
 * the server at all. On good signal it's enforced immediately, before
 * anything starts. On bad signal the shift still begins (never make a driver
 * wait to start their day over a network call), and reconcileActiveShift()
 * below settles the question once signal is back -- including stopping
 * sharing again if the answer turns out to have been no.
 */
export async function startShift(
  context: Pick<DriverLocationContext, "driverId" | "companyId" | "siteId" | "inspectionId" | "vehicleId" | "registration">,
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

  const attempt = await callShiftRpc("start_shift", { p_inspection_id: context.inspectionId }, 20_000);

  // The one case worth blocking on: the server has already, definitively,
  // said no. Everything else (no signal at all) starts anyway.
  if (attempt.kind === "rejected") {
    return { ok: false, reason: attempt.reason, needsSettings: false };
  }

  await AsyncStorage.setItem(
    DRIVER_CONTEXT_KEY,
    JSON.stringify({
      ...context,
      startedAt: Date.now(),
      serverShiftId: attempt.kind === "ok" ? attempt.value : null,
      locallyEndedAt: null,
    } satisfies DriverLocationContext)
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
 * Sharing stops immediately either way -- a driver who is done must never
 * wait on a network call to actually be done. If the server already knows
 * about this shift, ending it there is attempted too, briefly; if that
 * can't complete right now (no serverShiftId yet, or the call itself
 * couldn't get through), the context is kept, marked with when it was
 * locally ended, for reconcileActiveShift() to finish off.
 */
export async function endShift(): Promise<void> {
  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  const context = raw ? (JSON.parse(raw) as DriverLocationContext) : null;

  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (registered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  if (!context) {
    await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);
    return;
  }

  if (context.serverShiftId) {
    const attempt = await callShiftRpc("end_shift", { p_shift_id: context.serverShiftId }, 10_000);
    if (attempt.kind === "ok" || attempt.kind === "rejected") {
      // Rejected here means ending twice or a shift that's already closed --
      // either way there is nothing left to retry.
      await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);
      return;
    }
  }

  await AsyncStorage.setItem(
    DRIVER_CONTEXT_KEY,
    JSON.stringify({ ...context, locallyEndedAt: Date.now() } satisfies DriverLocationContext)
  );
}

/**
 * Finishes reconciling a shift the server doesn't fully know about yet --
 * either it was never told the shift started, or it was never told the
 * shift ended, or both. Called from the same foreground/queue triggers that
 * already retry the walk-around's own uploads (lib/inspection-sync.tsx),
 * rather than running its own separate retry loop.
 */
export async function reconcileActiveShift(): Promise<void> {
  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  if (!raw) return;

  const context = JSON.parse(raw) as DriverLocationContext;
  let shiftId = context.serverShiftId;

  if (!shiftId) {
    const attempt = await callShiftRpc("start_shift", { p_inspection_id: context.inspectionId }, 20_000);

    if (attempt.kind === "network") return;

    if (attempt.kind === "rejected") {
      // This shift was never valid server-side -- most likely started on
      // two devices, or the check it leaned on was somehow already spent.
      // Sharing stops now, the same as a manual End Shift, rather than
      // continuing to run against what the server has already said no to.
      const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);
      await AsyncStorage.setItem(SHIFT_STOPPED_NOTICE_KEY, attempt.reason);
      return;
    }

    shiftId = attempt.value;
    context.serverShiftId = shiftId;
    await AsyncStorage.setItem(DRIVER_CONTEXT_KEY, JSON.stringify(context));
  }

  if (context.locallyEndedAt) {
    const attempt = await callShiftRpc("end_shift", { p_shift_id: shiftId }, 10_000);
    if (attempt.kind === "ok" || attempt.kind === "rejected") {
      await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);
    }
  }
}

/** A plain-language reason a shift was stopped without the driver asking, or null. Read once, then clear it. */
export async function shiftStoppedNotice(): Promise<string | null> {
  return AsyncStorage.getItem(SHIFT_STOPPED_NOTICE_KEY);
}

export async function clearShiftStoppedNotice(): Promise<void> {
  await AsyncStorage.removeItem(SHIFT_STOPPED_NOTICE_KEY);
}

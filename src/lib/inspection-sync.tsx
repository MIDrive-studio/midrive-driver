import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { requestAnalysis, submitInspection, uploadCapture } from "@/lib/inspection";
import { reconcileActiveShift } from "@/lib/location";
import type { CapturedPhoto, InspectionPosition } from "@/types/inspection";

// The walk-around's upload queue.
//
// A driver finishes photographing a van the moment the ninth photograph is
// accepted, not whenever eleven network calls (nine uploads, a submit, a
// start already done before this) happen to land. This is what makes that
// true: every photo is copied somewhere the OS cannot evict it the moment
// it's accepted, recorded here, and actually sent whenever the app next has
// a chance -- on the spot if signal is good, the next time the app comes to
// the foreground if it was not. The driver never waits on it and never
// retypes anything.
//
// Deliberately no NetInfo. Nothing else in this app listens for connectivity
// changes -- see outstanding-documents.tsx, availability-pending.ts,
// tomorrow-assignment.ts -- all of them resume on AppState foreground instead,
// and adding a new native dependency here would mean a new build and a new
// Play review for what is otherwise a JS-only fix. A driver regains signal by
// moving, which is also when they next look at the phone.

const STORAGE_KEY = "pending-vehicle-checks";
const ROOT = new Directory(Paths.document, "pending-checks");

type PendingPhoto = {
  localUri: string;
  width: number;
  height: number;
  bytes: number;
  qualityScore: number;
  overridden: boolean;
  uploaded: boolean;
};

type PendingCheck = {
  inspectionId: string;
  driverId: string;
  companyId: string;
  siteId: string;
  vehicleId: string;
  registration: string;
  date: string;
  photos: Partial<Record<InspectionPosition, PendingPhoto>>;
  readyToSubmit: boolean;
  lastError: string | null;
};

type Store = Record<string, PendingCheck>;

async function readStore(): Promise<Store> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

// Notified on every write, so the provider below can show "finished, still
// sending" the instant a photo is queued or Submit is pressed -- not only
// once a sync attempt has finished, which on bad signal can be thirty
// seconds away and would leave the screen looking like nothing happened in
// the meantime, exactly the thing this whole change exists to avoid.
const listeners = new Set<() => void>();

async function writeStore(store: Store): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  listeners.forEach((listener) => listener());
}

/** One photo accepted on the walk-around. Durable from this point on. */
export async function enqueuePhoto(
  check: { inspectionId: string; driverId: string; companyId: string; siteId: string; vehicleId: string; registration: string; date: string },
  photo: CapturedPhoto
): Promise<void> {
  const dir = new Directory(ROOT, check.inspectionId);
  if (!dir.exists) dir.create({ intermediates: true });

  // Copied rather than left where the camera/ImageManipulator wrote it: that
  // location can be the cache directory, which the OS is free to clear under
  // storage pressure. Paths.document is not. Idempotent, so retaking the same
  // angle before the first copy has even uploaded just overwrites it.
  const source = new File(photo.uri);
  const dest = new File(dir, `${photo.position}.jpg`);
  await source.copy(dest, { overwrite: true });

  const store = await readStore();
  const existing = store[check.inspectionId];

  store[check.inspectionId] = {
    inspectionId: check.inspectionId,
    driverId: check.driverId,
    companyId: check.companyId,
    siteId: check.siteId,
    vehicleId: check.vehicleId,
    registration: check.registration,
    date: check.date,
    readyToSubmit: existing?.readyToSubmit ?? false,
    lastError: null,
    photos: {
      ...existing?.photos,
      // A retake always needs a fresh upload, even if the angle it is
      // replacing already made it to the server.
      [photo.position]: {
        localUri: dest.uri,
        width: photo.width,
        height: photo.height,
        bytes: photo.bytes,
        qualityScore: photo.qualityScore,
        overridden: photo.overridden,
        uploaded: false,
      },
    },
  };

  await writeStore(store);
}

/** The driver pressed Submit. Allows processQueue to call submitInspection. */
export async function markReadyToSubmit(inspectionId: string): Promise<void> {
  const store = await readStore();
  const check = store[inspectionId];
  if (!check) return;

  check.readyToSubmit = true;
  check.lastError = null;
  await writeStore(store);
}

let inFlight: Promise<void> | null = null;

/**
 * Uploads whatever can be uploaded right now, and submits whatever is both
 * complete and ready to go. Safe to call as often as anything likes --
 * concurrent callers share the one run in flight rather than racing.
 */
export function processQueue(): Promise<void> {
  if (!inFlight) {
    inFlight = runQueue().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runQueue(): Promise<void> {
  const store = await readStore();
  const checks = Object.values(store);

  for (const check of checks) {
    await processOne(check, store);
  }

  // Piggybacks on this same retry cycle rather than running its own -- a
  // shift started on bad signal needs the server told about it exactly when
  // this queue next gets a chance to talk to the server at all. See
  // reconcileActiveShift() in lib/location.ts.
  await reconcileActiveShift();
}

async function processOne(check: PendingCheck, store: Store): Promise<void> {
  try {
    for (const position of Object.keys(check.photos) as InspectionPosition[]) {
      const photo = check.photos[position];
      if (!photo || photo.uploaded) continue;

      await withTimeout(
        uploadCapture(check.inspectionId, check.companyId, {
          position,
          uri: photo.localUri,
          width: photo.width,
          height: photo.height,
          bytes: photo.bytes,
          qualityScore: photo.qualityScore,
          overridden: photo.overridden,
        }),
        30_000
      );

      photo.uploaded = true;
      await writeStore(store);
    }

    const allUploaded = Object.values(check.photos).every((photo) => photo?.uploaded);
    if (!allUploaded || !check.readyToSubmit) return;

    await withTimeout(submitInspection(check.inspectionId), 20_000);
    void requestAnalysis(check.inspectionId);

    const dir = new Directory(ROOT, check.inspectionId);
    if (dir.exists) dir.delete();

    delete store[check.inspectionId];
    await writeStore(store);
  } catch (error) {
    check.lastError = (error as Error).message;
    await writeStore(store);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out -- will retry.")), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// React side
// ---------------------------------------------------------------------------

type SyncState = {
  syncing: boolean;
  /** Whether today's date has a locally-complete check not yet confirmed by the server. */
  hasCompleteCheck: (dateISO: string) => boolean;
  /** The locally-complete check for a date, for whatever needs more than a yes/no -- starting a shift needs the actual vehicle. */
  completeCheckFor: (dateISO: string) => { inspectionId: string; vehicleId: string; registration: string } | null;
  /** How many of today's checks are still being sent, for display. */
  pendingCountFor: (dateISO: string) => number;
  /** Whether any pending check has failed and is waiting to be retried. */
  hasError: boolean;
  retry: () => void;
};

const InspectionSync = createContext<SyncState | null>(null);

// A record only exists in the store until processQueue finishes it, so any
// record still here that the driver marked ready to submit is, from their
// point of view, a check they have already finished -- whether or not the
// server has caught up yet is exactly the thing this hides from them.
function isComplete(check: PendingCheck): boolean {
  return check.readyToSubmit;
}

export function InspectionSyncProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({});
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setStore(await readStore());
  }, []);

  const run = useCallback(async () => {
    setSyncing(true);
    try {
      await processQueue();
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void run();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void run();
    });

    // The cheap half: whenever anything writes to the queue -- a photo
    // queued, Submit pressed, a background upload landing -- reflect it
    // immediately. This never attempts a sync itself, only re-reads what is
    // already on disk, so it is instant regardless of signal.
    listeners.add(refresh);

    return () => {
      subscription.remove();
      listeners.delete(refresh);
    };
  }, [run, refresh]);

  const hasCompleteCheck = useCallback((dateISO: string) => Object.values(store).some((check) => check.date === dateISO && isComplete(check)), [store]);

  const completeCheckFor = useCallback(
    (dateISO: string) => {
      const check = Object.values(store).find((c) => c.date === dateISO && isComplete(c));
      return check ? { inspectionId: check.inspectionId, vehicleId: check.vehicleId, registration: check.registration } : null;
    },
    [store]
  );

  const pendingCountFor = useCallback((dateISO: string) => Object.values(store).filter((check) => check.date === dateISO && isComplete(check)).length, [store]);

  const hasError = Object.values(store).some((check) => check.lastError !== null);

  const value: SyncState = { syncing, hasCompleteCheck, completeCheckFor, pendingCountFor, hasError, retry: () => void run() };

  return <InspectionSync.Provider value={value}>{children}</InspectionSync.Provider>;
}

export function useInspectionSync(): SyncState {
  const value = useContext(InspectionSync);
  if (!value) throw new Error("useInspectionSync must be used inside an InspectionSyncProvider.");
  return value;
}

// Used from capture.tsx and review.tsx right after queuing something, so a
// driver with good signal the whole time sees it just happen -- same as
// before, the queue only changes what happens when signal is bad.
export function kickSync(): void {
  void processQueue();
}

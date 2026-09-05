import * as ImageManipulator from "expo-image-manipulator";
import { bytesOf, looksLikeJpeg } from "@/lib/local-file";
import { supabase } from "@/lib/supabase";
import type { CapturedPhoto, InspectionPosition, VehicleCheckContext } from "@/types/inspection";

const BUCKET = "vehicle-inspections";

// 1600px on the long edge. Wide enough that a scratch on a door is several
// pixels across in the analysis, small enough that sixteen of them fit in one
// vision request. A full-resolution phone photograph is four megabytes, base64
// adds a third, and two of those per angle across eight angles is a request
// that fails on size rather than on anything to do with the van.
const TARGET_WIDTH = 1600;
const JPEG_QUALITY = 0.72;

// ---------------------------------------------------------------------------
// Photograph quality
// ---------------------------------------------------------------------------

// What this measures, stated plainly because the name would otherwise oversell
// it: how much detail survived JPEG compression, per megapixel.
//
// It is not a sharpness algorithm. React Native has no cheap way to read pixels
// out of a photograph, and shipping a JPEG decoder in JavaScript to run on a
// mid-range phone in a cold yard would cost more than it is worth. But at a
// fixed resolution and a fixed quality setting, the compressed size is a
// genuinely good proxy for whether there is anything in the frame: a blurred
// photograph, a very dark one, and one taken with a thumb over the lens all
// compress dramatically smaller than a sharp one of a van.
//
// So it catches the photographs that are obviously unusable, which is the whole
// job here. Whether a usable photograph is good enough to compare is a judgement
// the vision model makes on the server, with the actual pixels in front of it.
const REFERENCE_BYTES_PER_MEGAPIXEL = 170_000;
const POOR_QUALITY_BELOW = 45;

function qualityScore(bytes: number, width: number, height: number): number {
  const megapixels = (width * height) / 1_000_000;
  if (megapixels <= 0) return 0;

  const density = bytes / megapixels;
  return Math.round(Math.min(Math.max((density / REFERENCE_BYTES_PER_MEGAPIXEL) * 100, 0), 100));
}

export function isPoorQuality(photo: CapturedPhoto): boolean {
  return photo.qualityScore < POOR_QUALITY_BELOW;
}

/**
 * Downscales a freshly captured photograph and measures what came out.
 *
 * Done here rather than on the server because the saving is in what gets sent
 * over a phone signal in a yard, not in what gets stored.
 */
export async function prepareCapture(
  uri: string,
  position: InspectionPosition
): Promise<CapturedPhoto> {
  const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: TARGET_WIDTH } }], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const bytes = (await bytesOf(resized.uri)).byteLength;

  return {
    position,
    uri: resized.uri,
    width: resized.width,
    height: resized.height,
    bytes,
    qualityScore: qualityScore(bytes, resized.width, resized.height),
    overridden: false,
    uploaded: false,
  };
}

// ---------------------------------------------------------------------------
// The inspection itself
// ---------------------------------------------------------------------------

export async function assignedVehicleId(dateISO: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_assigned_vehicle", { p_date: dateISO });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function vehicleCheckContext(
  vehicleId: string,
  dateISO: string
): Promise<VehicleCheckContext | null> {
  const { data, error } = await supabase.rpc("vehicle_check_context", {
    p_vehicle_id: vehicleId,
    p_date: dateISO,
  });

  if (error) throw new Error(error.message);
  return (data as VehicleCheckContext | null) ?? null;
}

export async function startInspection(
  vehicleId: string,
  dateISO: string,
  mileage: number | null
): Promise<string> {
  const { data, error } = await supabase.rpc("start_vehicle_inspection", {
    p_vehicle_id: vehicleId,
    p_date: dateISO,
    p_mileage: mileage,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Uploads one photograph and records the row for it.
 *
 * The object path is fixed by position rather than by timestamp, so a retake
 * overwrites the shot it replaces instead of leaving the old one behind. That
 * matters more than it looks: the storage policies read the inspection id out
 * of this path, and the analysis pairs today's angles with yesterday's by
 * position. Two files claiming to be the front left photograph would make both
 * of those ambiguous.
 */
export async function uploadCapture(
  inspectionId: string,
  companyId: string,
  photo: CapturedPhoto
): Promise<void> {
  const path = `${companyId}/${inspectionId}/${photo.position}.jpg`;

  const bytes = await bytesOf(photo.uri);

  // Checked before it is sent. A walk-around photograph that did not read back
  // is a photograph the office will open and find blank, long after the van
  // has gone out.
  if (!looksLikeJpeg(bytes)) {
    throw new Error(`The ${photo.position} photo did not save properly. Please take it again.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { error: rowError } = await supabase.from("inspection_photos").upsert(
    {
      company_id: companyId,
      inspection_id: inspectionId,
      position: photo.position,
      storage_path: path,
      width: photo.width,
      height: photo.height,
      bytes: photo.bytes,
      quality_score: photo.qualityScore,
      quality_overridden: photo.overridden,
      // Left null rather than guessed. The capture screen cannot measure
      // brightness or sharpness separately -- see qualityScore above -- and a
      // fabricated number in a column an administrator later reads as evidence
      // would be worse than an empty one.
      sharpness: null,
      brightness: null,
      captured_at: new Date().toISOString(),
    },
    { onConflict: "inspection_id,position" }
  );

  if (rowError) throw new Error(rowError.message);
}

export async function submitInspection(inspectionId: string): Promise<void> {
  const { error } = await supabase.rpc("submit_vehicle_inspection", { p_inspection_id: inspectionId });
  if (error) throw new Error(error.message);
}

/**
 * Asks the portal to analyse the check now, rather than waiting for the
 * scheduled run to pick it up.
 *
 * Entirely optional, and deliberately impossible to fail loudly. The analysis
 * happens either way -- the portal drains the queue on a schedule, which is
 * what makes it work when a driver submits and locks their phone. This only
 * shortens the wait when the app happens to know where the portal lives and has
 * signal to reach it.
 */
export async function requestAnalysis(inspectionId: string): Promise<void> {
  const portal = process.env.EXPO_PUBLIC_PORTAL_URL;
  if (!portal) return;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  try {
    await fetch(`${portal.replace(/\/$/, "")}/api/inspections/analyse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inspection_id: inspectionId }),
    });
  } catch {
    // Nothing to tell the driver. Their check is submitted and queued; whether
    // this particular shortcut worked is not their problem.
  }
}

/**
 * Finds a van by its registration, for a driver who has been handed one other
 * than the van on their rota.
 *
 * An RPC rather than a plain select: the driver policy on vehicles is scoped to
 * their home site, so a driver working out of another depot for the day would
 * otherwise be told a perfectly real van does not exist.
 */
export async function lookupVehicle(registration: string): Promise<VehicleCheckContext | null> {
  const { data, error } = await supabase.rpc("vehicle_by_registration", {
    p_registration: registration,
  });

  if (error) throw new Error(error.message);
  if (!data) return null;

  // The lookup returns the vehicle only. The rest of the confirm card -- last
  // check, existing damage -- comes from the context call, which is the same
  // one used for the rostered van.
  const vehicle = data as { vehicle_id: string; registration?: string };
  const context = await vehicleCheckContext(vehicle.vehicle_id, todayISO());

  // Returning null here would be a lie the screen then repeats: it reports a
  // null as "no van on the fleet with that registration", and we are standing
  // on proof that there is one -- we just looked it up. Distinguishing the two
  // matters because the answers differ: a wrong plate is the driver's to fix,
  // and this is not.
  if (!context) {
    throw new Error(
      `Found ${vehicle.registration ?? "that van"}, but couldn't load its details. Ask the office to check your access to it.`
    );
  }

  return context;
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export type CompletedCheck = {
  id: string;
  van_registration: string;
  status: string;
  submitted_at: string | null;
  started_at: string;
  date: string;
};

/**
 * The driver's own checks for a date, newest first.
 *
 * Read straight off the table through the driver's own row-level policy -- a
 * driver can see their own inspections and nobody else's, so this needs no
 * function behind it.
 */
export async function checksForDate(dateISO: string): Promise<CompletedCheck[]> {
  const { data, error } = await supabase
    .from("vehicle_inspections")
    .select("id, van_registration, status, submitted_at, started_at, date")
    .eq("date", dateISO)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CompletedCheck[];
}

/** Every check this driver has done, newest first, for the history screen. */
export async function recentChecks(limit = 30): Promise<CompletedCheck[]> {
  const { data, error } = await supabase
    .from("vehicle_inspections")
    .select("id, van_registration, status, submitted_at, started_at, date")
    .order("date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CompletedCheck[];
}

/** Whether a check has been handed over, as opposed to abandoned part-way. */
export function isSubmitted(check: { status: string }): boolean {
  return ["submitted", "processing", "analysed", "requires_review", "approved"].includes(check.status);
}

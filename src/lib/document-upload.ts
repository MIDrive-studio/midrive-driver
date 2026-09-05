import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";

// Sending a document to the office.
//
// Shared by the licence and right-to-work steps because they are the same job
// with different words: photograph it, shrink it, read what it says, let the
// driver correct that, then put the file in the private bucket and record the
// row that points at it.
//
// The order matters and is not obvious. Files go up first, then the row. If
// the row fails the files are removed, because a document in a bucket that
// nothing points at is invisible to the office, invisible to the checker and
// impossible to find again -- which is exactly what happened for real while
// drivers had storage permission and no table permission.

/** Wide enough to read a licence number, small enough to send on a yard's signal. */
const TARGET_WIDTH = 1600;

export type UploadKind = "drivers_licence" | "right_to_work";

const TITLE: Record<UploadKind, string> = {
  drivers_licence: "Driving licence",
  right_to_work: "Right to work",
};

export type PickedPhoto = { uri: string; width: number; height: number };

/** Camera or library, asking for whichever permission is actually needed. */
export async function pickPhoto(fromCamera: boolean): Promise<{ photo?: PickedPhoto; error?: string }> {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return {
      error: fromCamera
        ? "MiDrive needs camera permission to take a photo of your document."
        : "MiDrive needs photo access to choose a photo of your document.",
    };
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) return {};

  const asset = result.assets[0];
  return { photo: { uri: asset.uri, width: asset.width, height: asset.height } };
}

/**
 * The photo at sending size, and the same bytes as base64.
 *
 * One pass rather than two. The base64 is what goes to the portal to be read;
 * the uri is what gets uploaded. Producing them separately would shrink the
 * image twice and, worse, could send one version to be read and store another.
 */
async function prepare(photo: PickedPhoto): Promise<{ uri: string; base64: string | null }> {
  // Only shrink what is oversized. Enlarging a small photo makes the file
  // bigger and the document no easier to read.
  const actions = photo.width > TARGET_WIDTH ? [{ resize: { width: TARGET_WIDTH } }] : [];

  const out = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  return { uri: out.uri, base64: out.base64 ?? null };
}

export async function prepareForReading(photo: PickedPhoto): Promise<string | null> {
  return (await prepare(photo)).base64;
}

async function upload(uri: string, path: string): Promise<string | null> {
  const response = await fetch(uri);
  const bytes = new Uint8Array(await response.arrayBuffer());

  const { error } = await supabase.storage.from("driver-documents").upload(path, bytes, {
    contentType: "image/jpeg",
  });

  return error ? error.message : null;
}

export type Confirmed = {
  /** As the driver confirmed it, which may differ from what was read. */
  documentNumber: string | null;
  expiresOn: string | null;
  /** DVLA check code, licence only. */
  checkCode?: string | null;
  /** Which right-to-work route this is: british, eu or other. */
  nationalityBasis?: string | null;
  /** What the document actually is, within its type -- a passport, a visa. */
  documentKind?: string | null;
  /** Home Office share code. Required on every route but the British one. */
  shareCode?: string | null;
  /** What the machine read, kept beside what the person confirmed. */
  extracted?: unknown;
};

export async function sendDocument({
  kind,
  front,
  back,
  driverId,
  companyId,
  siteId,
  userId,
  confirmed,
}: {
  kind: UploadKind;
  front: PickedPhoto;
  /** The reverse. Required for a photocard licence, absent otherwise. */
  back?: PickedPhoto | null;
  driverId: string;
  companyId: string;
  siteId: string;
  /** The auth user behind this driver. Absent rather than empty when unknown -- "" is not a uuid. */
  userId: string | null;
  confirmed: Confirmed;
}): Promise<{ error?: string }> {
  const stamp = Date.now();

  // The second folder segment is what the storage policy checks against
  // my_driver_id(), so this shape is load-bearing, not a convention.
  const frontPath = `${companyId}/${driverId}/${stamp}-${kind}-front.jpg`;
  const backPath = back ? `${companyId}/${driverId}/${stamp}-${kind}-back.jpg` : null;

  const preparedFront = await prepare(front);
  const frontError = await upload(preparedFront.uri, frontPath);
  if (frontError) return { error: `Couldn't send the photo — ${frontError}` };

  if (back && backPath) {
    const preparedBack = await prepare(back);
    const backError = await upload(preparedBack.uri, backPath);
    if (backError) {
      // The front is already up and nothing points at it yet. Take it back
      // rather than leave half a document in the bucket.
      await supabase.storage.from("driver-documents").remove([frontPath]);
      return { error: `Couldn't send the back of it — ${backError}` };
    }
  }

  const { error: rowError } = await supabase.from("driver_documents").insert({
    driver_id: driverId,
    site_id: siteId,
    doc_type: kind,
    title: TITLE[kind],
    file_path: frontPath,
    file_path_back: backPath,
    document_number: confirmed.documentNumber,
    expires_on: confirmed.expiresOn,
    check_code: confirmed.checkCode ?? null,
    nationality_basis: confirmed.nationalityBasis ?? null,
    document_kind: confirmed.documentKind ?? null,
    share_code: confirmed.shareCode ?? null,
    extracted: confirmed.extracted ?? null,
    created_by: userId ?? null,
  });

  if (rowError) {
    // Best effort. A stray file in a private bucket is a far smaller problem
    // than the one already being reported, so the outcome is noted rather than
    // shown over the top of it.
    const orphans = [frontPath, ...(backPath ? [backPath] : [])];
    const { error: cleanupError } = await supabase.storage.from("driver-documents").remove(orphans);
    if (cleanupError) console.error(`[onboarding] orphaned uploads left at ${orphans.join(", ")}: ${cleanupError.message}`);
    return { error: `The photo sent but could not be recorded — ${rowError.message}. Please try again.` };
  }

  return {};
}

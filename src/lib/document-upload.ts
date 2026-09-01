import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";

// Sending a photo of a document to the office.
//
// Shared by the licence and right-to-work steps because the two are the same
// job with different words: take or choose a photo, shrink it, put it in the
// private bucket, record the row that points at it.
//
// The order matters and is not obvious. The file goes up first, then the row.
// If the row fails the file is removed, because a document in a bucket that
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

export async function sendDocument({
  kind,
  photo,
  driverId,
  companyId,
  siteId,
  userId,
}: {
  kind: UploadKind;
  photo: PickedPhoto;
  driverId: string;
  companyId: string;
  siteId: string;
  /** The auth user behind this driver. Absent rather than empty when unknown -- "" is not a uuid. */
  userId: string | null;
}): Promise<{ error?: string }> {
  // Only shrink what is oversized. Enlarging a small photo makes the file
  // bigger and the document no easier to read.
  const shrunk =
    photo.width > TARGET_WIDTH
      ? await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: TARGET_WIDTH } }], {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        })
      : { uri: photo.uri };

  const response = await fetch(shrunk.uri);
  const bytes = new Uint8Array(await response.arrayBuffer());

  // The second folder segment is what the storage policy checks against
  // my_driver_id(), so this shape is load-bearing, not a convention.
  const path = `${companyId}/${driverId}/${Date.now()}-${kind}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("driver-documents")
    .upload(path, bytes, { contentType: "image/jpeg" });

  if (uploadError) return { error: `Couldn't send the photo — ${uploadError.message}` };

  const { error: rowError } = await supabase.from("driver_documents").insert({
    driver_id: driverId,
    site_id: siteId,
    doc_type: kind,
    title: TITLE[kind],
    file_path: path,
    created_by: userId ?? null,
  });

  if (rowError) {
    // Best effort. A stray file in a private bucket is a far smaller problem
    // than the one already being reported, so the outcome is noted rather than
    // shown over the top of it.
    const { error: cleanupError } = await supabase.storage.from("driver-documents").remove([path]);
    if (cleanupError) console.error(`[onboarding] orphaned upload left at ${path}: ${cleanupError.message}`);
    return { error: `The photo sent but could not be recorded — ${rowError.message}. Please try again.` };
  }

  return {};
}

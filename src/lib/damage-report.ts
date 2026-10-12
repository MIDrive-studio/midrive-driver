import * as ImagePicker from "expo-image-picker";
import { bytesOf, looksLikeJpeg } from "@/lib/local-file";
import { supabase } from "@/lib/supabase";

// Reporting damage found at the end of a shift.
//
// A sibling to accident.tsx's own evidence handling, not an import from it --
// nothing there is factored out as reusable, so this copies the same shape
// (camera for one shot, library for several, same upload-then-validate order)
// rather than reaching into a screen file for logic that happens to live there.
// Submission itself goes through report_driver_damage, a security-definer RPC
// that writes straight to vehicle_damage -- the same "a trusted person reports
// it, it's real immediately" path a Fleet Manager's own report already takes,
// not a review queue. The office can recategorise or dismiss it afterwards;
// nothing here asks the driver to classify what kind of damage it is.

const BUCKET = "driver-damage-reports";
export const MAX_DAMAGE_PHOTOS = 12;

export async function pickDamagePhotos(
  fromCamera: boolean,
  remaining: number
): Promise<{ uris: string[]; error: string | null }> {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { uris: [], error: fromCamera ? "Camera permission is needed." : "Photo library permission is needed." };
  }

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

  if (result.canceled) return { uris: [], error: null };
  return { uris: result.assets.map((asset) => asset.uri), error: null };
}

export async function submitDamageReport({
  vehicleId,
  companyId,
  photoUris,
  note,
  shiftId,
}: {
  vehicleId: string;
  companyId: string;
  photoUris: string[];
  note: string;
  shiftId: string | null;
}): Promise<{ error?: string }> {
  const paths: string[] = [];

  for (const uri of photoUris) {
    const bytes = await bytesOf(uri);

    if (!looksLikeJpeg(bytes)) {
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      return { error: "One of the photos did not save properly. Please take it again." };
    }

    const path = `${companyId}/${vehicleId}/${Date.now()}-${paths.length}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg" });

    if (uploadError) {
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      return { error: `A photo didn't upload — ${uploadError.message}.` };
    }

    paths.push(path);
  }

  const { error: rpcError } = await supabase.rpc("report_driver_damage", {
    p_vehicle_id: vehicleId,
    p_storage_paths: paths,
    p_notes: note.trim() || null,
    p_shift_id: shiftId,
  });

  if (rpcError) {
    await supabase.storage.from(BUCKET).remove(paths);
    return { error: rpcError.message };
  }

  return {};
}

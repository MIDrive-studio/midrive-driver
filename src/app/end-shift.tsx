import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { currentShiftContext, endShift } from "@/lib/location";
import { MAX_DAMAGE_PHOTOS, pickDamagePhotos, submitDamageReport } from "@/lib/damage-report";

// The one question End Shift now asks before it actually ends anything: is
// there new damage on the van. No is the common case and stays one tap away.
// Yes leads to photos and a note -- as many photos as the driver needs, no
// categorising asked of them, because the office can do that once they've
// seen what it actually is (see lib/damage-report.ts).
//
// Location sharing itself always stops the moment this screen is left,
// whichever path was taken -- see endShift() in lib/location.ts. A driver
// reporting damage is not kept waiting on a photo upload to stop being
// tracked; the report and the ending are two separate things that happen to
// be asked about together.

type Step = "question" | "photos";

type ShiftInfo = { vehicleId: string; companyId: string; registration: string; shiftId: string | null };

export default function EndShiftScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [step, setStep] = useState<Step>("question");
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentShiftContext().then((context) => {
      setShift(
        context
          ? { vehicleId: context.vehicleId, companyId: context.companyId, registration: context.registration, shiftId: context.serverShiftId }
          : null
      );
      setLoading(false);
    });
  }, []);

  async function finish() {
    await endShift();
    router.dismissAll();
  }

  async function noDamage() {
    setBusy(true);
    await finish();
  }

  async function addPhotos(fromCamera: boolean) {
    setError(null);
    const { uris, error: pickError } = await pickDamagePhotos(fromCamera, MAX_DAMAGE_PHOTOS - photos.length);
    if (pickError) {
      setError(pickError);
      return;
    }
    setPhotos((current) => [...current, ...uris].slice(0, MAX_DAMAGE_PHOTOS));
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((p) => p !== uri));
  }

  async function submit() {
    if (!shift || photos.length === 0) return;

    setBusy(true);
    setError(null);

    const { error: submitError } = await submitDamageReport({
      vehicleId: shift.vehicleId,
      companyId: shift.companyId,
      photoUris: photos,
      note,
      shiftId: shift.shiftId,
    });

    if (submitError) {
      setError(submitError);
      setBusy(false);
      return;
    }

    await finish();
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#1f5089" />
      </SafeAreaView>
    );
  }

  if (step === "question") {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 justify-center px-6">
          <Text className="text-center text-xl font-bold text-ink">Is there any new damage on the van?</Text>
          {shift?.registration && <Text className="mt-2 text-center text-sm text-ink-subtle">{shift.registration}</Text>}
          <Text className="mt-4 text-center text-sm leading-5 text-ink-muted">
            If something happened to the van during your shift that wasn&apos;t there this morning, say so here --
            a few photos and a note is all that&apos;s needed.
          </Text>
        </View>

        <View className="gap-2 px-6 pb-8">
          <Pressable
            onPress={() => setStep("photos")}
            disabled={busy}
            accessibilityRole="button"
            className="items-center rounded-xl bg-marine-600 py-4 active:bg-marine-700"
          >
            <Text className="text-base font-bold text-white">Yes, there&apos;s new damage</Text>
          </Pressable>
          <Pressable
            onPress={noDamage}
            disabled={busy}
            accessibilityRole="button"
            className="items-center rounded-xl border border-line-strong py-4 active:bg-surface-sunken"
          >
            {busy ? <ActivityIndicator color="#1f5089" /> : <Text className="text-base font-semibold text-ink">No, end my shift</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-3">
        <Pressable
          onPress={() => setStep("question")}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <Feather name="arrow-left" size={20} color="#475569" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">New damage</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8 pt-2">
        <Text className="mb-3 text-sm text-ink-muted">Add as many photos as you need, then describe what happened.</Text>

        <View className="flex-row flex-wrap gap-2">
          {photos.map((uri) => (
            <View key={uri} className="relative h-24 w-24 overflow-hidden rounded-lg bg-surface-sunken">
              <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
              <Pressable
                onPress={() => removePhoto(uri)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                hitSlop={6}
                className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
              >
                <Feather name="x" size={14} color="#ffffff" />
              </Pressable>
            </View>
          ))}

          {photos.length < MAX_DAMAGE_PHOTOS && (
            <Pressable
              onPress={() => addPhotos(true)}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
              className="h-24 w-24 items-center justify-center rounded-lg border border-dashed border-line-strong"
            >
              <Feather name="camera" size={20} color="#1f5089" />
            </Pressable>
          )}
        </View>

        {photos.length < MAX_DAMAGE_PHOTOS && (
          <Pressable onPress={() => addPhotos(false)} accessibilityRole="button" className="mt-2 flex-row items-center gap-2">
            <Feather name="image" size={14} color="#1f5089" />
            <Text className="text-sm font-semibold text-marine-700">Choose from library</Text>
          </Pressable>
        )}

        <Text className="mb-1 mt-5 text-sm font-medium text-ink-muted">What happened</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={5}
          placeholder="e.g. Another vehicle clipped the wing mirror in the yard"
          className="rounded-lg border border-line-strong bg-surface px-4 py-3 text-ink"
          style={{ minHeight: 100, textAlignVertical: "top" }}
        />

        {error && (
          <View className="mt-4 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={busy || photos.length === 0}
          accessibilityRole="button"
          className={`mt-5 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4 ${
            busy || photos.length === 0 ? "bg-marine-300" : "bg-marine-600 active:bg-marine-700"
          }`}
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Feather name="send" size={18} color="#ffffff" />}
          <Text className="text-base font-bold text-white">{busy ? "Sending…" : "Submit and end shift"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

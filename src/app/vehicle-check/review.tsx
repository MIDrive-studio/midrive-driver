import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { requestAnalysis, submitInspection, uploadCapture } from "@/lib/inspection";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { POSITIONS, POSITION_KEYS, type InspectionPosition } from "@/types/inspection";

// The last look before it goes.
//
// Eight thumbnails in walk-around order, any of which can be retaken, and one
// button. The only judgement asked of the driver here is "is that my van, from
// that corner" -- everything about damage, comparison and confidence belongs to
// the office and is deliberately absent from this screen.

export default function ReviewScreen() {
  const router = useRouter();
  const { driver } = useAuth();
  const { inspectionId, vehicle, photos, capturedCount, markUploaded, setActivePosition } = useVehicleCheck();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = POSITION_KEYS.filter((key) => !photos[key]);
  const complete = missing.length === 0;

  async function submit() {
    if (!inspectionId || !driver || !complete) return;

    setSubmitting(true);
    setError(null);

    try {
      // Anything that failed to upload on the way round gets one more go here,
      // where the driver is standing still and more likely to have signal than
      // they were walking between corners.
      for (const key of POSITION_KEYS) {
        const photo = photos[key as InspectionPosition];
        if (!photo || photo.uploaded) continue;

        await uploadCapture(inspectionId, driver.company_id, photo);
        markUploaded(photo.position);
      }

      await submitInspection(inspectionId);

      // Best effort, and never allowed to fail the submission: the portal
      // analyses the queue on a schedule regardless.
      await requestAnalysis(inspectionId);

      router.replace({ pathname: "/vehicle-check/processing", params: { id: inspectionId } });
    } catch (submitError) {
      setError((submitError as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to the camera"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <Feather name="arrow-left" size={20} color="#475569" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-ink">Check your photos</Text>
          <Text className="text-xs text-ink-subtle">
            {vehicle?.registration} · {capturedCount} of {POSITION_KEYS.length} taken
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8 pt-2">
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {POSITIONS.map((position) => {
            const photo = photos[position.key as InspectionPosition];

            return (
              <Pressable
                key={position.key}
                onPress={() => {
                  setActivePosition(position.key as InspectionPosition);
                  router.back();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  photo ? `Retake the ${position.label} photograph` : `Take the ${position.label} photograph`
                }
                className="w-[48%] overflow-hidden rounded-xl border border-line bg-surface active:opacity-80"
              >
                <View className="aspect-[4/3] bg-surface-sunken">
                  {photo ? (
                    <Image source={{ uri: photo.uri }} resizeMode="cover" className="h-full w-full" />
                  ) : (
                    <View className="h-full items-center justify-center">
                      <Feather name="camera" size={20} color="#94a3b8" />
                      <Text className="mt-1 text-[11px] font-semibold text-ink-faint">Not taken</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center justify-between px-2.5 py-2">
                  <Text className="text-xs font-semibold text-ink">{position.label}</Text>
                  {photo ? (
                    photo.overridden ? (
                      <Feather name="alert-triangle" size={13} color="#b45309" />
                    ) : (
                      <Feather name="check" size={13} color="#047857" />
                    )
                  ) : (
                    <Feather name="circle" size={13} color="#cbd5e1" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-3 text-center text-xs text-ink-subtle">Tap any photo to take it again.</Text>

        {!complete && (
          <View className="mt-4 rounded-xl border border-warn-line bg-warn-surface px-4 py-3">
            <Text className="text-sm font-semibold text-warn-strong">
              {missing.length} still to take
            </Text>
            <Text className="mt-1 text-xs leading-5 text-warn">
              All eight are needed. Without one, the office has no way to compare that side of the van with yesterday.
            </Text>
          </View>
        )}

        {error && (
          <View className="mt-4 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={complete ? submit : () => router.back()}
          disabled={submitting}
          accessibilityRole="button"
          className={`mt-5 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4 ${
            submitting ? "bg-marine-300" : complete ? "bg-marine-600 active:bg-marine-700" : "bg-marine-600 active:bg-marine-700"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Feather name={complete ? "send" : "camera"} size={18} color="#ffffff" />
          )}
          <Text className="text-base font-bold text-white">
            {submitting ? "Sending…" : complete ? "Submit vehicle check" : `Take the last ${missing.length}`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

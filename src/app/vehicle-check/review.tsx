import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { kickSync, markReadyToSubmit } from "@/lib/inspection-sync";
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
  const { inspectionId, vehicle, photos, capturedCount, setActivePosition } = useVehicleCheck();

  const missing = POSITION_KEYS.filter((key) => !photos[key]);
  const complete = missing.length === 0;

  // No "Sending..." screen, no spinner, no wait of any kind -- the driver
  // taps this and is already on the next screen. Marking the walk-around
  // ready and actually sending it (lib/inspection-sync.ts) are the queue's
  // job from here, on the spot if signal is good, the next time the app is
  // open if it was not; this function's only job is to not make them watch.
  function submit() {
    if (!inspectionId || !complete) return;

    void markReadyToSubmit(inspectionId).then(kickSync);

    router.replace({
      pathname: "/vehicle-check/submitted",
      params: { registration: vehicle?.registration ?? "" },
    });
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
              All {POSITION_KEYS.length} are needed. Without one, the office has no way to compare that part of the van
              with yesterday.
            </Text>
          </View>
        )}

        <Pressable
          onPress={complete ? submit : () => router.back()}
          accessibilityRole="button"
          className="mt-5 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 px-5 py-4 active:bg-marine-700"
        >
          <Feather name={complete ? "send" : "camera"} size={18} color="#ffffff" />
          <Text className="text-base font-bold text-white">
            {complete ? "Submit vehicle check" : `Take the last ${missing.length}`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

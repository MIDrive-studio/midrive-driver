import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { VanOutline } from "@/components/van-outline";

// The end of the walk-around.
//
// This screen used to poll. It sat there with a four-stage ticker while the
// analysis ran, and a driver who wanted to get going had to either watch it or
// work out for themselves that leaving was safe. That was the wrong shape
// entirely: the driver's job finished the moment the photographs were uploaded
// and the check was handed over. Everything after that is the office's, and
// none of it needs them present.
//
// So there is no waiting here at all. It states plainly that the check is in,
// says what happens next in one sentence, and gets out of the way. Anything the
// analysis finds reaches the office, not the driver -- and if it turns into
// something a driver needs to know, that is a conversation, not a push
// notification at the wheel.

export default function SubmittedScreen() {
  const router = useRouter();
  const { registration } = useLocalSearchParams<{ registration?: string }>();
  const { vehicle, reset } = useVehicleCheck();

  const plate = registration ?? vehicle?.registration ?? "your van";
  const submittedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  function close() {
    reset();
    router.dismissAll();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-center px-6">
        <View className="items-center">
          <View className="h-24 w-full max-w-xs">
            <VanOutline shape="side" colour="#047857" strokeWidth={6} opacity={0.9} />
          </View>

          <View className="mt-5 h-14 w-14 items-center justify-center rounded-full bg-ok-surface">
            <Feather name="check" size={28} color="#047857" />
          </View>

          <Text className="mt-4 text-center text-2xl font-bold text-ink">Vehicle check done</Text>

          <Text className="mt-2 text-center text-base leading-6 text-ink-muted">
            All nine photographs of {plate} are in, at {submittedAt}.
          </Text>
        </View>

        <View className="mt-8 rounded-xl border border-line bg-surface px-5 py-4">
          <View className="flex-row items-start gap-3">
            <Feather name="clock" size={17} color="#1f5089" style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">Nothing left for you to do</Text>
              <Text className="mt-1 text-xs leading-5 text-ink-subtle">
                The office compares your photographs with the last check in the background. It takes a few minutes and
                does not need your phone. Go and start your day.
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row items-start gap-3 border-t border-line pt-4">
            <Feather name="message-square" size={17} color="#1f5089" style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">If anything needs looking at</Text>
              <Text className="mt-1 text-xs leading-5 text-ink-subtle">
                Someone will speak to you. You will not get a notification about damage while you are driving.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-2 px-6 pb-8">
        <Pressable
          onPress={close}
          accessibilityRole="button"
          className="items-center rounded-xl bg-marine-600 px-5 py-4 active:bg-marine-700"
        >
          <Text className="text-base font-bold text-white">Done</Text>
        </Pressable>

        {/* A second van is a real case -- a driver swaps mid-shift, or takes a
            spare out in the afternoon -- so it is one tap rather than a trip
            back through the home screen. */}
        <Pressable
          onPress={() => {
            reset();
            router.replace("/vehicle-check");
          }}
          accessibilityRole="button"
          className="items-center rounded-xl border border-line-strong px-5 py-4 active:bg-surface-sunken"
        >
          <Text className="text-base font-semibold text-ink">Check another van</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

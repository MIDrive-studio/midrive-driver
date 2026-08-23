import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

// Full-width and unmistakable rather than one of the small grid tiles: a driver
// looking for this has just had a collision, and it needs to be the thing they
// see rather than the thing they hunt for. That intent is kept.
//
// What changed is how much of the screen it takes on the other 364 days. It was
// a large red panel with a filled red button, permanently the loudest thing on
// the home screen -- and a warning that shouts every single day stops being
// read as a warning at all. It is now one unmissable row: same colour, same
// position, same single tap, a third of the height.
export function AccidentReportTile() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/accident")}
      accessibilityRole="button"
      accessibilityLabel="Report an accident"
      // 60px tall, comfortably above the 44px thumb target.
      className="mt-4 flex-row items-center gap-3 rounded-xl border border-bad-line bg-bad-surface px-4 py-4 active:bg-red-100"
    >
      <Feather name="alert-triangle" size={20} color="#b91c1c" />

      <View className="flex-1">
        <Text className="text-sm font-bold text-bad-strong">Been in an accident?</Text>
        <Text className="mt-0.5 text-xs text-bad">Report it now with photos and location</Text>
      </View>

      <Feather name="chevron-right" size={18} color="#b91c1c" />
    </Pressable>
  );
}

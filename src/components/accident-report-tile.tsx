import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

// Deliberately loud and full-width rather than one of the small grid tiles: a
// driver looking for this has just had a collision, and it needs to be the
// thing they see rather than the thing they hunt for.
export function AccidentReportTile() {
  const router = useRouter();

  return (
    <View className="mt-3 items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6">
      <View className="rounded-lg bg-red-100 p-3">
        <Feather name="alert-triangle" size={28} color="#dc2626" />
      </View>

      <View className="items-center">
        <Text className="text-base font-bold text-slate-900">Been in an Accident?</Text>
        <Text className="mt-1 text-center text-sm text-slate-600">
          Report it immediately with photos and details
        </Text>
      </View>

      <Pressable
        onPress={() => router.push("/accident")}
        className="w-full items-center rounded-lg bg-red-600 py-3 active:bg-red-700"
      >
        <Text className="text-sm font-bold text-white">Report Accident</Text>
      </Pressable>
    </View>
  );
}

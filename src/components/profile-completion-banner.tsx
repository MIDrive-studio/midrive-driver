import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

export function ProfileCompletionBanner() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/complete-profile")}
      className="mb-4 rounded-xl bg-amber-100 px-4 py-3 active:bg-amber-200"
    >
      <Text className="font-semibold text-amber-800">Finish setting up your profile</Text>
      <Text className="mt-0.5 text-sm text-amber-700">Tap here to add your remaining details.</Text>
    </Pressable>
  );
}

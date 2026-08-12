import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { calcProfileCompletion } from "@/lib/profile-completion";
import type { Driver } from "@/types/driver";

export function ProfileCompletionCard({ driver }: { driver: Driver }) {
  const router = useRouter();
  const { percent, missing } = calcProfileCompletion(driver);

  if (percent === 100) return null;

  return (
    <View className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <View className="flex-row items-start gap-3">
        <Feather name="alert-circle" size={18} color="#d97706" style={{ marginTop: 2 }} />
        <View className="flex-1">
          <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-semibold text-amber-900">Profile Completion: {percent}%</Text>
            <Pressable onPress={() => router.push("/complete-profile")} className="rounded-lg bg-amber-600 px-3 py-1.5">
              <Text className="text-xs font-semibold text-white">Complete Profile</Text>
            </Pressable>
          </View>

          <View className="mb-3 h-2 w-full overflow-hidden rounded-full bg-amber-200">
            <View className="h-2 rounded-full bg-amber-600" style={{ width: `${percent}%` }} />
          </View>

          {missing.length > 0 && (
            <View>
              <Text className="mb-1 text-xs font-medium text-amber-800">Missing fields:</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {missing.map((m) => (
                  <View key={m} className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5">
                    <Text className="text-xs text-amber-800">{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

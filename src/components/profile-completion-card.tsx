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
    <View className="mb-4 rounded-xl border border-warn-line bg-warn-surface p-4">
      <View className="flex-row items-start gap-3">
        <Feather name="alert-circle" size={18} color="#b45309" style={{ marginTop: 2 }} />

        <View className="flex-1">
          {/* Says why it matters rather than only how far through it is. An
              incomplete profile is what stops a driver being paid, and a bare
              percentage never explained that. */}
          <Text className="text-sm font-semibold text-warn-strong">Finish your profile to get paid</Text>
          <Text className="mt-0.5 text-xs text-warn">
            {percent}% done. Payroll needs your bank details, UTR and NI number before it can pay you.
          </Text>

          <View className="my-3 h-1.5 w-full overflow-hidden rounded-full bg-warn-line">
            <View className="h-1.5 rounded-full bg-warn" style={{ width: `${percent}%` }} />
          </View>

          {missing.length > 0 && (
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {missing.map((m) => (
                <View key={m} className="rounded-full border border-warn-line bg-white px-2 py-0.5">
                  <Text className="text-xs text-warn-strong">{m}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => router.push("/complete-profile")}
            accessibilityRole="button"
            className="items-center rounded-lg bg-warn py-3 active:bg-warn-strong"
          >
            <Text className="text-sm font-semibold text-white">Complete profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

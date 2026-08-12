import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { ProfileCompletionBanner } from "@/components/profile-completion-banner";
import { ShiftToggle } from "@/components/shift-toggle";
import { ScreenCard } from "@/components/screen-card";

export default function HomeScreen() {
  const { driver, signOut } = useAuth();

  if (!driver) return null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-slate-500">Welcome back</Text>
            <Text className="text-2xl font-bold text-slate-900">{driver.full_name}</Text>
          </View>
          <Pressable onPress={() => signOut()}>
            <Text className="text-sm font-medium text-indigo-600">Sign out</Text>
          </Pressable>
        </View>

        {driver.profile_status === "pending" && <ProfileCompletionBanner />}

        <ShiftToggle driver={driver} />

        <ScreenCard title="Availability" subtitle="Submit your in/off days for the current request" href="/(tabs)/availability" />
        <ScreenCard title="Payroll" subtitle="This week's pay and your payslip history" href="/(tabs)/payroll" />
        <ScreenCard title="Performance" subtitle="Your weekly score, tier and rank" href="/(tabs)/performance" />
      </ScrollView>
    </SafeAreaView>
  );
}

import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { ProfileCompletionCard } from "@/components/profile-completion-card";
import { ShiftToggle } from "@/components/shift-toggle";
import { NavTile } from "@/components/nav-tile";
import { HomeAvailabilityTile } from "@/components/home-availability-tile";
import { AccidentReportTile } from "@/components/accident-report-tile";

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
            <Text className="text-sm font-medium text-amber-600">Sign out</Text>
          </Pressable>
        </View>

        <ProfileCompletionCard driver={driver} />

        <ShiftToggle driver={driver} />

        <View className="mt-2 flex-row flex-wrap justify-between gap-y-3">
          <HomeAvailabilityTile />
          <NavTile icon="credit-card" label="Payroll" subtitle="This week's pay & history" href="/(tabs)/payroll" />
          <NavTile icon="bar-chart-2" label="Performance" subtitle="Score, tier & rank" href="/(tabs)/performance" />
        </View>

        <AccidentReportTile />
      </ScrollView>
    </SafeAreaView>
  );
}

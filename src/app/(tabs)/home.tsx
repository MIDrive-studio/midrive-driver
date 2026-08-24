import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { ProfileCompletionCard } from "@/components/profile-completion-card";
import { ShiftToggle } from "@/components/shift-toggle";
import { NavTile } from "@/components/nav-tile";
import { HomeAvailabilityTile } from "@/components/home-availability-tile";
import { AccidentReportTile } from "@/components/accident-report-tile";
import { TodayCard } from "@/components/today-card";
import { VehicleCheckTile } from "@/components/vehicle-check-tile";

// A driver opens this in a yard, on a phone, usually in a hurry, to find out
// what they are doing. So today's job comes first and everything else follows.
//
// Two things were wrong before, and both were about emphasis rather than
// content. There was no today block at all -- route, van and depot were all in
// the database and reachable from here, and the screen simply never showed
// them. And the only coloured control on the screen was Sign out, top right,
// which made logging out the most prominent thing a driver could press.

export default function HomeScreen() {
  const { driver, signOut } = useAuth();

  if (!driver) return null;

  const firstName = driver.full_name.trim().split(/\s+/)[0];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm text-ink-subtle">Good to see you</Text>
            <Text className="text-2xl font-bold text-ink" numberOfLines={1}>
              {firstName}
            </Text>
          </View>

          {/* A quiet icon on a 44px target rather than the one piece of colour
              on the screen. */}
          <Pressable
            onPress={() => signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface"
          >
            <Feather name="log-out" size={18} color="#64748b" />
          </Pressable>
        </View>

        <VehicleCheckTile />

        <TodayCard driverId={driver.id} />

        <ProfileCompletionCard driver={driver} />

        <ShiftToggle driver={driver} />

        <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Everything else
        </Text>

        <View className="flex-row flex-wrap justify-between gap-y-3">
          <HomeAvailabilityTile />
          <NavTile icon="credit-card" label="Payroll" subtitle="This week's pay & history" href="/(tabs)/payroll" />
          <NavTile icon="bar-chart-2" label="Performance" subtitle="Score, tier & rank" href="/(tabs)/performance" />
        </View>

        <AccidentReportTile />
      </ScrollView>
    </SafeAreaView>
  );
}

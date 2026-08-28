import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  // The bar was 60px tall with 8px of bottom padding, both fixed, which put it
  // underneath the Android navigation bar rather than above it. Tapping
  // "Availability" opened the system recents instead -- the tabs were not
  // merely cramped, they were unreachable on any phone with a nav bar or a
  // gesture pill, which is all of them.
  //
  // The inset is whatever this device reserves at the bottom, and it is zero
  // where nothing is reserved, so adding it costs nothing on the phones that
  // did work.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Marine, matching the admin portal. The bar was amber, which was the
        // driver app's accent for no reason other than that it was not the
        // portal's -- and amber means "warning" everywhere else in MiDrive.
        tabBarActiveTintColor: "#1f5089",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        // 10px is below what is comfortable to read at arm's length in a yard,
        // and the inactive grey was too faint to be legible in daylight.
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="availability"
        options={{ title: "Availability", tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="fuel"
        options={{ title: "Fuel", tabBarIcon: ({ color, size }) => <Feather name="droplet" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="payroll"
        options={{ title: "Payroll", tabBarIcon: ({ color, size }) => <Feather name="credit-card" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="performance"
        options={{ title: "Performance", tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} /> }}
      />
    </Tabs>
  );
}

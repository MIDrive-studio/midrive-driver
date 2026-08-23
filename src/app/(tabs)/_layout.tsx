import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

export default function TabsLayout() {
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
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
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

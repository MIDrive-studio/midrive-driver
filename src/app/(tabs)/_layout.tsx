import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4f46e5" }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="availability" options={{ title: "Availability" }} />
      <Tabs.Screen name="payroll" options={{ title: "Payroll" }} />
      <Tabs.Screen name="performance" options={{ title: "Performance" }} />
    </Tabs>
  );
}

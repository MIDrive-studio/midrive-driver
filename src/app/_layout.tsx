import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading, isSignedIn, driver } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!splashHidden) {
      SplashScreen.hideAsync().catch(() => {});
      setSplashHidden(true);
    }

    const topSegment = segments[0] as string | undefined;

    if (!isSignedIn && topSegment !== "login") {
      router.replace("/login");
      return;
    }

    if (isSignedIn && driver?.profile_status === "pending" && topSegment !== "complete-profile") {
      router.replace("/complete-profile");
      return;
    }

    if (isSignedIn && driver?.profile_status === "completed" && (topSegment === "login" || topSegment === "complete-profile" || topSegment === undefined)) {
      router.replace("/(tabs)/home");
    }
  }, [loading, isSignedIn, driver, segments, router, splashHidden]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

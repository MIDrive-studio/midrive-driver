import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading, isSignedIn, driver, driverError, reloadDriver, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashHidden, setSplashHidden] = useState(false);

  const topSegment = segments[0] as string | undefined;
  const statusBarStyle = topSegment === "login" ? "light" : "dark";

  useEffect(() => {
    if (loading) return;

    if (!splashHidden) {
      SplashScreen.hideAsync().catch(() => {});
      setSplashHidden(true);
    }

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
  }, [loading, isSignedIn, driver, topSegment, router, splashHidden]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  // Signed in but the account has no linked driver row (or the lookup
  // failed) -- without this, the redirect effect above has nowhere to
  // send them and the app would otherwise appear to hang on a blank screen.
  if (isSignedIn && !driver) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <StatusBar style="dark" />
        <Text className="mb-2 text-center text-base font-semibold text-slate-900">
          {driverError ? "Couldn't load your account" : "No driver account found"}
        </Text>
        <Text className="mb-6 text-center text-sm text-slate-500">
          {driverError ?? "This login isn't linked to a driver profile. Contact your admin if this seems wrong."}
        </Text>
        <View className="flex-row gap-3">
          <Pressable onPress={() => reloadDriver()} className="rounded-lg bg-slate-900 px-4 py-2.5">
            <Text className="text-sm font-semibold text-white">Try Again</Text>
          </Pressable>
          <Pressable onPress={() => signOut()} className="rounded-lg border border-slate-300 px-4 py-2.5">
            <Text className="text-sm font-semibold text-slate-700">Sign Out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

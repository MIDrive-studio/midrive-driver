import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading, sessionError, isSignedIn, driver, driverError, reloadDriver, signOut } = useAuth();
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

    // Onboarding comes before the profile form, and replaces it.
    //
    // A driver who has not been cleared to work has a list of things to do that
    // is longer than this form and partly out of their hands -- a licence the
    // office has to look at, documents to sign, a background check nobody has
    // run yet. Sending them to complete-profile showed them a form they could
    // finish and then a home screen implying they were ready, while the office
    // was still waiting on half of it.
    //
    // The checklist is the whole of what they see until the office activates
    // them. It collects everything complete-profile did, and more.
    if (isSignedIn && driver?.status === "onboarding" && topSegment !== "onboarding") {
      router.replace("/onboarding");
      return;
    }

    // The other way round: activated while the app was open, or on the
    // checklist for any other reason with nothing left to do there.
    if (isSignedIn && driver && driver.status !== "onboarding" && topSegment === "onboarding") {
      router.replace("/(tabs)/home");
      return;
    }

    if (isSignedIn && driver?.profile_status === "pending" && topSegment !== "complete-profile") {
      router.replace("/complete-profile");
      return;
    }

    // "complete-profile" is deliberately not in this list any more.
    //
    // profile_status is a one-time onboarding flag: it flips to "completed" the
    // first time a driver saves the form, whether or not they filled everything
    // in. The card on the home screen measures the actual fields instead, so it
    // can rightly say "58% done — payroll needs your bank details" about a
    // driver whose status says completed. Pressing its button pushed to this
    // screen and this line threw them straight back, so the button did nothing
    // at all and there was no way to add the missing details from the app.
    //
    // Onboarding still forces the screen (the branch above). This branch now
    // only handles the two cases where the driver did not choose to be there.
    if (isSignedIn && driver?.profile_status === "completed" && (topSegment === "login" || topSegment === undefined)) {
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

  // Shown rather than swallowed. A build once sat on the splash screen for half
  // an hour because the sign-in check never settled and nothing said so; the
  // driver had no way to tell a slow start from a dead app, and neither did
  // anyone trying to fix it. Sign-in still works from here -- this is a warning,
  // not a wall.
  if (sessionError && !isSignedIn && topSegment !== "login") {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <StatusBar style="dark" />
        <Text className="mb-2 text-center text-base font-semibold text-slate-900">
          Couldn&apos;t start properly
        </Text>
        <Text className="mb-6 text-center text-sm text-slate-600">{sessionError}</Text>
        <Pressable
          onPress={() => router.replace("/login")}
          className="rounded-xl bg-slate-900 px-6 py-3"
        >
          <Text className="text-sm font-semibold text-white">Go to sign in</Text>
        </Pressable>
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
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="accident" options={{ presentation: "modal" }} />
        {/* Full screen rather than a modal: the camera fills the display and a
            modal sheet leaves a strip of the home screen showing round it. */}
        <Stack.Screen name="vehicle-check" options={{ presentation: "fullScreenModal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // SafeAreaProvider is what makes useSafeAreaInsets() return real numbers.
  // Without it the hook answers zero for every edge -- silently, with no
  // warning -- which is why the tab bar's inset fix appeared to do nothing:
  // it was adding zero. Screens using <SafeAreaView> got away with it because
  // the navigator supplies its own context to them; the hook had none.
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

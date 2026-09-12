import "../global.css";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { whereToSend } from "@/lib/where-to-send";
import { OutstandingDocumentsProvider, useOutstandingDocuments } from "@/lib/outstanding-documents";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading, sessionError, isSignedIn, driver, driverError, reloadDriver, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashHidden, setSplashHidden] = useState(false);
  const lastSent = useRef<string | null>(null);

  // Checked at app-open only -- see outstanding-documents.ts. `loading` here
  // is its own initial fetch, not this hook's; a driver must not be sent to
  // the tabs for a heartbeat before this has had a chance to answer, so
  // whereToSend() is not consulted at all until both are ready (below).
  const outstandingDocuments = useOutstandingDocuments();

  const topSegment = segments[0] as string | undefined;
  const statusBarStyle = topSegment === "login" ? "light" : "dark";

  useEffect(() => {
    if (loading) return;
    // Waited for once, on the first check, same as `loading` above. Without
    // this a driver with a document outstanding would see the tabs for one
    // frame before being pulled back to the gate -- not wrong for long, but a
    // flash of the wrong screen is still the wrong screen.
    if (outstandingDocuments.loading) return;

    if (!splashHidden) {
      SplashScreen.hideAsync().catch(() => {});
      setSplashHidden(true);
    }

    // One function decides this, and it is tested against every combination
    // of status, profile_status, screen and outstanding-document state -- see
    // test:where-to-send. Two rules written separately deadlocked here once
    // already.
    const send = whereToSend({
      isSignedIn,
      status: driver?.status ?? null,
      profileStatus: driver?.profile_status ?? null,
      segment: topSegment,
      hasOutstandingDocuments: outstandingDocuments.count > 0,
    });

    // Settled: stay put, and forget where we were sent so a later move to the
    // same place is allowed.
    if (!send) {
      lastSent.current = null;
      return;
    }

    // Issuing the same navigation twice in a row is never useful, and here it
    // was actively harmful.
    //
    // The decision is a pure function and it settles -- that is tested for
    // every combination. But it is fed by useSegments(), which does not update
    // in the same tick as router.replace(). During a transition the effect can
    // re-run still seeing the old segment, decide on the same destination
    // again, and issue a second navigation; that re-renders, which re-runs the
    // effect, and so on. On a phone it showed up as the app never finishing
    // loading, then "Maximum update depth exceeded" from react-navigation
    // tearing screens down, and finally an OutOfMemoryError with a 512MB heap
    // full of animation handlers from screens that kept being mounted.
    //
    // A settled decision clears this, so this only ever suppresses a repeat of
    // a move already in flight -- never a genuine second move.
    if (lastSent.current === send) return;

    lastSent.current = send;
    router.replace(send as Parameters<typeof router.replace>[0]);
  }, [loading, isSignedIn, driver, topSegment, router, splashHidden, outstandingDocuments.loading, outstandingDocuments.count]);

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
        {/* No swipe-back: a document that has become required is required,
            not a screen to dismiss. Signing it is what leaves this screen. */}
        <Stack.Screen name="documents-gate" options={{ gestureEnabled: false }} />
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
    // GestureHandlerRootView is what makes react-native-gesture-handler work at
    // all on Android. The library was already a dependency and this was never
    // mounted, so any gesture built on it would simply have done nothing --
    // silently, which is the hard kind to diagnose.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* One shared instance, not one per screen -- see
              outstanding-documents.tsx for why the gate screen and this
              layout's own redirect effect must never each hold a different
              answer to "is anything still outstanding". */}
          <OutstandingDocumentsProvider>
            <RootNavigator />
          </OutstandingDocumentsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

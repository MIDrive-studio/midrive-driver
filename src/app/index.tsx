import { ActivityIndicator, View } from "react-native";

// The route the launcher actually opens.
//
// Tapping the icon opens "midrivedriver:///", which is the path "/". Every
// screen in this app lives at a named path -- /login, /(tabs)/home,
// /vehicle-check -- and nothing answered "/", so a standalone build landed on
// expo-router's "Unmatched Route: Page could not be found" page. The app was
// working perfectly; it simply had nowhere to start.
//
// It never showed up in development because Expo Go opens the app at a
// different entry URL, so the missing index route was invisible in exactly the
// environment it was tested in. Worth remembering: routing is one of the things
// a dev client genuinely does not exercise the same way.
//
// This screen deliberately makes no decision of its own. The redirect logic in
// _layout.tsx already knows the rules -- signed out goes to login, an
// unfinished profile goes to complete-profile, everyone else goes to home --
// and it fires on this route because `topSegment` is undefined here. Duplicating
// that decision would give the app two places to disagree about where a driver
// belongs.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#f59e0b" />
    </View>
  );
}

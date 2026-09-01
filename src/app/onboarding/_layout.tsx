import { Stack } from "expo-router";

// The onboarding flow.
//
// A stack rather than tabs on purpose. Tabs invite wandering, and every step
// here has an order the database enforces anyway -- bank details do not unlock
// until the office has checked who the person is. The checklist at the root is
// the only navigation, so there is exactly one place that says what is left.
//
// gestureEnabled is off nowhere in here: backing out of a step is fine, and a
// half-filled form is never saved, so there is nothing to lose by leaving one.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

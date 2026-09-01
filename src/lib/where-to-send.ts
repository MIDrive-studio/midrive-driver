// Where a driver belongs, given who they are and where they are.
//
// This was a chain of ifs inside the root layout's effect, and it deadlocked:
// an onboarding driver whose profile_status was still "pending" was sent from
// /onboarding to /complete-profile by one rule and straight back by another,
// for ever. The screen never settled and sign-in looked like it was failing.
//
// Two rules that each look right on their own can still disagree, and reading
// them in a redirect effect does not show it. So they live here, as one pure
// function over a small amount of state, and where-to-send is walked to a
// fixed point in the tests: every combination of status, profile_status and
// current screen must come to rest somewhere, and it must be somewhere the
// driver can act.

export type Where = {
  isSignedIn: boolean;
  /** null when signed in but no driver record has loaded. */
  status: "onboarding" | "active" | "offboarded" | null;
  profileStatus: "pending" | "completed" | null;
  /** The first path segment, or undefined at "/". */
  segment: string | undefined;
};

/** The route to replace with, or null to stay put. */
export function whereToSend(where: Where): string | null {
  const { isSignedIn, status, profileStatus, segment } = where;

  if (!isSignedIn) return segment === "login" ? null : "/login";

  // No driver record yet. The layout shows its own message for this; sending
  // them anywhere would be guessing.
  if (status === null) return null;

  // Onboarding replaces the profile form rather than preceding it.
  //
  // This is the rule that was only half written. It correctly pulled a driver
  // out of complete-profile, but it did not stop the profile rule below
  // pushing them back in, so the two took turns. It now answers for every
  // onboarding driver, wherever they are, and the rules after it never see one.
  if (status === "onboarding") return segment === "onboarding" ? null : "/onboarding";

  // Activated while the app was open, or on the checklist with no reason to be.
  if (segment === "onboarding") return "/(tabs)/home";

  // profile_status is a one-time flag: it flips to "completed" the first time a
  // driver saves the form, whether or not they filled it in. The home screen
  // measures the actual fields instead, which is why a driver may walk into
  // complete-profile of their own accord and must not be thrown out of it.
  if (profileStatus === "pending") return segment === "complete-profile" ? null : "/complete-profile";

  if (profileStatus === "completed" && (segment === "login" || segment === undefined)) return "/(tabs)/home";

  return null;
}

import type { useRouter } from "expo-router";

// Leaving a screen that might be the first one.
//
// Onboarding moves between steps with router.replace(), because the step just
// finished is not somewhere to go back to. The side effect is that a step can
// be the only thing on the stack, and router.back() from there goes nowhere:
// expo-router raises "The action 'GO_BACK' was not handled by any navigator",
// which in development is a full-screen red overlay the driver has to dismiss
// before they can carry on.
//
// So back means "back if there is a back, otherwise the checklist". The
// checklist is the right destination anyway -- it is the only navigation
// onboarding has, and it is where every step returns to.

/** Back, or to the checklist when this screen is the first one. */
export function leaveStep(router: ReturnType<typeof useRouter>, fallback = "/onboarding") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Parameters<typeof router.replace>[0]);
}

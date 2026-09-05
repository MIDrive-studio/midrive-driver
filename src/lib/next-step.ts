import type { OnboardingState } from "@/types/onboarding";

// Where onboarding goes after a step is finished.
//
// A driver who has just sent their licence should land on the next thing that
// needs them, not on a list they have to read to find out what that is. They
// can still press back at any point and see everything -- what the flow removes
// is the obligation to.
//
// The order is the database's order, not one written again here. The stages
// come back from driver_onboarding_state() in the sequence the office thinks
// of them in, so "the next one" is simply the next in that list that the driver
// can act on and this app has a screen for.

/** The steps this app can open, keyed by the stage they satisfy. */
export const STEP_ROUTE: Record<string, string> = {
  personal: "/onboarding/personal",
  address_history: "/onboarding/addresses",
  licence: "/onboarding/document?kind=drivers_licence",
  right_to_work: "/onboarding/document?kind=right_to_work",
  company_documents: "/onboarding/documents",
  midrive_contract: "/onboarding/documents",
  bank_details: "/onboarding/bank",
  tax_details: "/onboarding/tax",
};

/**
 * The next step the driver can do, or null when there is nothing left for them.
 *
 * `after` is the stage just completed. It is skipped even if the state still
 * shows it as outstanding, because the state may have been read before the
 * write landed -- and sending somebody back to the step they just finished is
 * the one outcome worse than sending them nowhere.
 */
export function nextStep(state: OnboardingState | null, after?: string): string | null {
  if (!state) return null;

  for (const stage of state.stages) {
    if (stage.key === after) continue;
    if (stage.state !== "waiting_driver" && stage.state !== "rejected") continue;

    const route = STEP_ROUTE[stage.key];
    if (route) return route;
  }

  return null;
}

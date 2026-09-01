// The shape of driver_onboarding_state(), as the database returns it.
//
// Deliberately a mirror and nothing more. Every judgement about what a driver
// still owes -- what is done, what is locked, what is blocking activation --
// is made in one place, in SQL, and both the office portal and this app read
// the same answer. An app that worked it out for itself would eventually tell
// a driver they were finished while the office was still waiting on something.
//
// Keep in step with lib/onboarding/state.ts in the admin portal.

export type StageState =
  | "complete"
  | "waiting_driver"
  | "waiting_admin"
  | "rejected"
  | "locked"
  | "not_required";

export type OnboardingStage = {
  key: string;
  label: string;
  state: StageState;
  detail: string | null;
  /** Present on the document stages: how many of how many are signed. */
  done?: number;
  total?: number;
};

export type OnboardingState = {
  driver_id: string;
  company_id: string;
  status: string;
  stages: OnboardingStage[];
  /** What activation is waiting on, in words, or null when nothing is. */
  blocking: string | null;
  ready_to_activate: boolean;
  complete_count: number;
  stage_count: number;
};

/** The stages a driver can actually do something about. */
export function driverStages(state: OnboardingState): OnboardingStage[] {
  return state.stages.filter((s) => s.state === "waiting_driver" || s.state === "rejected");
}

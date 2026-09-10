import type { AvailabilityRequest, AvailabilitySubmission } from "@/types/availability";

// Whether a driver still owes the office an answer.
//
// This existed inline on the home tile as one line:
//
//   const hasSubmittedAll = result.mySubmissions.length > 0;
//
// which is wrong twice over, and both ways say "Submitted" to somebody who has
// not submitted.
//
// availability-status returns every submission the driver has ever made that
// has not been archived, across every request. So answering last month's rota
// makes this month's brand-new request read as answered, and the driver sees a
// green tick over a question nobody has asked them yet.
//
// And even within one request, one answered day out of fourteen satisfied
// `length > 0`. A driver who filled in Monday and put the phone down was told
// they were done.
//
// A request covers a run of dates and wants an answer for each of them. That is
// what is counted here.

/** Every date a request asks about, inclusive of both ends. */
export function datesInRequest(request: Pick<AvailabilityRequest, "date_from" | "date_to">): string[] {
  const days: string[] = [];
  const cursor = new Date(`${request.date_from}T00:00:00Z`);
  const end = new Date(`${request.date_to}T00:00:00Z`);

  // Guard against a malformed range rather than looping forever on a phone.
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || end < cursor) return days;

  while (cursor <= end && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export type AvailabilityState =
  | { kind: "none" }
  | { kind: "answered"; request: AvailabilityRequest; days: number }
  | { kind: "outstanding"; request: AvailabilityRequest; answered: number; total: number; remaining: number };

/**
 * What the driver is being asked, and how much of it they have done.
 *
 * Submissions are matched to the request by id, so an answer to an older one
 * cannot stand in for this one.
 */
export function availabilityState(
  activeRequest: AvailabilityRequest | null | undefined,
  mySubmissions: AvailabilitySubmission[] | null | undefined
): AvailabilityState {
  if (!activeRequest) return { kind: "none" };

  const wanted = datesInRequest(activeRequest);
  if (wanted.length === 0) return { kind: "none" };

  const answered = new Set(
    (mySubmissions ?? [])
      .filter((s) => s.request_id === activeRequest.id)
      .map((s) => s.date)
  );

  // Only the days this request actually asks about. A stray submission for a
  // date outside the range must not count towards finishing it.
  const covered = wanted.filter((date) => answered.has(date)).length;

  return covered >= wanted.length
    ? { kind: "answered", request: activeRequest, days: wanted.length }
    : {
        kind: "outstanding",
        request: activeRequest,
        answered: covered,
        total: wanted.length,
        remaining: wanted.length - covered,
      };
}

/** What the tile says, in the fewest words that are still true. */
export function availabilityWords(state: AvailabilityState): { title: string; detail: string } {
  switch (state.kind) {
    case "none":
      return { title: "Availability", detail: "Nothing to answer" };
    case "answered":
      return { title: "Availability", detail: "Answered" };
    case "outstanding":
      return {
        title: "Availability",
        detail:
          state.answered === 0
            ? `${state.total} day${state.total === 1 ? "" : "s"} to answer`
            : `${state.remaining} day${state.remaining === 1 ? "" : "s"} left`,
      };
  }
}

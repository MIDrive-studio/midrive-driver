// How long the driver has been on shift, in words.
//
// Kept apart from the component so the arithmetic can be checked without
// rendering anything, and because "how long have I worked" is the number a
// driver is going to compare against a payslip. It should be the same answer
// every time it is asked.

/** Whole hours and minutes since a start time. Never negative. */
export function workedFor(startedAt: number, now: number = Date.now()): { hours: number; minutes: number } {
  const elapsed = Math.max(0, now - startedAt);
  const totalMinutes = Math.floor(elapsed / 60_000);

  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * The timer as it reads on screen.
 *
 * "7h 24m" rather than a clock, because a clock reads as a time of day and
 * this is a duration -- a driver glancing at 07:24 on their own screen should
 * not have to work out which one it is.
 */
export function workedLabel(startedAt: number | null, now: number = Date.now()): string {
  if (!startedAt) return "";

  const { hours, minutes } = workedFor(startedAt, now);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** "Started 06:42", in local time. */
export function startedAtLabel(startedAt: number | null): string {
  if (!startedAt) return "";
  return new Date(startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

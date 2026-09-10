// Naming a date the way somebody says it out loud.
//
// "Next in 2026-09-12" is a date a driver has to work out. "Next in tomorrow"
// is one they already know. Beyond a few days the weekday is what people use --
// "Friday" -- and past a week the date is genuinely the clearest thing.

const DAY = 86_400_000;

/** Midnight local, so "tomorrow" means the calendar day and not 24 hours. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function daysUntil(date: string, now: Date = new Date()): number {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return NaN;
  return Math.round((startOfDay(target) - startOfDay(now)) / DAY);
}

/**
 * "today", "tomorrow", "on Friday", "on 24 Sept".
 *
 * Written to sit after a verb -- "Next in tomorrow" reads oddly, so the caller
 * gets "tomorrow" and "on Friday" and the sentence works either way round.
 */
export function whenLabel(date: string, now: Date = new Date()): string {
  const days = daysUntil(date, now);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";

  const target = new Date(`${date}T00:00:00`);
  if (days < 7) return `on ${target.toLocaleDateString("en-GB", { weekday: "long" })}`;

  return `on ${target.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

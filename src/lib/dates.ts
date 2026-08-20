// Ported from midrive-v2's lib/rota/dates.ts (can't share code across
// separate repos) -- keep in sync if the pay-week scheme ever changes there.
// Native Date only, no date library.

// The operation runs in the UK, so "today" has to be today *here*.
// new Date().toISOString() is UTC by definition, which through British Summer
// Time makes everything between midnight and 1am belong to yesterday -- the
// driver app showing the wrong assignment, payroll opening on the wrong day,
// a route upload landing on the previous date. Night work is exactly when this
// is used.
//
// Only this one converts an instant into a calendar day. The helpers that take
// a date string stay UTC-based on purpose: "2026-08-20" has no timezone, and
// anchoring it to UTC midnight is what stops addDays() drifting across a DST
// boundary.
export function todayISODate(): string {
  // en-CA formats as YYYY-MM-DD, which is the shape the rest of the app expects.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export function addDays(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Inclusive list of ISO date strings from start to start+length-1.
export function dateWindow(startISO: string, length: number): string[] {
  return Array.from({ length }, (_, i) => addDays(startISO, i));
}

// Pay weeks run Sunday -> Saturday.
export function startOfWeek(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const day = d.getUTCDay(); // Sunday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// Week 1 is the 7-day span starting on the Sunday on/before Jan 1.
export function weekOf(dateISO: string): { year: number; week: number } {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay());
  const week = Math.floor((d.getTime() - firstSunday.getTime()) / 86400000 / 7) + 1;
  return { year, week };
}

export function formatDayLabel(dateISO: string): { weekday: string; dayMonth: string } {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    dayMonth: d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
  };
}

function formatShort(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function weekRangeLabel(startISO: string, endISO: string): string {
  return `${formatShort(startISO)} – ${formatShort(endISO)}`;
}

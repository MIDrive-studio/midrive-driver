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

// ---------------------------------------------------------------------------
// Typing a date on a phone
// ---------------------------------------------------------------------------
//
// A driver typing an expiry date should not have to reach for the "/" key. The
// slashes appear as they type: two digits, slash, two digits, slash, four.
//
// The lesson from postcode.ts's formatAsTyped applies here too -- that one
// originally punctuated before it knew enough and produced nonsense mid-word.
// A date is easier: the field widths are fixed, so after two digits the first
// slash is never wrong. The trap is not ambiguity, it is deletion.
//
// Backspacing is why this works on digits rather than on the string. Strip the
// punctuation, drop the last digit, put the punctuation back: backspacing over
// a slash removes the digit before it instead of the slash alone, which would
// otherwise be re-inserted on the next keystroke and trap the caret.

/** Digits only, at most `max` of them. */
function digitsOf(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/**
 * A part-typed date, punctuated as DD/MM/YYYY.
 *
 * Punctuation is only ever added behind a completed pair, never in front of
 * one, so the field never shows a trailing slash the driver has not earned.
 */
export function formatDateAsTyped(raw: string): string {
  const digits = digitsOf(raw, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** The same, for a month and year: MM/YYYY. */
export function formatMonthAsTyped(raw: string): string {
  const digits = digitsOf(raw, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * A typed DD/MM/YYYY as an ISO date, or null if it is not a real day.
 *
 * Rejects impossible days rather than letting Date roll them over: 31/02/2026
 * is a typing mistake, and JavaScript quietly turning it into 3 March would
 * store a date the driver never entered.
 */
export function typedDateToISO(typed: string): string | null {
  const digits = digitsOf(typed, 8);
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4));

  if (month < 1 || month > 12 || day < 1 || year < 1900) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;

  return date.toISOString().slice(0, 10);
}

/** A typed MM/YYYY as the first of that month, or null. */
export function typedMonthToISO(typed: string): string | null {
  const digits = digitsOf(typed, 6);
  if (digits.length !== 6) return null;

  const month = Number(digits.slice(0, 2));
  const year = Number(digits.slice(2));
  if (month < 1 || month > 12 || year < 1900) return null;

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** An ISO date back into the typed form, for showing what is already stored. */
export function isoToTypedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

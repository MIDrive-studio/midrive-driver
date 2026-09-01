export type AddressLine = {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  lived_from: string;
  lived_to: string | null;
};

// How far back the addresses reach.
//
// This is the same walk driver_onboarding_state() does, deliberately step for
// step: start seven years ago, go through the addresses oldest first, and stop
// at the first one that begins after the point reached so far. Walked rather
// than summed, because three years plus three years is not six if they overlap,
// and 2018 plus 2024 is not continuous.
//
// The database is the authority. This exists so the screen can say "we still
// need back to March 2019" while the driver is typing, instead of them adding
// a line, going back, and finding the checklist still unsatisfied with no
// indication of why. If the two ever disagree the checklist is right -- which
// is why this returns the date it reached rather than a verdict of its own.

const SEVEN_YEARS_AGO = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCFullYear(d.getUTCFullYear() - 7);
  return d;
};

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function addressCover(lines: AddressLine[]): { covered: boolean; reachedTo: Date; needFrom: Date } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const needFrom = SEVEN_YEARS_AGO();

  let cursor = needFrom;

  const inOrder = [...lines].sort((a, b) => a.lived_from.localeCompare(b.lived_from));

  for (const line of inOrder) {
    const from = asDate(line.lived_from);
    const to = line.lived_to ? asDate(line.lived_to) : today;

    // A gap. Nothing after this can close it, because the list is in order.
    if (from > cursor) break;
    if (to > cursor) cursor = to;
  }

  return { covered: cursor >= today, reachedTo: cursor, needFrom };
}

export function monthYear(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function shortDate(iso: string): string {
  return asDate(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

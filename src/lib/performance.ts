// What a driver's scorecard week means, as arithmetic.
//
// Kept apart from the screen because none of it needs a phone: given two weeks
// of rows it decides the tier, the distance to the next one, which way each
// metric moved, and which one moved worst. The screen only draws the answers.
//
// Nothing here invents a standard. The tier bands come from the row itself
// (thresholds_used, written at import), the weights come from the row
// (weights_used), and "better" or "worse" for a metric is only ever the
// direction the number moved -- never a judgement about what a good number is.

export type Thresholds = {
  fantastic_plus: number;
  fantastic: number;
  great: number;
  fair: number;
};

export type Tier = "Fantastic_Plus" | "Fantastic" | "Great" | "Fair" | "Poor";

export const TIER_LABEL: Record<Tier, string> = {
  Fantastic_Plus: "Fantastic+",
  Fantastic: "Fantastic",
  Great: "Great",
  Fair: "Fair",
  Poor: "Poor",
};

/** Ordered worst to best, which is the order they are drawn along the bar. */
export const TIER_ORDER: Tier[] = ["Poor", "Fair", "Great", "Fantastic", "Fantastic_Plus"];

export function tierFor(score: number | null, t: Thresholds | null): Tier | null {
  if (score == null || !t) return null;
  if (score >= t.fantastic_plus) return "Fantastic_Plus";
  if (score >= t.fantastic) return "Fantastic";
  if (score >= t.great) return "Great";
  if (score >= t.fair) return "Fair";
  return "Poor";
}

/**
 * The next band up and what it would take to reach it.
 *
 * Null at the top, which the screen reads as "there is nothing above this"
 * rather than as missing data.
 */
export function nextTarget(
  score: number | null,
  t: Thresholds | null
): { tier: Tier; at: number; needed: number } | null {
  if (score == null || !t) return null;

  const bands: { tier: Tier; at: number }[] = [
    { tier: "Fair", at: t.fair },
    { tier: "Great", at: t.great },
    { tier: "Fantastic", at: t.fantastic },
    { tier: "Fantastic_Plus", at: t.fantastic_plus },
  ];

  for (const band of bands) {
    if (score < band.at) {
      return { tier: band.tier, at: band.at, needed: round1(band.at - score) };
    }
  }
  return null;
}

/** Where the boundaries sit along a 0-100 bar, for drawing the ticks. */
export function bandMarks(t: Thresholds | null): { tier: Tier; at: number }[] {
  if (!t) return [];
  return [
    { tier: "Fair", at: t.fair },
    { tier: "Great", at: t.great },
    { tier: "Fantastic", at: t.fantastic },
    { tier: "Fantastic_Plus", at: t.fantastic_plus },
  ].filter((b) => b.at > 0 && b.at < 100) as { tier: Tier; at: number }[];
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type MetricKey = "dcr" | "pod" | "cc" | "psb" | "dsc_dpmo" | "lor_dpmo" | "ce" | "cdf_dpmo" | "delivered";

export type MetricSpec = {
  key: MetricKey;
  /** The office's own wording. Not the metric's textbook name. */
  label: string;
  /** True where a smaller number is the better one -- DPMOs and event counts. */
  lowerIsBetter: boolean;
  unit: "percent" | "dpmo" | "count";
};

// The six the office shows a driver, in the order they appear on the screen.
// dcr and psb are labelled the way the office labels them, which is not what
// the acronyms stand for -- that is deliberate and it is their wording.
export const DRIVER_METRICS: MetricSpec[] = [
  { key: "dcr", label: "Return to Station", lowerIsBetter: false, unit: "percent" },
  { key: "pod", label: "Photo on Delivery", lowerIsBetter: false, unit: "percent" },
  { key: "cc", label: "Call Compliance", lowerIsBetter: false, unit: "percent" },
  { key: "psb", label: "Pickup Missed", lowerIsBetter: true, unit: "count" },
  { key: "dsc_dpmo", label: "DSC / Concessions", lowerIsBetter: true, unit: "dpmo" },
  { key: "delivered", label: "Delivered", lowerIsBetter: false, unit: "count" },
];

export type Direction = "improved" | "worsened" | "flat" | "unknown";

/**
 * Which way a metric moved, in the sense the driver cares about.
 *
 * A DPMO falling is an improvement; a percentage falling is not. That is the
 * only judgement made here, and it comes from the metric's own definition
 * rather than from any view about what the number ought to be.
 */
export function direction(
  current: number | null | undefined,
  previous: number | null | undefined,
  lowerIsBetter: boolean
): Direction {
  if (current == null || previous == null) return "unknown";
  const delta = current - previous;
  if (delta === 0) return "flat";
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return better ? "improved" : "worsened";
}

/** The raw movement, signed as the number itself moved. */
export function change(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null) return null;
  return round1(current - previous);
}

/**
 * The metric that went backwards hardest since last week.
 *
 * Only ever reports something that actually got worse -- there is no
 * "weakest metric" when every one of them improved, and saying otherwise
 * would turn a good week into a telling-off.
 */
export function focusArea<T extends Partial<Record<MetricKey, number | null>>>(
  current: T | undefined,
  previous: T | undefined,
  metrics: MetricSpec[] = DRIVER_METRICS
): { spec: MetricSpec; by: number } | null {
  if (!current || !previous) return null;

  const worsened = metrics
    .filter((m) => m.key !== "delivered")
    .map((m) => {
      const now = current[m.key];
      const before = previous[m.key];
      if (now == null || before == null) return null;
      // How far backwards, always positive.
      const backwards = m.lowerIsBetter ? now - before : before - now;
      return backwards > 0 ? { spec: m, by: round1(backwards) } : null;
    })
    .filter((x): x is { spec: MetricSpec; by: number } => x !== null)
    .sort((a, b) => b.by - a.by);

  return worsened[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

/** Mean position across the weeks that have one, to one decimal place. */
export function averageRank(ranks: (number | null | undefined)[]): number | null {
  const known = ranks.filter((r): r is number => typeof r === "number");
  if (known.length === 0) return null;
  return round1(known.reduce((sum, r) => sum + r, 0) / known.length);
}

/**
 * Places gained since last week. Positive is an improvement, because a rank
 * improving means the number going down -- the one place in this file where
 * the sign is deliberately flipped, and the reason it is named "gained".
 */
export function rankGained(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null) return null;
  return previous - current;
}

// ---------------------------------------------------------------------------
// How the score was built
// ---------------------------------------------------------------------------

/**
 * What a metric was worth in this week's score.
 *
 * Read off the row's own weights_used, so it answers "in the week you are
 * looking at" rather than "under today's settings". Null where the row never
 * recorded them, and the screen then says nothing rather than guessing.
 */
export function weightOf(
  weights: Record<string, number> | null | undefined,
  key: MetricKey
): number | null {
  if (!weights) return null;
  const value = weights[key];
  return typeof value === "number" ? value : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

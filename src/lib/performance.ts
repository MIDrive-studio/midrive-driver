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

// ---------------------------------------------------------------------------
// The year, and where each metric sits in it
// ---------------------------------------------------------------------------

/** All this file needs to know about a row to tally it. */
type ScoredWeek = {
  year: number;
  total_score: number | null;
  thresholds_used: Thresholds | null;
};

export type TierCount = { tier: Tier; weeks: number };

/**
 * How many weeks of one year landed in each tier.
 *
 * Every week is banded by its own recorded thresholds, not by this year's --
 * the same rule the weekly history table used, and the reason thresholds_used
 * is on the row at all. A tally that rebanded old weeks under new rules would
 * quietly rewrite a driver's year every time the office retuned the bands.
 *
 * Weeks with no score are counted by nobody: they are not a Poor week, and the
 * total says how many weeks the tally actually speaks for.
 */
export function tierTally(rows: ScoredWeek[], year: number): { counts: TierCount[]; scored: number } {
  const counts: Record<Tier, number> = {
    Fantastic_Plus: 0,
    Fantastic: 0,
    Great: 0,
    Fair: 0,
    Poor: 0,
  };
  let scored = 0;

  for (const row of rows) {
    if (row.year !== year) continue;
    const tier = tierFor(row.total_score, row.thresholds_used ?? null);
    if (!tier) continue;
    counts[tier] += 1;
    scored += 1;
  }

  // Best first, which is the order a driver reads their own year in.
  return {
    counts: [...TIER_ORDER].reverse().map((tier) => ({ tier, weeks: counts[tier] })),
    scored,
  };
}


// ---------------------------------------------------------------------------
// How much of a metric was earned
// ---------------------------------------------------------------------------
//
// A tile shows a number and no sense of whether it is a good one. "Good" here
// is not this app's opinion: every metric is banded by the office, and those
// bands are what build the total score in the first place -- a metric earns a
// percentage of the points it is worth, and the weighted sum of those is the
// score on the card above.
//
// So the colour is that percentage, and nothing else.
//
// WHERE THESE BANDS COME FROM, AND THE RISK IN THAT
//
// They are the admin portal's, copied out of lib/performance/scoring.ts by
// script rather than by hand. They are not on the row: the row carries
// weights_used and thresholds_used, so the app never has to guess what a week
// was judged against, but the per-metric bands were never written down beside
// them. That makes this the second copy of a business rule, which is the exact
// thing thresholds_used exists to prevent -- retune a band in the office and
// these colours drift out of agreement silently.
//
// The durable fix is one column: the earned percentage written onto the row at
// import, next to the weights and thresholds already frozen there. Until that
// exists, test:attainment locks these tables so a change to them is at least a
// deliberate one.

export function scoreDCR(v: number | null): number {
  if (v == null) return 100;
  if (v >= 100) return 100;
  if (v >= 99.8) return 90;
  if (v >= 99.7) return 80;
  if (v >= 99.6) return 70;
  if (v >= 99.4) return 60;
  if (v >= 99.19) return 50;
  if (v >= 98.9) return 40;
  if (v >= 98.69) return 30;
  if (v >= 98.5) return 20;
  return 0;
}
export function scoreDSC(v: number | null): number {
  if (v == null) return 100;
  if (v === 0) return 100;
  if (v < 500) return 75;
  if (v < 800) return 50;
  return 0;
}
export function scoreLOR(v: number | null): number {
  if (v == null) return 100;
  if (v === 0) return 100;
  if (v <= 5) return 50;
  return 0;
}
export function scorePOD(v: number | null): number {
  if (v == null) return 100;
  if (v >= 100) return 100;
  if (v >= 99.7) return 90;
  if (v >= 99.4) return 80;
  if (v >= 99.0) return 70;
  if (v >= 98.5) return 60;
  if (v >= 97.5) return 50;
  if (v >= 96.5) return 40;
  return 0;
}
export function scoreCC(v: number | null): number {
  if (v == null) return 100;
  if (v >= 100) return 100;
  if (v >= 99.5) return 90;
  if (v >= 99) return 80;
  if (v >= 98.5) return 70;
  if (v >= 97.5) return 60;
  if (v >= 96.5) return 50;
  if (v >= 95.5) return 40;
  if (v >= 94.5) return 20;
  return 0;
}
export function scoreCE(v: number | null): number {
  return v == null || v === 0 ? 100 : 0;
}
export function scoreCDF(v: number | null): number {
  if (v == null) return 100;
  if (v < 500) return 100;
  if (v < 800) return 90;
  if (v < 1000) return 80;
  if (v < 1500) return 70;
  if (v < 2000) return 60;
  if (v < 2500) return 50;
  if (v < 3000) return 40;
  if (v < 3500) return 30;
  if (v < 4000) return 20;
  if (v <= 4400) return 10;
  return 0;
}
export function scorePSB(v: number | null): number {
  if (v == null || v === 0) return 100;
  if (v >= 1 && v <= 3) return 50;
  return 0;
}

/** The band table for each metric. Delivered is absent: see below. */
const SCORE_BANDS: Partial<Record<MetricKey, (v: number | null) => number>> = {
  dcr: scoreDCR,
  dsc_dpmo: scoreDSC,
  lor_dpmo: scoreLOR,
  pod: scorePOD,
  cc: scoreCC,
  ce: scoreCE,
  cdf_dpmo: scoreCDF,
  psb: scorePSB,
};

/** Blue, yellow, red -- the office's own cut-offs, at 85 and 65. */
export type Attainment = { percent: number; band: "strong" | "watch" | "short" };

const STRONG_AT = 85;
const WATCH_AT = 65;

/**
 * The share of a metric's points the week earned, and which band that lands in.
 *
 * Null where there is nothing to colour, which is three different things and
 * all of them mean "say nothing" rather than "say zero":
 *
 *  - Delivered has no band table. It is a volume, and volume belongs to the
 *    route rather than the driver -- a light week is not a bad week. It also
 *    carries no points by default, so there is nothing to earn a share of.
 *  - A metric weighted at zero has no points available. A percentage of
 *    nothing is not a number, and the metric cannot move the score either way.
 *  - A missing value scores full marks by the office's rule, but "--" wearing
 *    the top colour reads as a result rather than as an absence.
 */
export function metricAttainment(
  key: MetricKey,
  value: number | null | undefined,
  weights: Record<string, number> | null | undefined
): Attainment | null {
  const band = SCORE_BANDS[key];
  if (!band || value == null) return null;

  // Only skip on a weight explicitly recorded as zero. A row that never
  // recorded its weights is not a row where nothing counted.
  if (weightOf(weights, key) === 0) return null;

  const percent = band(value);
  return {
    percent,
    band: percent >= STRONG_AT ? "strong" : percent >= WATCH_AT ? "watch" : "short",
  };
}

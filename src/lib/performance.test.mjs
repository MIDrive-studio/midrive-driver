// What the performance screen works out for itself, and what it refuses to.
//
// The band tables used to live here too, copied from the admin portal, and
// most of this file was an alarm on them drifting. They are gone: metric_scores
// arrives on the row now, written at import from the office's own bands, so
// there is nothing left in this app to drift.
//
// What remains worth proving is the part the app still decides -- where the
// colour cut-offs sit, and the four cases where it declines to colour anything
// at all rather than guessing.
//
// Run: npm run test:attainment

import { test } from "node:test";
import assert from "node:assert/strict";

import { metricAttainment, tierTally } from "./performance.ts";

// ---------------------------------------------------------------------------
// The colours
// ---------------------------------------------------------------------------

const WEIGHTS = { dcr: 10, pod: 10, cc: 10, psb: 5, dsc_dpmo: 15, delivered: 0 };

/** A row as the screen gets one: values, weights, and the stored breakdown. */
const row = (scores, values = {}, weights = WEIGHTS) => ({
  ...{ dcr: 99.5, pod: 99, cc: 98, psb: 1, dsc_dpmo: 400, delivered: 4210 },
  ...values,
  weights_used: weights,
  metric_scores: scores,
});

test("blue at 85, yellow at 65, red below", () => {
  assert.equal(metricAttainment("dcr", row({ dcr: 100 })).band, "strong");
  assert.equal(metricAttainment("dcr", row({ dcr: 90 })).band, "strong");
  assert.equal(metricAttainment("dcr", row({ dcr: 75 })).band, "watch");
  assert.equal(metricAttainment("dcr", row({ dcr: 50 })).band, "short");
  assert.equal(metricAttainment("dcr", row({ dcr: 0 })).band, "short");
});

test("the cut-offs themselves belong to the band above", () => {
  // Where an off-by-one would live.
  assert.equal(metricAttainment("dcr", row({ dcr: 85 })).band, "strong");
  assert.equal(metricAttainment("dcr", row({ dcr: 84.9 })).band, "watch");
  assert.equal(metricAttainment("dcr", row({ dcr: 65 })).band, "watch");
  assert.equal(metricAttainment("dcr", row({ dcr: 64.9 })).band, "short");
});

test("the percentage is the row's, never worked out here", () => {
  // A DCR of 99.5 scores 60% under the office's bands. If this app ever starts
  // computing its own answer again, this is where it shows up: the row says 12
  // and the tile must say 12.
  const earned = metricAttainment("dcr", row({ dcr: 12 }, { dcr: 99.5 }));
  assert.equal(earned.percent, 12);
  assert.equal(earned.band, "short");
});

test("nothing is coloured where there is nothing to colour", () => {
  // Delivered is a volume, and is not in the breakdown at all.
  assert.equal(metricAttainment("delivered", row({ dcr: 100 })), null);

  // A week imported before the column existed, and never backfilled. Working
  // one out from bands held in the app is what the column exists to stop.
  assert.equal(metricAttainment("dcr", row(null)), null);
  assert.equal(metricAttainment("dcr", { ...row({}), metric_scores: {} }), null);

  // A metric carrying no points has no points to earn a share of.
  assert.equal(metricAttainment("psb", row({ psb: 100 }, {}, { ...WEIGHTS, psb: 0 })), null);

  // A missing value scores full marks by the office's rule and the row says
  // 100 -- but "--" wearing the top colour reads as a result, not an absence.
  assert.equal(metricAttainment("dcr", row({ dcr: 100 }, { dcr: null })), null);

  // A row that never recorded its weights is not a row where nothing counted.
  assert.equal(metricAttainment("dcr", row({ dcr: 100 }, {}, null)).band, "strong");
});

// ---------------------------------------------------------------------------
// The year
// ---------------------------------------------------------------------------

const T2025 = { fantastic_plus: 94, fantastic: 85, great: 70, fair: 47 };
const T2026 = { fantastic_plus: 90, fantastic: 80, great: 65, fair: 40 };

test("each week is banded by its own thresholds, not this year's", () => {
  const rows = [
    { year: 2026, total_score: 86, thresholds_used: T2026 }, // Fantastic under 2026
    { year: 2026, total_score: 86, thresholds_used: T2025 }, // Fantastic under 2025 too
    { year: 2026, total_score: 82, thresholds_used: T2026 }, // Fantastic (80)
    { year: 2026, total_score: 82, thresholds_used: T2025 }, // Great (70) -- same score, older rules
  ];

  const { counts, scored } = tierTally(rows, 2026);
  const by = Object.fromEntries(counts.map((c) => [c.tier, c.weeks]));

  assert.equal(scored, 4);
  assert.equal(by.Fantastic, 3);
  assert.equal(by.Great, 1);
});

test("unscored weeks are counted by nobody, and other years are left alone", () => {
  const rows = [
    { year: 2026, total_score: 95, thresholds_used: T2026 },
    { year: 2026, total_score: null, thresholds_used: T2026 }, // no score
    { year: 2026, total_score: 95, thresholds_used: null }, // no bands to judge it by
    { year: 2025, total_score: 20, thresholds_used: T2025 }, // last year
  ];

  const { counts, scored } = tierTally(rows, 2026);
  const by = Object.fromEntries(counts.map((c) => [c.tier, c.weeks]));

  assert.equal(scored, 1, "only the one week that could be banded");
  assert.equal(by.Fantastic_Plus, 1);
  assert.equal(by.Poor, 0, "last year's Poor week must not leak in");
});

test("the tiers come back best first", () => {
  const { counts } = tierTally([], 2026);
  assert.deepEqual(
    counts.map((c) => c.tier),
    ["Fantastic_Plus", "Fantastic", "Great", "Fair", "Poor"]
  );
});

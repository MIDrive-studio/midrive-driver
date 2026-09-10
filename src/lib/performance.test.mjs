// The band tables, locked.
//
// metricAttainment colours a metric by the share of its points the week
// earned, and those bands are the admin portal's -- copied out of
// midrive-v2/lib/performance/scoring.ts because they are not written onto the
// row the way weights_used and thresholds_used are. That makes them a second
// copy of a business rule, and second copies drift.
//
// This file is the alarm. Every boundary is written out longhand, so retuning
// a band in the phone fails here and has to be done on purpose. And where the
// portal happens to be checked out beside this repo, the two tables are
// compared character by character, which catches the drift that matters: the
// office moving a band and nobody moving it here.
//
// Run: npm run test:attainment

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  metricAttainment,
  scoreCC,
  scoreCDF,
  scoreCE,
  scoreDCR,
  scoreDSC,
  scoreLOR,
  scorePOD,
  scorePSB,
  tierTally,
} from "./performance.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Every boundary of every table, as [input, expected percentage].
const BANDS = {
  dcr: [
    [null, 100], [100, 100], [99.8, 90], [99.7, 80], [99.6, 70], [99.4, 60],
    [99.19, 50], [98.9, 40], [98.69, 30], [98.5, 20], [98.49, 0],
  ],
  dsc: [[null, 100], [0, 100], [499, 75], [500, 50], [799, 50], [800, 0]],
  lor: [[null, 100], [0, 100], [5, 50], [6, 0]],
  pod: [
    [null, 100], [100, 100], [99.7, 90], [99.4, 80], [99, 70], [98.5, 60],
    [97.5, 50], [96.5, 40], [96.4, 0],
  ],
  cc: [
    [null, 100], [100, 100], [99.5, 90], [99, 80], [98.5, 70], [97.5, 60],
    [96.5, 50], [95.5, 40], [94.5, 20], [94.4, 0],
  ],
  ce: [[null, 100], [0, 100], [1, 0]],
  cdf: [
    [null, 100], [499, 100], [500, 90], [800, 80], [1000, 70], [1500, 60],
    [2000, 50], [2500, 40], [3000, 30], [3500, 20], [4000, 10], [4400, 10], [4401, 0],
  ],
  psb: [[null, 100], [0, 100], [1, 50], [3, 50], [4, 0]],
};

const FUNCTIONS = {
  dcr: scoreDCR, dsc: scoreDSC, lor: scoreLOR, pod: scorePOD,
  cc: scoreCC, ce: scoreCE, cdf: scoreCDF, psb: scorePSB,
};

for (const [name, cases] of Object.entries(BANDS)) {
  test(`${name} bands are unchanged`, () => {
    for (const [input, expected] of cases) {
      assert.equal(
        FUNCTIONS[name](input),
        expected,
        `${name}(${input}) should be ${expected}% of its points`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// The colours
// ---------------------------------------------------------------------------

const WEIGHTS = { dcr: 10, pod: 10, cc: 10, psb: 5, dsc_dpmo: 15, delivered: 0 };

test("blue at 85, yellow at 65, red below", () => {
  // 99.8 DCR earns 90%, 99.4 earns 60%, and 99.19 earns exactly 50.
  assert.equal(metricAttainment("dcr", 99.8, WEIGHTS).band, "strong");
  assert.equal(metricAttainment("dcr", 99.4, WEIGHTS).band, "short");

  // The cut-offs themselves, which is where an off-by-one would live: 85 and
  // 65 belong to the band above them.
  assert.equal(metricAttainment("cdf_dpmo", 500, { cdf_dpmo: 10 }).band, "strong"); // 90
  assert.equal(metricAttainment("dsc_dpmo", 499, WEIGHTS).band, "watch"); // 75
  assert.equal(metricAttainment("psb", 1, WEIGHTS).band, "short"); // 50
});

test("nothing is coloured where there is nothing to colour", () => {
  // Delivered is a volume, not a graded metric.
  assert.equal(metricAttainment("delivered", 4210, WEIGHTS), null);

  // A metric carrying no points has no points to earn a share of.
  assert.equal(metricAttainment("psb", 0, { ...WEIGHTS, psb: 0 }), null);

  // A missing value scores full marks by the office's rule, but "--" wearing
  // the top colour would read as a result rather than as an absence.
  assert.equal(metricAttainment("dcr", null, WEIGHTS), null);

  // A row that never recorded its weights is not a row where nothing counted.
  assert.equal(metricAttainment("dcr", 100, null).band, "strong");
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

// ---------------------------------------------------------------------------
// Drift against the portal
// ---------------------------------------------------------------------------

test("the band tables still match the admin portal", (t) => {
  const portal = resolve(here, "../../../midrive-v2/lib/performance/scoring.ts");

  if (!existsSync(portal)) {
    // The two repos are separate, so this only runs where both are checked
    // out. Skipping is honest; asserting nothing while pretending to check
    // would not be.
    t.skip("midrive-v2 is not checked out beside this repo");
    return;
  }

  // The two repos disagree about line endings and always have. That is not
  // drift in the bands.
  const table = (source) =>
    source
      .split(String.fromCharCode(13) + String.fromCharCode(10))
      .join(String.fromCharCode(10))
      .match(
        /export function score(?:DCR|DSC|LOR|POD|CC|CE|CDF|PSB)\([\s\S]*?\n}/g
      )
      ?.join(String.fromCharCode(10)) ?? "";

  const theirs = table(readFileSync(portal, "utf8"));
  const ours = table(readFileSync(resolve(here, "performance.ts"), "utf8"));

  assert.notEqual(theirs, "", "could not find the portal's score functions");
  assert.equal(
    ours,
    theirs,
    "The office's per-metric bands have moved and the phone still has the old ones. " +
      "Re-copy them, or better, put the earned percentage on the row at import."
  );
});

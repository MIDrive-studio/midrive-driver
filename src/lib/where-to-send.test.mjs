// Every combination of state this function can be given must come to rest
// somewhere, and it must be somewhere the driver can act. That is the promise
// the file itself makes, so this walks every combination to a fixed point
// rather than sampling a few scenarios by hand -- the deadlock this file's own
// history describes (two rules that each look right on their own, disagreeing
// forever) is exactly the failure a handful of hand-picked cases would miss.
//
// Run: node --import tsx --test src/lib/where-to-send.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { whereToSend } from "./where-to-send.ts";

const STATUSES = [null, "onboarding", "active", "offboarded"];
const PROFILE_STATUSES = [null, "pending", "completed"];
const SEGMENTS = [undefined, "login", "onboarding", "complete-profile", "documents-gate", "(tabs)", "accident"];
const BOOLS = [false, true];

const MAX_HOPS = 10;

/** Applies whereToSend repeatedly from one starting point until it settles. */
function settle(where) {
  let segment = where.segment;
  const path = [segment];

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const next = whereToSend({ ...where, segment });
    if (next === null) return { settled: true, at: segment, path };

    // A route like "/(tabs)/home" or "/documents-gate" -- the first segment is
    // what whereToSend itself reads next time round.
    segment = next.replace(/^\//, "").split("/")[0];
    path.push(segment);
  }

  return { settled: false, at: segment, path };
}

test("every combination reaches a fixed point within a few hops", () => {
  let checked = 0;

  for (const isSignedIn of BOOLS) {
    for (const status of STATUSES) {
      for (const profileStatus of PROFILE_STATUSES) {
        for (const segment of SEGMENTS) {
          for (const hasOutstandingDocuments of BOOLS) {
            checked += 1;
            const where = { isSignedIn, status, profileStatus, segment, hasOutstandingDocuments };
            const result = settle(where);

            assert.equal(
              result.settled,
              true,
              `never settled from ${JSON.stringify(where)} -- path was ${result.path.join(" -> ")}`
            );
          }
        }
      }
    }
  }

  assert.ok(checked > 0, "the combination loop ran");
});

test("signed out always ends at login", () => {
  for (const status of STATUSES) {
    for (const profileStatus of PROFILE_STATUSES) {
      for (const segment of SEGMENTS) {
        const result = settle({ isSignedIn: false, status, profileStatus, segment, hasOutstandingDocuments: false });
        assert.equal(result.at, "login");
      }
    }
  }
});

test("onboarding always ends at onboarding, whatever else is true", () => {
  for (const profileStatus of PROFILE_STATUSES) {
    for (const segment of SEGMENTS) {
      for (const hasOutstandingDocuments of BOOLS) {
        const result = settle({ isSignedIn: true, status: "onboarding", profileStatus, segment, hasOutstandingDocuments });
        assert.equal(result.at, "onboarding");
      }
    }
  }
});

test("an active driver with an incomplete profile always ends at complete-profile, even with a document outstanding", () => {
  for (const segment of SEGMENTS) {
    for (const hasOutstandingDocuments of BOOLS) {
      const result = settle({
        isSignedIn: true, status: "active", profileStatus: "pending", segment, hasOutstandingDocuments,
      });
      assert.equal(result.at, "complete-profile", "the profile gap is more basic and must be closed first");
    }
  }
});

test("an active driver with a complete profile and an outstanding document is gated, never tabs", () => {
  for (const segment of SEGMENTS) {
    const result = settle({
      isSignedIn: true, status: "active", profileStatus: "completed", segment, hasOutstandingDocuments: true,
    });
    assert.equal(result.at, "documents-gate");
  }
});

test("clearing the outstanding document sends the driver on to the tabs", () => {
  const result = settle({
    isSignedIn: true, status: "active", profileStatus: "completed", segment: "documents-gate", hasOutstandingDocuments: false,
  });
  assert.equal(result.at, "(tabs)");
});

test("an active driver with nothing outstanding and a complete profile reaches the tabs", () => {
  for (const segment of ["login", undefined]) {
    const result = settle({
      isSignedIn: true, status: "active", profileStatus: "completed", segment, hasOutstandingDocuments: false,
    });
    assert.equal(result.at, "(tabs)");
  }
});

test("an active driver already inside the app is left alone", () => {
  const result = settle({
    isSignedIn: true, status: "active", profileStatus: "completed", segment: "accident", hasOutstandingDocuments: false,
  });
  assert.equal(result.at, "accident", "whereToSend must not move a driver who is not on a redirect-worthy screen");
});

test("offboarded is not specially handled -- it reaches the same rest points active does", () => {
  // Documented behaviour rather than an assumption: this file has no rule
  // naming 'offboarded' at all, so an offboarded driver is treated exactly
  // like an active one by every rule below the onboarding check. If that is
  // wrong, it is wrong on purpose somewhere else (session revocation, most
  // likely) and not something this function is asked to prevent.
  const withDoc = settle({
    isSignedIn: true, status: "offboarded", profileStatus: "completed", segment: undefined, hasOutstandingDocuments: true,
  });
  assert.equal(withDoc.at, "documents-gate");

  const clean = settle({
    isSignedIn: true, status: "offboarded", profileStatus: "completed", segment: undefined, hasOutstandingDocuments: false,
  });
  assert.equal(clean.at, "(tabs)");
});

// The one thing this session's "fix it properly this time" actually needs
// proven, not just reasoned about: a driver who has genuinely finished their
// walk-around and pressed Submit must get a shift, however many of the nine
// photos have actually reached the server yet. That guarantee lives entirely
// in classifyShiftRpcError()'s verdict on "That vehicle check is not
// finished yet." -- so this is what's actually under test, exhaustively,
// against the real exception text start_shift()/end_shift() raise (migration
// 20261007000001), not a paraphrase of it.
//
// Run: node --import tsx --test src/lib/shift-rpc-classify.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyShiftRpcError } from "./shift-rpc-classify.ts";

test("the inspection-not-finished rejection is a retry, not a refusal", () => {
  assert.equal(classifyShiftRpcError("That vehicle check is not finished yet."), "retry");
});

test("every other known rejection from start_shift/end_shift is final", () => {
  const knownFinal = [
    "Only a driver can start a shift.",
    "Only a driver can end a shift.",
    "That vehicle check was not found.",
    "That shift was not found.",
    "A shift is already open. End it before starting another.",
    "This vehicle check has already started a shift. Do another vehicle check to start a new one.",
  ];

  for (const message of knownFinal) {
    assert.equal(classifyShiftRpcError(message), "final", `expected "${message}" to be final`);
  }
});

test("a message this has never seen before defaults to final, not retry", () => {
  // The safe default: a brand new rejection the SQL side added without this
  // file being updated must never silently become something that's retried
  // forever. Missing a new message should cost one extra error shown to a
  // driver, not a shift that can never be refused.
  assert.equal(classifyShiftRpcError("Some future rejection nobody has written yet."), "final");
});

test("Postgres wraps the raised message but the substring still matches", () => {
  // supabase-js's error.message is whatever Postgres sends back for a raised
  // exception, which in practice is the exact text after `raise exception`
  // -- but this only has to contain it, not equal it, so a prefix Postgres
  // adds (or a future one) doesn't silently break the match.
  assert.equal(classifyShiftRpcError("That vehicle check is not finished yet."), "retry");
  assert.equal(
    classifyShiftRpcError("P0001: That vehicle check is not finished yet. (SQLSTATE P0001)"),
    "retry"
  );
});

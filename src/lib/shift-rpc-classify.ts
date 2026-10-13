// Which of start_shift()/end_shift()'s own rejections are genuinely final,
// and which just mean "the walk-around hasn't fully reached the server yet,
// ask again once it has."
//
// Pulled out of location.ts on its own because that file can't be unit
// tested directly -- it imports expo-location, expo-task-manager and
// AsyncStorage, none of which exist outside a phone. This one decision,
// though, is pure text in and a verdict out, so it's tested exhaustively
// here (shift-rpc-classify.test.mjs) rather than only reasoned about by
// reading location.ts and trusting it stays right.
//
// Every message below is copied verbatim from the exceptions start_shift()
// and end_shift() actually raise (migration 20261007000001). If that
// migration's wording changes, this list has to change with it -- the test
// file is what catches the drift, not a shared constant, because the SQL
// side has no equivalent of "import this string from TypeScript."

/** Genuinely nothing to retry: the server looked at this and the answer is no. */
const FINAL_REJECTIONS = [
  "Only a driver can start a shift.",
  "Only a driver can end a shift.",
  "That vehicle check was not found.",
  "That shift was not found.",
  "A shift is already open. End it before starting another.",
  "This vehicle check has already started a shift. Do another vehicle check to start a new one.",
] as const;

/**
 * The one rejection that is actually a timing problem, not a refusal: the
 * inspection row exists and belongs to this driver, its photos just haven't
 * all reached the server yet. A driver who finished their walk-around on bad
 * signal gets exactly this the instant their check tries to auto-start a
 * shift -- treating it as final would mean the walk-around they just
 * finished still blocks their day on signal, which is the one thing this
 * whole mechanism exists to avoid.
 */
const NOT_FINISHED_YET = "not finished yet";

export type ShiftRpcVerdict = "retry" | "final";

/**
 * Classifies a Postgres exception's message from start_shift()/end_shift().
 *
 * Deliberately a denylist of the known-final messages, not an allowlist of
 * the known-retriable one: a message this has never seen before is treated
 * as final. A new kind of rejection silently becoming "retry forever" the
 * moment someone adds it to the SQL, without this file being told, is a
 * worse failure than a driver seeing one extra error message that turns out
 * to have been retriable after all.
 */
export function classifyShiftRpcError(message: string): ShiftRpcVerdict {
  if (message.includes(NOT_FINISHED_YET)) return "retry";
  if (FINAL_REJECTIONS.some((known) => message.includes(known))) return "final";

  // Not one of the messages this has ever been told about. Final is the
  // safe default -- see the comment above.
  return "final";
}

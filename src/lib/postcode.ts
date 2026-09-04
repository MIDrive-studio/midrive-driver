// Postcodes, as somebody types one.
//
// The space in a UK postcode is not decoration and not guesswork: the inward
// code is always the last three characters, so the space goes before them and
// nowhere else. That rule is fixed by Royal Mail and does not need a lookup,
// which is why it can be applied on the keyboard's own timing rather than the
// network's.
//
// The server normalises again when it answers, and what gets stored is what
// the server returned. This exists so the field reads correctly while it is
// being filled in, not to decide anything.

/** Enough to reject nonsense, not enough to reject a real one. Matches the server. */
const COMPLETE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/**
 * What to show in the field after each keystroke.
 *
 * Deliberately forgiving while it is short: "NN1" is a postcode somebody is
 * halfway through typing, not an error, and reformatting it under their
 * fingers would fight them. The space only appears once there is an inward
 * code to put it in front of.
 */
export function formatAsTyped(raw: string): string {
  const bare = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  if (bare.length <= 3) return bare;
  return `${bare.slice(0, -3)} ${bare.slice(-3)}`;
}

/** Whether this is worth asking the server about. */
export function isComplete(value: string): boolean {
  return COMPLETE.test(value.trim());
}

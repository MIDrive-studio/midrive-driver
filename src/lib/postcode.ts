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
 * The space goes in only once the postcode is complete, and that is not
 * fussiness. The inward code is always three characters but the outward code
 * is two to four, so until the whole thing is there you cannot know where the
 * split falls. Splitting anyway put "NN 14L" on screen while somebody was
 * typing NN1 4LN -- the space landing after the wrong letter and jumping when
 * the next one arrived.
 *
 * So it stays unspaced while it is being typed, which is how people type them
 * anyway, and formats itself the moment it is a postcode.
 */
export function formatAsTyped(raw: string): string {
  const bare = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  if (!COMPLETE.test(bare)) return bare;
  return `${bare.slice(0, -3)} ${bare.slice(-3)}`;
}

/** Whether this is worth asking the server about. */
export function isComplete(value: string): boolean {
  return COMPLETE.test(value.trim());
}

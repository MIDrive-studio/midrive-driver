// What a walk-around's status means, kept apart from the rest of inspection.ts
// because that module reaches for the camera and the filesystem and this does
// not. These are three pure questions about a string, and separating them is
// what lets them be tested without a phone.

/**
 * Whether a check was handed over, as opposed to abandoned part-way.
 *
 * A rejected check counts. It was photographed, submitted and reviewed; the
 * office sending it back is something that happened to it afterwards, not a
 * sign it never arrived.
 */
export function wasHandedOver(check: { status: string }): boolean {
  return [
    "submitted", "processing", "analysed", "requires_review", "approved", "rejected",
  ].includes(check.status);
}

/** Sent back by the office. The driver has to do it again. */
export function wasRejected(check: { status: string }): boolean {
  return check.status === "rejected";
}

/**
 * Whether a check settles the day's obligation.
 *
 * A rejected one does not -- it has to be done again -- which is why this is
 * not the same question as wasHandedOver above. The two were a single predicate
 * until it turned out they disagree about exactly one status, and that the
 * disagreement was hiding rejections from the driver completely: every list on
 * the vehicle-check screen filtered on this one, so a check the office sent
 * back simply vanished.
 */
export function isSubmitted(check: { status: string }): boolean {
  return wasHandedOver(check) && !wasRejected(check);
}

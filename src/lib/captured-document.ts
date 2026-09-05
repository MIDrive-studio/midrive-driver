import type { PickedPhoto } from "./document-upload";

// Handing a photograph back from the camera screen to the screen that asked
// for it.
//
// expo-router navigates, it does not return values, and a file URI is too long
// and too ugly to push through a route parameter. So the camera leaves the
// photograph here and goes back, and the screen that opened it collects it when
// it regains focus.
//
// Taken rather than read: collecting clears it, so the same photograph cannot
// be picked up twice by a screen that happens to regain focus again. A camera
// opened and abandoned leaves nothing behind.

type Waiting = { side: "front" | "back"; photo: PickedPhoto };

let waiting: Waiting | null = null;

export function leaveCapturedDocument(side: "front" | "back", photo: PickedPhoto) {
  waiting = { side, photo };
}

/** The photograph, once. Null if there is none, or it has already been taken. */
export function takeCapturedDocument(): Waiting | null {
  const held = waiting;
  waiting = null;
  return held;
}

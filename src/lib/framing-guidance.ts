import { useEffect, useState } from "react";
import { Accelerometer } from "expo-sensors";

// Live guidance while the camera is open, and an honest account of what it can
// and cannot tell you.
//
// The brief asks for computer vision here: is the van too far away, too close,
// at the wrong angle, half out of frame. That needs an object detector running
// on the preview stream, and nothing in an Expo managed app can do it --
// expo-camera hands you a preview and a shutter, not frames. Doing it properly
// means react-native-vision-camera with a frame processor and an on-device
// model, which needs a custom native build and is a piece of work in its own
// right.
//
// So this measures the one thing the phone genuinely knows: how it is being
// held. That is not a consolation prize. Pitch is the single biggest source of
// day-to-day inconsistency between two photographs of the same van -- one
// morning shot from hip height looking up, the next from chest height looking
// down, and the same panel is a different shape in each. Holding the phone
// upright is the instruction that most improves comparability, and it is the
// one that can be checked for free.
//
// Everything else is done by the outline, which is what the driver is really
// steering by, and by the quality check after capture.
//
// The interface is deliberately shaped so a real detector can replace the
// guts of this without the camera screen changing: it returns a state and a
// message, and knows nothing about where they came from.

export type FramingState = "ready" | "tilt_down" | "tilt_up" | "rolled" | "unknown";

export type Guidance = {
  state: FramingState;
  message: string;
  ok: boolean;
};

const MESSAGES: Record<FramingState, string> = {
  ready: "Line the van up with the outline",
  tilt_down: "Hold the phone more upright",
  tilt_up: "Hold the phone more upright",
  rolled: "Straighten the phone up",
  unknown: "Line the van up with the outline",
};

// Held upright in portrait, gravity sits almost entirely on the y axis. Pitch
// is how far the phone is tipped forward or back from that; roll is how far it
// is twisted.
//
// The tolerances are wide on purpose. This is a person holding a phone in a
// yard, often in gloves, sometimes in the rain. A guide that turns red at four
// degrees off vertical is a guide that is red all the time, and a warning that
// is always on is not a warning.
const PITCH_TOLERANCE = 0.32;
const ROLL_TOLERANCE = 0.36;

export function useFramingGuidance(active: boolean): Guidance {
  const [state, setState] = useState<FramingState>("unknown");

  useEffect(() => {
    if (!active) {
      // "unknown" reads as fine, which is what the dashboard shot needs:
      // photographing an instrument cluster means holding the phone tilted
      // down over the wheel, and telling someone to hold it upright there
      // would be telling them to take a worse photograph.
      setState("unknown");
      return;
    }

    // Four readings a second. Enough to feel responsive when someone corrects
    // their grip, slow enough that the message is not flickering between two
    // states while a hand shakes.
    Accelerometer.setUpdateInterval(250);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // z is gravity along the axis out of the screen: near zero held upright,
      // near -1 pointing straight down at the ground.
      if (Math.abs(z) > PITCH_TOLERANCE) {
        setState(z < 0 ? "tilt_down" : "tilt_up");
        return;
      }

      // With the phone upright in portrait, y carries gravity and x should be
      // near zero. A large x means it has been twisted.
      if (Math.abs(x) > ROLL_TOLERANCE && Math.abs(y) > 0.4) {
        setState("rolled");
        return;
      }

      setState("ready");
    });

    return () => subscription.remove();
  }, [active]);

  return {
    state,
    message: MESSAGES[state],
    // "unknown" counts as fine. A phone with no accelerometer, or one that has
    // not reported yet, must never block someone from taking a photograph.
    ok: state === "ready" || state === "unknown",
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { availabilityState } from "@/lib/availability-state";
import type { AvailabilityStatusResponse } from "@/types/availability";

// How many days of availability the driver still owes an answer for.
//
// Lives here rather than in the tile because the tab bar needs it too. Without
// a badge on the tab, the only way to find out a request had arrived was to
// open the availability screen and look -- which is exactly the thing a driver
// has no reason to do until somebody tells them to.
//
// This is not a push notification. The app has none: there is no
// expo-notifications, no token storage and nothing server-side to send one, so
// a driver with the app closed still learns about a request when they next open
// it. What this fixes is that once they do open it, the app tells them.
//
// Rechecked when the app comes back to the foreground, because a driver who
// leaves it open in a pocket all morning would otherwise carry a stale count
// around all day.

const FOREGROUND_RECHECK_MS = 60_000;

export function usePendingAvailability(): number {
  const [pending, setPending] = useState(0);
  const lastChecked = useRef(0);

  const check = useCallback(async () => {
    lastChecked.current = Date.now();
    try {
      const { data } = await supabase.functions.invoke<AvailabilityStatusResponse>("availability-status");
      const result = data?.data;
      const state = availabilityState(result?.activeRequest, result?.mySubmissions);
      setPending(state.kind === "outstanding" ? state.remaining : 0);
    } catch {
      // A count that cannot be read is not a count of zero: leaving the badge
      // as it was is better than clearing a genuine one because the signal
      // dropped for a moment in a yard.
    }
  }, []);

  useEffect(() => {
    void check();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastChecked.current < FOREGROUND_RECHECK_MS) return;
      void check();
    });

    return () => subscription.remove();
  }, [check]);

  return pending;
}

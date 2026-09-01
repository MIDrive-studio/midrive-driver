import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { OnboardingState } from "@/types/onboarding";

// Reading where a driver has got to.
//
// driver_onboarding_state() is security definer and checks for itself that the
// caller is the driver in question, their own company's office, or the platform
// owner. So this passes the driver id and nothing else: there is no argument
// here that could be tampered with to see somebody else's onboarding.
//
// Every screen in the flow re-reads this after it saves, rather than assuming
// what its own save did. A screen that marked itself done locally would show a
// tick for a licence the office has not looked at yet.

/** Matches useDriver: long enough for a slow start, short enough to not read as dead. */
const STATE_TIMEOUT_MS = 8000;

export function useOnboarding(driverId: string | undefined) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!driverId) {
      setState(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const call = supabase.rpc("driver_onboarding_state", { p_driver_id: driverId });

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Loading your onboarding took too long.")), STATE_TIMEOUT_MS)
      );

      const { data, error: rpcError } = await Promise.race([call, timeout]);

      if (rpcError) {
        setState(null);
        setError(rpcError.message);
        return;
      }

      // The function reports "no such driver" in the body rather than by
      // raising, so a null check on data alone would read it as success.
      const payload = data as (OnboardingState & { error?: string }) | null;
      if (!payload || payload.error) {
        setState(null);
        setError(payload?.error ?? "Couldn't load your onboarding.");
        return;
      }

      setState(payload);
      setError(null);
    } catch (cause) {
      setState(null);
      setError(cause instanceof Error ? cause.message : "Couldn't load your onboarding.");
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { state, loading, error, reload };
}

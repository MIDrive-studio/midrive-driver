import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Whether anyone is signed in.
//
// This used to be `getSession().then(...)` with no catch and no timeout, and a
// release build sat on the splash screen for half an hour because of it. The
// chain is short and unforgiving: `loading` starts true, the root layout holds
// the splash while it is true, and the only thing that set it false was that
// one `.then`. A promise that rejects, or simply never settles, therefore meant
// a permanently frozen app showing no message at all.
//
// The stall on that build could not be identified from outside: the device log
// showed the bundle running, the network reachable, and no JavaScript error
// whatsoever. Which is the thing actually worth fixing -- not the unknown
// stall, but that an unknown stall was indistinguishable from a hang, and left
// the driver looking at a logo.
//
// So this can no longer wait forever in silence. It settles one way or the
// other, and when it settles badly it says so somewhere a person can read it.

/** Long enough for a slow cold start, short enough that nobody assumes it is dead. */
const SESSION_TIMEOUT_MS = 8000;

export type SessionState = {
  session: Session | null;
  loading: boolean;
  /** Set when the session could not be read. The app still runs; sign-in decides the rest. */
  error: string | null;
};

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;

    // A timeout is treated as "not signed in" rather than as a failure to
    // start. Being sent to the login screen is a state a driver understands and
    // can act on; a frozen splash is neither.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      setError("Couldn't check your sign-in — this took longer than expected.");
      setLoading(false);
    }, SESSION_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        setError(cause instanceof Error ? cause.message : "Couldn't check your sign-in.");
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Also the way back from a timeout: if the session turns up late, take it
      // and drop the complaint about it having been slow.
      setSession(newSession);
      setError(null);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error };
}

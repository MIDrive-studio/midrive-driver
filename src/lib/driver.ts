import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Driver } from "@/types/driver";

/** Matches useSession: long enough for a slow start, short enough to not read as dead. */
const DRIVER_TIMEOUT_MS = 8000;

export function useDriver(userId: string | undefined) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setDriver(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Same hazard as useSession: this gates the splash screen, so a query that
    // throws or never settles leaves the app frozen on a logo with nothing
    // said. try/finally guarantees loading ends; the race guarantees it ends
    // within a time a person is willing to wait.
    try {
      const lookup = supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle();

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Loading your driver record took too long.")), DRIVER_TIMEOUT_MS)
      );

      const { data, error: fetchError } = await Promise.race([lookup, timeout]);

      setDriver(data as Driver | null);
      setError(fetchError?.message ?? null);
    } catch (cause) {
      setDriver(null);
      setError(cause instanceof Error ? cause.message : "Couldn't load your driver record.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { driver, loading, error, reload };
}

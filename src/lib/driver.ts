import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Driver } from "@/types/driver";

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
    const { data, error: fetchError } = await supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle();
    setDriver(data as Driver | null);
    setError(fetchError?.message ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { driver, loading, error, reload };
}

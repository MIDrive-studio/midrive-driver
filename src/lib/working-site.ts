import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/dates";

// Which site is this driver working at today?
//
// Not the same question as drivers.site_id. A driver loaned to another depot
// keeps their own site_id -- the loan lives in driver_loans -- so anything that
// happened *to* the driver on a date belongs to the loan destination, not the
// depot they are based at. Accidents and fuel stops are both of that kind: an
// accident on loan at DPE2 is DPE2's incident, and the fuel is DPE2's cost.
//
// The resolution is server-side so the app and the database cannot disagree,
// and the name comes back with it because the driver record carries only an id.

export type WorkingSite = {
  site_id: string;
  site_name: string | null;
  /** True when they are somewhere other than their own site, i.e. on loan. */
  on_loan: boolean;
};

export function useWorkingSite(driverId: string | undefined, date: string = todayISODate()) {
  const [site, setSite] = useState<WorkingSite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!driverId) {
        setSite(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase.rpc("my_working_site", { p_date: date });

      if (cancelled) return;

      // A failure here is not worth blocking on. The site is stated as a
      // courtesy; the database resolves it again on write regardless, so the
      // record lands on the right site whether or not this label appeared.
      const row = Array.isArray(data) ? (data[0] as WorkingSite | undefined) : undefined;
      setSite(row ?? null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [driverId, date]);

  return { site, loading };
}

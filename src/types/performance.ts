import type { Thresholds } from "@/lib/performance";

export type PerformanceWeeklyDriver = {
  id: string;
  driver_id: string | null;
  year: number;
  week_number: number;

  total_score: number | null;
  rating_tier: string | null;
  weekly_rank: number | null;

  // The metrics behind the score. Every one of these was already being fetched
  // by the screen and thrown away: it showed the total and nothing that made it.
  delivered: number | null;
  dcr: number | null;
  pod: number | null;
  cc: number | null;
  psb: number | null;
  dsc_dpmo: number | null;
  lor_dpmo: number | null;
  ce: number | null;
  cdf_dpmo: number | null;

  // The rules this row was judged against, written at import so a later change
  // in the office cannot redraw a week that has already been scored.
  weights_used: Record<string, number> | null;
  thresholds_used: Thresholds | null;
};

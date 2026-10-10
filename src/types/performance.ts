import type { Thresholds } from "@/lib/performance";

export type PerformanceWeeklyDriver = {
  id: string;
  driver_id: string | null;
  /** Which site's scorecard this row came from -- a driver who worked two
   *  sites in the same week has one row per site, not one row per week. */
  site_id: string;
  year: number;
  week_number: number;

  total_score: number | null;
  rating_tier: string | null;
  weekly_rank: number | null;

  // Which vendor actually covered this driver's van this week, read from
  // the rota -- never a toggle. The Mentor Score tile only ever appears for
  // "mentor"; everything else means nothing was reliably attributable, so
  // it stays hidden rather than showing a false zero.
  performance_source: "netradyne" | "mentor" | "mixed" | "unknown" | null;
  mentor_avg_fico: number | null;
  mentor_days_scored: number | null;

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
  /** What each metric earned, as a percentage of its own points. Written at
   *  import from the office's bands, which this app deliberately does not have. */
  metric_scores: Record<string, number> | null;
  thresholds_used: Thresholds | null;
};

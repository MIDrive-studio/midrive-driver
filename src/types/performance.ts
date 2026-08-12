export type PerformanceWeeklyDriver = {
  id: string;
  driver_id: string | null;
  year: number;
  week_number: number;
  delivered: number | null;
  dcr: number | null;
  total_score: number | null;
  rating_tier: string | null;
  weekly_rank: number | null;
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ScoreTrend } from "@/components/score-trend";
import {
  DRIVER_METRICS,
  TIER_LABEL,
  averageRank,
  bandMarks,
  change,
  direction,
  focusArea,
  metricAttainment,
  nextTarget,
  rankGained,
  tierFor,
  tierTally,
  weightOf,
  type Attainment,
  type Direction,
  type MetricKey,
  type MetricSpec,
  type Tier,
} from "@/lib/performance";
import type { PerformanceWeeklyDriver } from "@/types/performance";

const TIER_STYLE: Record<Tier, { chip: string; text: string; bar: string }> = {
  Fantastic_Plus: { chip: "bg-sky-400", text: "text-white", bar: "#38bdf8" },
  Fantastic: { chip: "bg-blue-700", text: "text-white", bar: "#1d4ed8" },
  Great: { chip: "bg-green-500", text: "text-white", bar: "#22c55e" },
  Fair: { chip: "bg-orange-400", text: "text-white", bar: "#fb923c" },
  Poor: { chip: "bg-red-600", text: "text-white", bar: "#dc2626" },
};

/**
 * How many weeks are fetched.
 *
 * Wide enough to hold a whole year of tiers plus the tail of the year before,
 * so week 1 still has a week before it to compare against. Two years of rows
 * for one driver is a small read; a year missing its first weeks because the
 * fetch stopped at twelve is a wrong answer.
 */
const HISTORY_WINDOW = 120;

/** How far back the average rank and the trend line look. */
const RANK_WINDOW = 12;

/**
 * The three colours a metric can wear, and where the cut-offs sit.
 *
 * The band is the share of that metric's points the week earned -- see
 * metricAttainment. Colour is never the only thing saying it: every tile
 * carries the same figure in words underneath.
 */
const ATTAINMENT_STYLE: Record<Attainment["band"], { border: string; dot: string; text: string }> = {
  strong: { border: "border-blue-300", dot: "bg-blue-600", text: "text-blue-700" },
  watch: { border: "border-amber-300", dot: "bg-amber-500", text: "text-amber-700" },
  short: { border: "border-red-300", dot: "bg-red-500", text: "text-red-600" },
};

/** The tier bar, in points. Fixed so nothing has to resolve a percentage height. */
const BAR_HEIGHT = 12;

function formatMetric(value: number | null | undefined, spec: MetricSpec): string {
  if (value == null) return "--";
  if (spec.unit === "percent") return `${value}%`;
  if (spec.unit === "count") return String(Math.round(value));
  return String(value);
}

export default function PerformanceScreen() {
  const { driver } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<PerformanceWeeklyDriver[]>([]);
  const [bonus, setBonus] = useState<{ earned: number; gross: number } | null>(null);
  const [openMetric, setOpenMetric] = useState<MetricSpec | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setLoadError(null);

    const [scores, pay] = await Promise.all([
      supabase
        .from("performance_weekly_driver")
        .select("*")
        .eq("driver_id", driver.id)
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(HISTORY_WINDOW),
      // Bonuses are pay rather than performance, but they answer "did the score
      // do anything for me", which is the question this screen exists for.
      supabase
        .from("payroll_weekly_driver")
        .select("additional_amount, gross_pay")
        .eq("driver_id", driver.id),
    ]);

    if (scores.error) {
      setLoadError("Couldn't load your performance data. Check your connection and try again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setWeeks((scores.data as PerformanceWeeklyDriver[]) ?? []);

    // A failed pay read is not worth losing the whole screen over. The bonus
    // card just does not appear, which is also what happens when there is no
    // bonus -- and the payroll tab is where that failure belongs.
    if (!pay.error) {
      const rows = (pay.data ?? []) as { additional_amount: number | null; gross_pay: number | null }[];
      setBonus({
        earned: rows.reduce((sum, r) => sum + Math.max(0, Number(r.additional_amount) || 0), 0),
        gross: rows.reduce((sum, r) => sum + (Number(r.gross_pay) || 0), 0),
      });
    }

    setLoading(false);
    setRefreshing(false);
  }, [driver]);

  useEffect(() => {
    load();
  }, [load]);

  const current = weeks[0];
  const previous = weeks[1];

  const thresholds = current?.thresholds_used ?? null;
  const tier = tierFor(current?.total_score ?? null, thresholds);
  const target = nextTarget(current?.total_score ?? null, thresholds);
  const bands = bandMarks(thresholds);
  const scoreChange = change(current?.total_score, previous?.total_score);

  // Rank and the trend line still speak for the recent run rather than for the
  // whole fetch: "average rank across 84 weeks" is a different claim from the
  // one this card has always made, and not one a driver asked for.
  const recent = useMemo(() => weeks.slice(0, RANK_WINDOW), [weeks]);

  const avgRank = useMemo(() => averageRank(recent.map((w) => w.weekly_rank)), [recent]);
  const rankedWeeks = recent.filter((w) => w.weekly_rank != null).length;
  const gained = rankGained(current?.weekly_rank, previous?.weekly_rank);
  const focus = focusArea(current, previous);

  // Oldest first, which is the direction a trend is read in.
  const trend = useMemo(
    () =>
      [...recent]
        .reverse()
        .filter((w) => w.total_score != null)
        .map((w) => ({ label: `W${w.week_number}`, score: Number(w.total_score) })),
    [recent]
  );

  // The year the latest row belongs to, rather than the calendar year -- a
  // driver opening this in January wants the year they have rows for, not an
  // empty card headed with today's date.
  const year = useMemo(() => (current ? tierTally(weeks, current.year) : null), [weeks, current]);

  const attainment = useMemo(() => {
    const out: Partial<Record<MetricKey, Attainment | null>> = {};
    if (current) {
      for (const spec of DRIVER_METRICS) {
        out[spec.key] = metricAttainment(spec.key, current);
      }
    }
    return out;
  }, [current]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Feather name="alert-triangle" size={22} color="#dc2626" />
        <Text className="mt-3 text-center text-sm font-semibold text-red-700">{loadError}</Text>
        <Pressable onPress={() => { setLoading(true); load(); }} className="mt-4 rounded-lg bg-slate-900 px-4 py-2">
          <Text className="text-sm font-semibold text-white">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-5 py-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text className="text-2xl font-bold text-slate-900">My Performance</Text>
        {driver?.full_name ? <Text className="mb-4 text-sm text-slate-500">{driver.full_name}</Text> : <View className="mb-4" />}

        {!current ? (
          <View className="mt-2 items-center rounded-xl border border-slate-200 bg-white py-12">
            <Text className="text-sm font-medium text-slate-500">No performance data yet.</Text>
            <Text className="mt-1 text-xs text-slate-400">Check back after your first scored week.</Text>
          </View>
        ) : (
          <>
            {/* -------------------------------------------------------- */}
            {/* The week itself                                          */}
            {/* -------------------------------------------------------- */}
            <View className="mb-4 overflow-hidden rounded-2xl bg-slate-900 p-5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Current week · W{current.week_number} {current.year}
              </Text>

              <View className="mt-2 flex-row items-end justify-between">
                <View>
                  <Text className="text-5xl font-bold text-white">
                    {current.total_score?.toFixed(1) ?? "--"}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-400">Total score</Text>
                </View>

                <View className="items-end">
                  {tier && (
                    <View className={`rounded-full px-3 py-1 ${TIER_STYLE[tier].chip}`}>
                      <Text className={`text-sm font-bold ${TIER_STYLE[tier].text}`}>{TIER_LABEL[tier]}</Text>
                    </View>
                  )}
                  {scoreChange !== null && (
                    <Text className={`mt-2 text-base font-bold ${scoreChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {scoreChange >= 0 ? "+" : ""}{scoreChange.toFixed(1)} vs last week
                    </Text>
                  )}
                </View>
              </View>

              {/* Bands are drawn only when the row recorded what they were.
                  Without them the bar would be a guess wearing a ruler. */}
              {current.total_score != null && thresholds && (
                <View className="mt-4 rounded-xl bg-white/10 p-3">
                  {target ? (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: "#cbd5e1" }}>
                        Next: <Text style={{ fontWeight: "700", color: "#ffffff" }}>{TIER_LABEL[target.tier]}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: "#cbd5e1" }}>
                        need <Text style={{ fontWeight: "700", color: "#fcd34d" }}>+{target.needed.toFixed(1)}</Text>
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#fcd34d", marginBottom: 8 }}>
                      Top tier reached
                    </Text>
                  )}

                  {/* Geometry in plain styles, not classes. Mixing className with
                      an inline style on one element drops the class-driven
                      sizing, which turned a 12px bar into a blue shape the
                      height of the phone -- overflow-hidden went with it, so
                      nothing clipped it either. */}
                  <View
                    style={{
                      height: BAR_HEIGHT,
                      width: "100%",
                      borderRadius: BAR_HEIGHT / 2,
                      backgroundColor: "rgba(255,255,255,0.2)",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: BAR_HEIGHT,
                        width: `${Math.min(100, Math.max(0, current.total_score))}%`,
                        borderRadius: BAR_HEIGHT / 2,
                        backgroundColor: tier ? TIER_STYLE[tier].bar : "#94a3b8",
                      }}
                    />
                    {bands.map((b) => (
                      <View
                        key={b.at}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: `${b.at}%`,
                          height: BAR_HEIGHT,
                          width: 1,
                          backgroundColor: "rgba(255,255,255,0.55)",
                        }}
                      />
                    ))}
                  </View>

                  <View style={{ position: "relative", height: 16, marginTop: 6 }}>
                    {bands.map((b) => (
                      <Text
                        key={`l${b.at}`}
                        style={{
                          position: "absolute",
                          left: `${b.at}%`,
                          fontSize: 10,
                          color: "#94a3b8",
                          transform: [{ translateX: -8 }],
                        }}
                      >
                        {b.at}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* -------------------------------------------------------- */}
            {/* Rank                                                     */}
            {/* -------------------------------------------------------- */}
            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
                <Text className="text-xs text-slate-500">Rank this week</Text>
                {current.weekly_rank != null ? (
                  <>
                    <Text className="text-3xl font-bold text-slate-900">#{current.weekly_rank}</Text>
                    {gained != null && gained !== 0 ? (
                      <Text className={`mt-1 text-sm font-semibold ${gained > 0 ? "text-green-600" : "text-red-500"}`}>
                        {gained > 0 ? "▲" : "▼"} {Math.abs(gained)} vs last week
                      </Text>
                    ) : gained === 0 ? (
                      <Text className="mt-1 text-sm text-slate-400">No change</Text>
                    ) : (
                      <Text className="mt-1 text-xs text-slate-400">No previous week</Text>
                    )}
                    {previous?.weekly_rank != null && (
                      <Text className="mt-0.5 text-xs text-slate-400">Last week: #{previous.weekly_rank}</Text>
                    )}
                  </>
                ) : (
                  <Text className="text-3xl font-bold text-slate-300">--</Text>
                )}
              </View>

              <View className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
                <Text className="text-xs text-slate-500">Average rank</Text>
                {avgRank != null ? (
                  <>
                    <Text className="text-3xl font-bold text-slate-900">#{avgRank.toFixed(1)}</Text>
                    <Text className="mt-1 text-xs text-slate-400">
                      across {rankedWeeks} week{rankedWeeks === 1 ? "" : "s"}
                    </Text>
                  </>
                ) : (
                  <Text className="text-3xl font-bold text-slate-300">--</Text>
                )}
              </View>
            </View>

            {/* -------------------------------------------------------- */}
            {/* What went backwards                                      */}
            {/* -------------------------------------------------------- */}
            {focus && (
              <View className="mb-4 flex-row gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Feather name="alert-triangle" size={18} color="#d97706" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-amber-900">Focus area this week</Text>
                  <Text className="mt-0.5 text-sm text-amber-800">
                    <Text className="font-bold">{focus.spec.label}</Text> moved back by{" "}
                    <Text className="font-bold">{focus.by}</Text> since last week.
                  </Text>
                </View>
              </View>
            )}

            {/* -------------------------------------------------------- */}
            {/* Bonus                                                    */}
            {/* -------------------------------------------------------- */}
            {bonus && bonus.earned > 0 && (
              <View className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                <Text className="text-xs uppercase tracking-wider text-slate-500">Bonus earned</Text>
                <View className="mt-2 flex-row items-end justify-between">
                  <View>
                    <Text className="text-3xl font-bold text-green-600">£{bonus.earned.toFixed(2)}</Text>
                    <Text className="mt-1 text-xs text-slate-400">Across every recorded week</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-slate-500">Total gross pay</Text>
                    <Text className="text-lg font-bold text-slate-700">£{bonus.gross.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* -------------------------------------------------------- */}
            {/* The numbers the score is made of                         */}
            {/* -------------------------------------------------------- */}
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Key metrics</Text>
            <Text className="mb-2 text-xs text-slate-400">
              Colour and figure are the share of each metric&apos;s points you earned that week.
            </Text>
            <View className="mb-4 flex-row flex-wrap justify-between">
              {DRIVER_METRICS.map((spec) => {
                const now = current[spec.key] as number | null;
                const before = previous?.[spec.key] as number | null | undefined;
                const moved = direction(now, before, spec.lowerIsBetter);
                const delta = change(now, before);
                const earned = attainment[spec.key] ?? null;

                return (
                  <Pressable
                    key={spec.key}
                    onPress={() => setOpenMetric(spec)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${spec.label}, ${formatMetric(now, spec)}` +
                      (earned ? `, ${earned.percent}% of its points` : "")
                    }
                    className={`mb-2.5 rounded-xl border bg-white p-4 active:bg-slate-50 ${
                      earned ? ATTAINMENT_STYLE[earned.band].border : "border-slate-200"
                    }`}
                    style={{ width: "48.5%" }}
                  >
                    <Text className="text-xs leading-tight text-slate-500">{spec.label}</Text>
                    <Text className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(now, spec)}</Text>

                    {earned && (
                      <View className="mt-1 flex-row items-center gap-1.5">
                        <View className={`h-2 w-2 rounded-full ${ATTAINMENT_STYLE[earned.band].dot}`} />
                        <Text className={`text-xs font-semibold ${ATTAINMENT_STYLE[earned.band].text}`}>
                          {earned.percent}% of its points
                        </Text>
                      </View>
                    )}

                    {before != null && (
                      <Text className="mt-0.5 text-xs text-slate-400">Last week: {formatMetric(before, spec)}</Text>
                    )}

                    <MovementLine moved={moved} delta={delta} />
                  </Pressable>
                );
              })}
            </View>

            {/* -------------------------------------------------------- */}
            {/* Trend                                                    */}
            {/* -------------------------------------------------------- */}
            {trend.length > 1 && (
              <View className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                <Text className="mb-2 text-sm font-semibold text-slate-700">Score trend</Text>
                <ScoreTrend points={trend} bands={bands} />
              </View>
            )}

            {/* -------------------------------------------------------- */}
            {/* The year, tier by tier                                    */}
            {/* -------------------------------------------------------- */}
            {/* This replaced a week-by-week table. Twelve rows of rank and
                score answered "what happened in week 31", which is a question
                about one week rather than about a year. How many weeks were
                Fantastic is the shape of the year, and the trend above still
                carries the recent run week by week. */}
            {year && (
              <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <View className="flex-row items-baseline justify-between border-b border-slate-100 px-4 py-3">
                  <Text className="text-sm font-semibold text-slate-700">Your {current.year}</Text>
                  <Text className="text-xs text-slate-400">
                    {year.scored} scored week{year.scored === 1 ? "" : "s"}
                  </Text>
                </View>

                {year.scored === 0 ? (
                  <Text className="px-4 py-6 text-center text-sm text-slate-400">
                    No scored weeks in {current.year} yet.
                  </Text>
                ) : (
                  <View className="gap-3 px-4 py-4">
                    {year.counts.map(({ tier: rowTier, weeks: count }) => (
                      <View key={rowTier} className="flex-row items-center gap-3">
                        <View className="w-[76px]">
                          <View className={`self-start rounded-full px-2 py-0.5 ${TIER_STYLE[rowTier].chip}`}>
                            <Text className={`text-[10px] font-bold ${TIER_STYLE[rowTier].text}`}>
                              {TIER_LABEL[rowTier]}
                            </Text>
                          </View>
                        </View>

                        {/* Bar geometry in plain styles rather than classes,
                            for the same reason as the tier bar above. */}
                        <View
                          style={{
                            flex: 1,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: "#f1f5f9",
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              height: 10,
                              borderRadius: 5,
                              width: `${(count / year.scored) * 100}%`,
                              backgroundColor: TIER_STYLE[rowTier].bar,
                            }}
                          />
                        </View>

                        <Text
                          className={`w-7 text-right text-base font-bold ${
                            count > 0 ? "text-slate-900" : "text-slate-300"
                          }`}
                        >
                          {count}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <MetricDetail
        spec={openMetric}
        week={current}
        previous={previous}
        earned={openMetric ? (attainment[openMetric.key] ?? null) : null}
        onClose={() => setOpenMetric(null)}
      />
    </SafeAreaView>
  );
}

function MovementLine({ moved, delta }: { moved: Direction; delta: number | null }) {
  if (moved === "unknown") {
    return <Text className="mt-2 text-xs text-slate-300">No previous week</Text>;
  }
  if (moved === "flat") {
    return <Text className="mt-2 text-xs font-medium text-slate-400">No change</Text>;
  }

  const improving = moved === "improved";
  return (
    <Text className={`mt-2 text-xs font-semibold ${improving ? "text-green-600" : "text-red-500"}`}>
      {improving ? "▲" : "▼"} {delta != null ? Math.abs(delta) : ""} {improving ? "better" : "worse"}
    </Text>
  );
}

/**
 * What one metric is, in the only terms this app can honestly offer: the
 * driver's own number, last week's, and what the metric was worth in the score
 * for that week.
 *
 * There is deliberately no coaching copy here. What good looks like, and how to
 * improve it, are the office's words to write rather than this app's to invent;
 * a plausible-sounding target made up by software is worse than none at all.
 */
function MetricDetail({
  spec,
  week,
  previous,
  earned,
  onClose,
}: {
  spec: MetricSpec | null;
  week: PerformanceWeeklyDriver | undefined;
  previous: PerformanceWeeklyDriver | undefined;
  earned: Attainment | null;
  onClose: () => void;
}) {
  if (!spec || !week) return null;

  const now = week[spec.key] as number | null;
  const before = previous?.[spec.key] as number | null | undefined;
  const weight = weightOf(week.weights_used, spec.key);
  const moved = direction(now, before, spec.lowerIsBetter);
  const delta = change(now, before);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable className="rounded-t-2xl bg-white px-6 pb-10 pt-5" onPress={() => {}}>
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-slate-200" />

          <Text className="text-lg font-bold text-slate-900">{spec.label}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            Week {week.week_number}, {week.year}
            {spec.lowerIsBetter ? " · lower is better" : ""}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-xl border border-slate-200 p-4">
              <Text className="text-xs text-slate-500">This week</Text>
              <Text className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(now, spec)}</Text>
            </View>
            <View className="flex-1 rounded-xl border border-slate-200 p-4">
              <Text className="text-xs text-slate-500">Last week</Text>
              <Text className="mt-1 text-2xl font-bold text-slate-400">{formatMetric(before, spec)}</Text>
            </View>
          </View>

          {moved !== "unknown" && moved !== "flat" && (
            <Text className={`mt-3 text-sm font-semibold ${moved === "improved" ? "text-green-600" : "text-red-500"}`}>
              {moved === "improved" ? "▲" : "▼"} {delta != null ? Math.abs(delta) : ""}{" "}
              {moved === "improved" ? "better than last week" : "worse than last week"}
            </Text>
          )}

          {weight != null && (
            <View className="mt-4 rounded-xl bg-slate-50 p-4">
              <Text className="text-sm text-slate-700">
                This metric was worth <Text className="font-bold">{weight} points</Text> of your score that week.
              </Text>
              {earned && weight > 0 && (
                <Text className="mt-1 text-sm text-slate-700">
                  You earned{" "}
                  <Text className={`font-bold ${ATTAINMENT_STYLE[earned.band].text}`}>{earned.percent}%</Text> of
                  them, which is {((earned.percent / 100) * weight).toFixed(1)} points.
                </Text>
              )}
              {weight === 0 && (
                <Text className="mt-1 text-xs text-slate-500">
                  It is recorded but carries no points, so it does not move your total.
                </Text>
              )}
            </View>
          )}

          <Pressable onPress={onClose} className="mt-5 items-center rounded-xl bg-slate-900 py-3">
            <Text className="text-sm font-semibold text-white">Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

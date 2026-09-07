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
  nextTarget,
  rankGained,
  tierFor,
  weightOf,
  type Direction,
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

/** How many weeks are fetched, and so how far the average rank looks back. */
const RANK_WINDOW = 12;

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
        .limit(RANK_WINDOW),
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

  const avgRank = useMemo(() => averageRank(weeks.map((w) => w.weekly_rank)), [weeks]);
  const rankedWeeks = weeks.filter((w) => w.weekly_rank != null).length;
  const gained = rankGained(current?.weekly_rank, previous?.weekly_rank);
  const focus = focusArea(current, previous);

  // Oldest first, which is the direction a trend is read in.
  const trend = useMemo(
    () =>
      [...weeks]
        .reverse()
        .filter((w) => w.total_score != null)
        .map((w) => ({ label: `W${w.week_number}`, score: Number(w.total_score) })),
    [weeks]
  );

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
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="text-xs text-slate-300">
                        Next: <Text className="font-bold text-white">{TIER_LABEL[target.tier]}</Text>
                      </Text>
                      <Text className="text-xs text-slate-300">
                        need <Text className="font-bold text-amber-300">+{target.needed.toFixed(1)}</Text>
                      </Text>
                    </View>
                  ) : (
                    <Text className="mb-2 text-xs font-bold text-amber-300">Top tier reached</Text>
                  )}

                  <View className="relative h-3 w-full overflow-hidden rounded-full bg-white/20">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, current.total_score))}%`,
                        backgroundColor: tier ? TIER_STYLE[tier].bar : "#94a3b8",
                      }}
                    />
                    {bands.map((b) => (
                      <View
                        key={b.at}
                        className="absolute top-0 h-full w-px bg-white/50"
                        style={{ left: `${b.at}%` }}
                      />
                    ))}
                  </View>

                  <View className="relative mt-1.5 h-4">
                    {bands.map((b) => (
                      <Text
                        key={`l${b.at}`}
                        className="absolute text-[10px] text-slate-400"
                        style={{ left: `${b.at}%`, transform: [{ translateX: -8 }] }}
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
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Key metrics</Text>
            <View className="mb-4 flex-row flex-wrap justify-between">
              {DRIVER_METRICS.map((spec) => {
                const now = current[spec.key] as number | null;
                const before = previous?.[spec.key] as number | null | undefined;
                const moved = direction(now, before, spec.lowerIsBetter);
                const delta = change(now, before);

                return (
                  <Pressable
                    key={spec.key}
                    onPress={() => setOpenMetric(spec)}
                    accessibilityRole="button"
                    accessibilityLabel={`${spec.label}, ${formatMetric(now, spec)}`}
                    className="mb-2.5 rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
                    style={{ width: "48.5%" }}
                  >
                    <Text className="text-xs leading-tight text-slate-500">{spec.label}</Text>
                    <Text className="mt-1 text-2xl font-bold text-slate-900">{formatMetric(now, spec)}</Text>

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
            {/* Every week we hold                                       */}
            {/* -------------------------------------------------------- */}
            <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <View className="border-b border-slate-100 px-4 py-3">
                <Text className="text-sm font-semibold text-slate-700">Weekly history</Text>
              </View>

              <View className="flex-row border-b border-slate-100 bg-slate-50 px-4 py-2">
                <Text className="w-16 text-xs font-semibold text-slate-500">Week</Text>
                <Text className="w-12 text-xs font-semibold text-slate-500">Rank</Text>
                <Text className="w-14 text-xs font-semibold text-slate-500">Score</Text>
                <Text className="flex-1 text-xs font-semibold text-slate-500">Tier</Text>
              </View>

              {weeks.map((w) => {
                const rowTier = tierFor(w.total_score, w.thresholds_used ?? null);
                return (
                  <View key={w.id} className="flex-row items-center border-b border-slate-50 px-4 py-2.5">
                    <Text className="w-16 text-sm font-medium text-slate-700">W{w.week_number}</Text>
                    <Text className="w-12 text-sm text-slate-600">
                      {w.weekly_rank != null ? `#${w.weekly_rank}` : "--"}
                    </Text>
                    <Text className="w-14 text-sm font-bold text-slate-900">
                      {w.total_score?.toFixed(1) ?? "--"}
                    </Text>
                    <View className="flex-1 flex-row">
                      {rowTier ? (
                        <View className={`rounded-full px-2 py-0.5 ${TIER_STYLE[rowTier].chip}`}>
                          <Text className={`text-[10px] font-bold ${TIER_STYLE[rowTier].text}`}>
                            {TIER_LABEL[rowTier]}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-xs text-slate-400">--</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <MetricDetail
        spec={openMetric}
        week={current}
        previous={previous}
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
  onClose,
}: {
  spec: MetricSpec | null;
  week: PerformanceWeeklyDriver | undefined;
  previous: PerformanceWeeklyDriver | undefined;
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

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { PerformanceWeeklyDriver } from "@/types/performance";

export default function PerformanceScreen() {
  const { driver } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeks, setWeeks] = useState<PerformanceWeeklyDriver[]>([]);

  const load = useCallback(async () => {
    if (!driver) return;
    const { data } = await supabase
      .from("performance_weekly_driver")
      .select("*")
      .eq("driver_id", driver.id)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .limit(20);

    setWeeks((data as PerformanceWeeklyDriver[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [driver]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  const current = weeks[0];
  const history = weeks.slice(1);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-6 py-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text className="mb-4 text-2xl font-bold text-slate-900">Performance</Text>

        {!current ? (
          <Text className="text-slate-500">No performance data yet.</Text>
        ) : (
          <View className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Week {current.week_number} · {current.year}
            </Text>
            <Text className="mt-1 text-4xl font-bold text-slate-900">{current.total_score?.toFixed(1) ?? "--"}</Text>
            {current.rating_tier && (
              <Text className="mt-1 text-base font-semibold text-indigo-600">{current.rating_tier}</Text>
            )}
            {current.weekly_rank && (
              <Text className="mt-2 text-sm text-slate-500">Ranked #{current.weekly_rank} at your site this week</Text>
            )}
          </View>
        )}

        {history.length > 0 && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">History</Text>
            {history.map((w) => (
              <View key={w.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <Text className="font-medium text-slate-900">
                  Week {w.week_number} · {w.year}
                </Text>
                <View className="items-end">
                  <Text className="font-bold text-slate-900">{w.total_score?.toFixed(1) ?? "--"}</Text>
                  {w.rating_tier && <Text className="text-xs text-slate-500">{w.rating_tier}</Text>}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

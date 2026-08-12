import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { PerformanceWeeklyDriver } from "@/types/performance";

export default function PerformanceScreen() {
  const { driver } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<PerformanceWeeklyDriver[]>([]);

  const load = useCallback(async () => {
    if (!driver) return;
    setLoadError(null);
    const { data, error } = await supabase
      .from("performance_weekly_driver")
      .select("*")
      .eq("driver_id", driver.id)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .limit(20);

    if (error) {
      setLoadError("Couldn't load your performance data. Check your connection and try again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

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
          <View className="items-center rounded-xl border border-slate-200 bg-slate-50 py-8">
            <Text className="text-sm text-slate-500">No performance data yet.</Text>
          </View>
        ) : (
          <View className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <View className="bg-slate-900 px-5 py-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Week {current.week_number} · {current.year}
              </Text>
              <Text className="mt-1 text-4xl font-bold text-amber-400">{current.total_score?.toFixed(1) ?? "--"}</Text>
              {current.rating_tier && <Text className="mt-1 text-base font-semibold text-white">{current.rating_tier}</Text>}
            </View>
            {current.weekly_rank && (
              <View className="flex-row items-center gap-2 px-5 py-3">
                <Feather name="award" size={14} color="#f59e0b" />
                <Text className="text-sm text-slate-600">Ranked #{current.weekly_rank} at your site this week</Text>
              </View>
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

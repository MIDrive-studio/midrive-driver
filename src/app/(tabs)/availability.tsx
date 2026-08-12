import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { dateWindow, formatDayLabel } from "@/lib/dates";
import type { AvailabilityStatusResponse, AvailabilitySubmitResponse, AvailabilitySubmission, SubmissionInput } from "@/types/availability";

export default function AvailabilityScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [daysOffAvailableMap, setDaysOffAvailableMap] = useState<Record<string, number>>({});
  const [mySubmissions, setMySubmissions] = useState<AvailabilitySubmission[]>([]);
  const [pending, setPending] = useState<Record<string, "in" | "off">>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke<AvailabilityStatusResponse>("availability-status");

    if (invokeError) {
      setError(invokeError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const result = data?.data;
    if (!result?.activeRequest) {
      setRequestId(null);
      setDates([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const from = result.activeRequest.date_from;
    const to = result.activeRequest.date_to;
    const length = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;

    setRequestId(result.activeRequest.id);
    setDates(dateWindow(from, length));
    setDaysOffAvailableMap(result.daysOffAvailableMap);
    setMySubmissions(result.mySubmissions);
    setPending({});
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function submittedStatusFor(date: string) {
    return mySubmissions.find((s) => s.date === date)?.status ?? null;
  }

  async function handleSubmit() {
    if (!requestId) return;
    const submissions: SubmissionInput[] = Object.entries(pending).map(([date, status]) => ({ date, status }));
    if (submissions.length === 0) return;

    setSubmitting(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke<AvailabilitySubmitResponse>("availability-submit", {
      body: { requestId, submissions },
    });

    setSubmitting(false);

    if (invokeError) {
      setError(invokeError.message);
      return;
    }

    const rejected = data?.results.filter((r) => r.status === "rejected") ?? [];
    if (rejected.length > 0) {
      setError(`${rejected.length} date(s) could no longer be accepted -- capacity filled. Refreshing...`);
    }

    await load();
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-6 py-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text className="mb-1 text-2xl font-bold text-slate-900">Availability</Text>

        {error && (
          <View className="mb-4 rounded-lg bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        {!requestId ? (
          <Text className="mt-4 text-slate-500">There's no open availability request right now.</Text>
        ) : (
          <>
            <Text className="mb-4 text-slate-500">Tell us which days you're IN or OFF for this period.</Text>

            {dates.map((date) => {
              const submitted = submittedStatusFor(date);
              const choice = pending[date];
              const remaining = daysOffAvailableMap[date] ?? 0;
              const { weekday, dayMonth } = formatDayLabel(date);

              return (
                <View key={date} className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="font-semibold text-slate-900">
                      {weekday} {dayMonth}
                    </Text>
                    {!submitted && <Text className="text-xs text-slate-400">{remaining} OFF slot(s) left</Text>}
                  </View>

                  {submitted ? (
                    <Text className={`text-sm font-medium ${submitted === "off" ? "text-emerald-600" : "text-slate-600"}`}>
                      Submitted: {submitted === "off" ? "OFF" : "IN"}
                    </Text>
                  ) : (
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setPending((p) => ({ ...p, [date]: "in" }))}
                        className={`flex-1 items-center rounded-lg border py-2 ${choice === "in" ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={choice === "in" ? "font-semibold text-white" : "text-slate-700"}>IN</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPending((p) => ({ ...p, [date]: "off" }))}
                        disabled={remaining <= 0}
                        className={`flex-1 items-center rounded-lg border py-2 disabled:opacity-40 ${choice === "off" ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={choice === "off" ? "font-semibold text-white" : "text-slate-700"}>OFF</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting || Object.keys(pending).length === 0}
              className="mt-2 items-center rounded-lg bg-indigo-600 py-3 disabled:opacity-40"
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Submit</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

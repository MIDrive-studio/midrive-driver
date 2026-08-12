import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  const allSubmitted = requestId !== null && dates.length > 0 && dates.every((d) => !!submittedStatusFor(d));
  const anyPending = Object.keys(pending).length > 0;

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
          <View className="mt-6 items-center rounded-xl border border-slate-200 bg-white py-10">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Feather name="check-circle" size={22} color="#94a3b8" />
            </View>
            <Text className="text-sm font-semibold text-slate-700">No active availability request</Text>
            <Text className="mt-1 text-xs text-slate-400">Your admin hasn&apos;t opened a new request yet.</Text>
          </View>
        ) : (
          <>
            <Text className="mb-1 text-xs text-slate-400">Submissions are locked once sent.</Text>
            <Text className="mb-4 text-slate-500">Tell us which days you&apos;re IN or OFF for this period.</Text>

            {dates.map((date) => {
              const submitted = submittedStatusFor(date);
              const choice = pending[date];
              const remaining = daysOffAvailableMap[date] ?? 0;
              const offLimitReached = remaining <= 0;
              const { weekday, dayMonth } = formatDayLabel(date);
              const isLocked = !!submitted;

              return (
                <View key={date} className={`mb-3 rounded-lg border p-4 ${isLocked ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-white"}`}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="font-semibold text-slate-800">
                      {weekday} {dayMonth}
                    </Text>
                    {!isLocked && (
                      <Text className={`text-xs font-bold ${offLimitReached ? "text-red-600" : "text-slate-700"}`}>
                        Days Off Available: {remaining}
                      </Text>
                    )}
                  </View>

                  {isLocked ? (
                    <View className="flex-row items-center gap-1.5">
                      <Feather name="lock" size={12} color="#64748b" />
                      <Text className="text-xs text-slate-500">
                        Submitted: {submitted === "off" ? "OFF" : "IN"} -- changes are not allowed.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {offLimitReached && (
                        <View className="mb-2 flex-row items-center gap-1.5">
                          <Feather name="alert-circle" size={12} color="#dc2626" />
                          <Text className="text-xs font-medium text-red-600">Maximum days off reached for this day.</Text>
                        </View>
                      )}
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => setPending((p) => ({ ...p, [date]: "in" }))}
                          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border-2 py-2 ${
                            choice === "in" ? "border-green-600 bg-green-600" : "border-green-300 bg-white"
                          }`}
                        >
                          <Feather name="check-circle" size={14} color={choice === "in" ? "white" : "#15803d"} />
                          <Text className={`text-sm font-bold ${choice === "in" ? "text-white" : "text-green-700"}`}>IN</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setPending((p) => ({ ...p, [date]: "off" }))}
                          disabled={offLimitReached}
                          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border-2 py-2 disabled:opacity-40 ${
                            choice === "off" ? "border-red-600 bg-red-600" : "border-red-300 bg-white"
                          }`}
                        >
                          <Feather name="x-circle" size={14} color={choice === "off" ? "white" : "#b91c1c"} />
                          <Text className={`text-sm font-bold ${choice === "off" ? "text-white" : "text-red-700"}`}>OFF</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })}

            {allSubmitted ? (
              <View className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-green-50 py-2.5">
                <Feather name="check-circle" size={16} color="#15803d" />
                <Text className="text-sm font-medium text-green-700">All days submitted. Thank you!</Text>
              </View>
            ) : (
              <Pressable
                onPress={handleSubmit}
                disabled={submitting || !anyPending}
                className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 disabled:opacity-40"
              >
                {submitting ? <ActivityIndicator color="white" /> : <Feather name="send" size={16} color="white" />}
                <Text className="font-semibold text-white">{submitting ? "Submitting..." : "Submit Availability"}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

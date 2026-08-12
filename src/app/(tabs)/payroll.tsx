import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { todayISODate, weekOf, weekRangeLabel, startOfWeek, addDays } from "@/lib/dates";
import type { DriverPayslip, PayrollWeeklyDriver } from "@/types/payroll";

export default function PayrollScreen() {
  const { driver } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<PayrollWeeklyDriver | null>(null);
  const [payslips, setPayslips] = useState<DriverPayslip[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    const { year, week } = weekOf(todayISODate());

    const [weeklyRes, payslipsRes] = await Promise.all([
      supabase.from("payroll_weekly_driver").select("*").eq("driver_id", driver.id).eq("year", year).eq("week", week).maybeSingle(),
      supabase.from("driver_payslips").select("*").eq("driver_id", driver.id).order("year", { ascending: false }).order("week", { ascending: false }),
    ]);

    setCurrentWeek((weeklyRes.data as PayrollWeeklyDriver | null) ?? null);
    setPayslips((payslipsRes.data as DriverPayslip[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [driver]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPayslip(payslip: DriverPayslip) {
    if (!payslip.pdf_path) return;
    setOpeningId(payslip.id);
    const { data } = await supabase.storage.from("driver-payslips").createSignedUrl(payslip.pdf_path, 60);
    setOpeningId(null);
    if (data?.signedUrl) {
      await WebBrowser.openBrowserAsync(data.signedUrl);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  const start = startOfWeek(todayISODate());
  const weekLabel = weekRangeLabel(start, addDays(start, 6));

  const grossPay = currentWeek ? currentWeek.base_pay + currentWeek.stops_bonus + currentWeek.additional_amount : 0;
  const deductions = currentWeek?.deductions_amount ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="px-6 py-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View className="mb-3 flex-row items-center gap-2">
          <Feather name="trending-up" size={18} color="#f59e0b" />
          <Text className="text-lg font-bold text-slate-900">Current Week Earnings</Text>
        </View>
        <Text className="mb-3 text-xs text-slate-400">{weekLabel}</Text>

        <View className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <Text className="text-sm text-amber-700">Provisional -- final pay (after admin fee) will be confirmed in your payslip once approved.</Text>
        </View>

        {!currentWeek ? (
          <View className="mb-8 items-center rounded-xl border border-slate-200 bg-slate-50 py-8">
            <Text className="mb-1 text-3xl font-bold text-slate-300">£0.00</Text>
            <Text className="text-sm text-slate-500">No earnings recorded for this week yet.</Text>
          </View>
        ) : (
          <View className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <View className="flex-row flex-wrap">
              <StatCell label="Routes Completed" value={String(currentWeek.paid_routes_count)} />
              <StatCell label="Route Pay" value={`£${currentWeek.base_pay.toFixed(2)}`} />
              <StatCell
                label="Additions"
                value={currentWeek.additional_amount > 0 ? `+£${currentWeek.additional_amount.toFixed(2)}` : "£0.00"}
                tone={currentWeek.additional_amount > 0 ? "text-green-700" : "text-slate-300"}
              />
              <StatCell
                label="Deductions"
                value={deductions > 0 ? `-£${deductions.toFixed(2)}` : "£0.00"}
                tone={deductions > 0 ? "text-red-600" : "text-slate-300"}
              />
            </View>
            <View className="flex-row items-center justify-between border-t border-slate-200 bg-slate-900 px-5 py-4">
              <Text className="text-sm text-slate-400">Provisional Total</Text>
              <Text className="text-2xl font-bold text-amber-400">£{Math.max(0, grossPay - deductions).toFixed(2)}</Text>
            </View>
          </View>
        )}

        <View className="mb-3 flex-row items-center gap-2">
          <Feather name="check-circle" size={16} color="#16a34a" />
          <Text className="text-lg font-bold text-slate-900">Payslip History</Text>
        </View>

        {payslips.length === 0 ? (
          <View className="items-center rounded-xl border border-slate-200 bg-slate-50 py-8">
            <Text className="text-sm text-slate-500">No confirmed payslips yet.</Text>
          </View>
        ) : (
          payslips.map((payslip) => {
            const grossEarnings = payslip.gross_pay;
            const netPayable = payslip.net_pay;
            return (
              <View key={payslip.id} className="mb-3 rounded-xl border border-slate-200 bg-white p-5">
                <View className="flex-row items-start justify-between">
                  <View>
                    <Text className="text-sm font-bold text-slate-900">Week {payslip.week}</Text>
                    <Text className="mt-0.5 text-xs text-slate-500">{payslip.year} -- {payslip.total_routes} routes</Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-full bg-green-100 px-2.5 py-1">
                    <Feather name="check-circle" size={10} color="#166534" />
                    <Text className="text-xs font-semibold text-green-800">Paid</Text>
                  </View>
                </View>

                <View className="mt-4 overflow-hidden rounded-lg border border-slate-100">
                  <View className="flex-row justify-between px-4 py-2.5">
                    <Text className="text-sm text-slate-600">Gross Earnings</Text>
                    <Text className="text-sm font-semibold text-slate-900">£{grossEarnings.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between border-t border-slate-100 px-4 py-2.5">
                    <Text className="text-sm text-red-500">Admin Fee</Text>
                    <Text className="text-sm font-semibold text-red-600">-£{payslip.admin_fee.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                    <Text className="text-sm font-bold text-slate-900">Final Payable</Text>
                    <Text className="text-base font-bold text-green-700">£{netPayable.toFixed(2)}</Text>
                  </View>
                </View>

                <View className="mt-3 flex-row justify-end">
                  {payslip.pdf_path ? (
                    <Pressable
                      onPress={() => openPayslip(payslip)}
                      disabled={openingId === payslip.id}
                      className="flex-row items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2"
                    >
                      {openingId === payslip.id ? <ActivityIndicator size="small" color="white" /> : <Feather name="download" size={13} color="white" />}
                      <Text className="text-xs font-medium text-white">Download Payslip</Text>
                    </Pressable>
                  ) : (
                    <Text className="text-xs text-slate-400">PDF not yet available</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="w-1/2 border-b border-r border-slate-100 p-5">
      <Text className="mb-1 text-xs text-slate-500">{label}</Text>
      <Text className={`text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</Text>
    </View>
  );
}

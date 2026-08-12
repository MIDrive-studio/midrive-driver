import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { todayISODate, weekOf } from "@/lib/dates";
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
        <Text className="mb-4 text-2xl font-bold text-slate-900">Payroll</Text>

        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">This Week (Provisional)</Text>
        {currentWeek ? (
          <View className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <Row label="Routes" value={String(currentWeek.paid_routes_count)} />
            <Row label="Base Pay" value={`£${currentWeek.base_pay.toFixed(2)}`} />
            {currentWeek.stops_bonus > 0 && <Row label="Stops Bonus" value={`£${currentWeek.stops_bonus.toFixed(2)}`} />}
            {currentWeek.additional_amount > 0 && <Row label="Additional" value={`+£${currentWeek.additional_amount.toFixed(2)}`} tone="text-emerald-600" />}
            {currentWeek.deductions_amount > 0 && <Row label="Deductions" value={`-£${currentWeek.deductions_amount.toFixed(2)}`} tone="text-red-600" />}
            <View className="mt-2 flex-row items-center justify-between border-t border-slate-100 pt-2">
              <Text className="font-semibold text-slate-900">Net Pay</Text>
              <Text className="text-lg font-bold text-slate-900">£{currentWeek.net_pay.toFixed(2)}</Text>
            </View>
          </View>
        ) : (
          <Text className="mb-6 text-slate-500">No payroll activity yet this week.</Text>
        )}

        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payslip History</Text>
        {payslips.length === 0 ? (
          <Text className="text-slate-500">No confirmed payslips yet.</Text>
        ) : (
          payslips.map((payslip) => (
            <Pressable
              key={payslip.id}
              onPress={() => openPayslip(payslip)}
              disabled={!payslip.pdf_path || openingId === payslip.id}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
              <View>
                <Text className="font-semibold text-slate-900">Week {payslip.week} · {payslip.year}</Text>
                <Text className="text-sm text-slate-500">{payslip.total_routes} routes</Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-slate-900">£{payslip.net_pay.toFixed(2)}</Text>
                {openingId === payslip.id ? <ActivityIndicator size="small" /> : <Text className="text-xs text-indigo-600">View PDF</Text>}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="mb-1 flex-row items-center justify-between">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className={`text-sm font-medium ${tone ?? "text-slate-900"}`}>{value}</Text>
    </View>
  );
}

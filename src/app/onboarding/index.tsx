import { useCallback } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useOnboarding } from "@/lib/onboarding";
import type { OnboardingStage, StageState } from "@/types/onboarding";

// What is left before a driver can work.
//
// The list, the order and the wording all come from the database. This screen
// decides one thing only: which stages it can open a form for. Anything it has
// no screen for is shown and read, never hidden -- a driver who cannot see a
// step cannot ask about it, and "waiting for the office" is an answer.

const LOOK: Record<StageState, { icon: keyof typeof Feather.glyphMap; tint: string; ring: string; note: string }> = {
  complete: { icon: "check", tint: "#047857", ring: "bg-ok-surface", note: "Done" },
  waiting_driver: { icon: "arrow-right", tint: "#1f5089", ring: "bg-marine-100", note: "Your turn" },
  rejected: { icon: "alert-circle", tint: "#b91c1c", ring: "bg-bad-surface", note: "Needs doing again" },
  waiting_admin: { icon: "clock", tint: "#b45309", ring: "bg-warn-surface", note: "With the office" },
  locked: { icon: "lock", tint: "#94a3b8", ring: "bg-surface-sunken", note: "Not yet" },
  not_required: { icon: "minus", tint: "#94a3b8", ring: "bg-surface-sunken", note: "Not needed" },
};

// Which steps this app can open. A stage missing from here still appears on the
// list with its state and detail; it simply does not lead anywhere yet, which
// is the truth rather than a dead tap.
const ROUTE: Record<string, string> = {
  personal: "/onboarding/personal",
  address_history: "/onboarding/addresses",
};

function StageRow({ stage, onPress }: { stage: OnboardingStage; onPress?: () => void }) {
  const look = LOOK[stage.state] ?? LOOK.locked;
  const openable = Boolean(onPress);
  const counted = stage.total !== undefined && stage.total > 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!openable}
      className={`mb-2 flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 ${
        openable ? "active:bg-slate-50" : ""
      }`}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-full ${look.ring}`}>
        <Feather name={look.icon} size={18} color={look.tint} />
      </View>

      <View className="flex-1">
        <Text className={`text-base font-semibold ${stage.state === "locked" ? "text-slate-400" : "text-slate-900"}`}>
          {stage.label}
        </Text>
        {stage.detail ? (
          <Text className={`mt-0.5 text-sm ${stage.state === "rejected" ? "text-bad-strong" : "text-ink-subtle"}`}>
            {stage.detail}
          </Text>
        ) : counted ? (
          <Text className="mt-0.5 text-sm text-slate-500">
            {stage.done} of {stage.total} signed
          </Text>
        ) : null}
      </View>

      {openable ? (
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      ) : (
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">{look.note}</Text>
      )}
    </Pressable>
  );
}

export default function OnboardingChecklist() {
  const router = useRouter();
  const { driver, signOut } = useAuth();
  const { state, loading, error, reload } = useOnboarding(driver?.id);

  // Coming back from a step re-reads the state rather than trusting what that
  // step believed it saved. The licence screen, for one, cannot know whether
  // the office has looked at the upload yet -- only this call knows.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (loading && !state) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#1f5089" />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-8">
        <Text className="mb-2 text-center text-base font-semibold text-slate-900">Couldn&apos;t load your setup</Text>
        <Text className="mb-6 text-center text-sm text-slate-600">
          {error ?? "Please try again in a moment."}
        </Text>
        <Pressable onPress={reload} className="rounded-xl bg-marine-700 px-6 py-3">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const yourMove = state.stages.filter((s) => s.state === "waiting_driver" || s.state === "rejected");
  const done = state.complete_count;
  const total = state.stage_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#1f5089" />}
      >
        <Text className="text-2xl font-bold text-slate-900">Getting you started</Text>
        <Text className="mt-1 text-sm text-slate-600">
          {yourMove.length === 0
            ? "Nothing for you to do right now."
            : yourMove.length === 1
              ? "One thing needs you."
              : `${yourMove.length} things need you.`}
        </Text>

        <View className="mt-4 rounded-xl bg-white p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold text-slate-700">
              {done} of {total} done
            </Text>
            <Text className="text-sm font-semibold text-marine-700">{pct}%</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-slate-100">
            <View className="h-2 rounded-full bg-marine-600" style={{ width: `${pct}%` }} />
          </View>
          {state.blocking ? (
            <Text className="mt-3 text-sm text-slate-500">
              Waiting on: <Text className="font-semibold text-slate-700">{state.blocking}</Text>
            </Text>
          ) : (
            <Text className="mt-3 text-sm text-slate-500">
              Everything is in. The office will switch your account on.
            </Text>
          )}
        </View>

        <View className="mt-5">
          {state.stages.map((stage) => {
            const route = ROUTE[stage.key];
            const canOpen = Boolean(route) && (stage.state === "waiting_driver" || stage.state === "rejected");
            return (
              <StageRow
                key={stage.key}
                stage={stage}
                onPress={canOpen ? () => router.push(route as never) : undefined}
              />
            );
          })}
        </View>

        <Pressable onPress={signOut} className="mt-6 items-center py-3">
          <Text className="text-sm font-semibold text-slate-500">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

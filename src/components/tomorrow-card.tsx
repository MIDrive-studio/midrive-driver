import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTomorrowAssignment } from "@/lib/tomorrow-assignment";

// What used to be the Today card is now exclusively about tomorrow -- see the
// business decision behind this in the redesign this replaces: today's route
// has no home here any more, on any outcome, including "nothing is on the
// rota". That message is gone on purpose, not missing by omission.
//
// The card renders nothing at all -- not an empty state, not a placeholder --
// whenever there is nothing to say. useTomorrowAssignment already resolves
// "nothing scheduled" against the published window and the driver's own row,
// so this component only has three shapes to draw: in, standby, and absent.

function timeLabel(startTime: string | null): string {
  return startTime ? startTime.slice(0, 5) : "a time to be confirmed";
}

export function TomorrowCard() {
  const { assignment, loading, unreadable, confirm } = useTomorrowAssignment();
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // A read that failed is not the same as nothing being scheduled -- shown
  // quietly rather than silently treated as "nothing tomorrow", the same
  // distinction today-card drew for the same reason.
  if (unreadable) {
    return (
      <View className="mb-4 rounded-xl border border-warn-line bg-warn-surface p-5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-warn-strong">Tomorrow</Text>
        <Text className="mt-1.5 text-lg font-bold text-ink">Couldn&apos;t load tomorrow&apos;s schedule</Text>
        <Text className="mt-1 text-sm text-ink-muted">
          This is a problem reading it, not an empty schedule. Pull down to try again.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="mb-4 items-center rounded-xl border border-line bg-surface p-6">
        <ActivityIndicator color="#1f5089" />
      </View>
    );
  }

  // Nothing scheduled, expired, or removed from the plan -- all the same
  // outcome from here: the section disappears and the cards below move up.
  if (!assignment) return null;

  const confirmed = Boolean(assignment.acknowledgedAt);
  const isStandby = assignment.status === "standby";
  const needsVan = !isStandby && !assignment.vehicleRegistration && !assignment.isOwnerDriver;

  async function onConfirm() {
    setConfirming(true);
    setConfirmError(null);
    const result = await confirm();
    setConfirming(false);
    if (!result.ok) setConfirmError(result.error);
  }

  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-marine-200 bg-surface">
      <View className="bg-marine-600 px-4 py-2.5">
        <Text className="text-xs font-bold uppercase tracking-wide text-white">Tomorrow</Text>
      </View>

      <View className="gap-3 p-4">
        {isStandby ? (
          <>
            <Text className="text-base font-semibold text-ink">You are scheduled to be on standby.</Text>
            <Text className="text-sm text-ink-muted">
              Please stay close to your phone as you may be called in during the morning.
            </Text>
          </>
        ) : (
          <>
            <View className="flex-row items-start gap-2">
              <Feather name="clock" size={15} color="#1f5089" style={{ marginTop: 2 }} />
              <Text className="flex-1 text-base font-semibold text-ink">
                You are scheduled to be in at {timeLabel(assignment.startTime)}
              </Text>
            </View>

            {assignment.isOwnerDriver ? (
              <View className="flex-row items-start gap-2">
                <Feather name="truck" size={15} color="#1f5089" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-sm text-ink-muted">You&apos;ll be driving your own vehicle.</Text>
              </View>
            ) : assignment.vehicleRegistration ? (
              <View className="flex-row items-start gap-2">
                <Feather name="truck" size={15} color="#1f5089" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
                  You will be driving {assignment.vehicleRegistration}
                </Text>
              </View>
            ) : null}

            {needsVan && (
              <Text className="text-sm text-ink-muted">
                Your vehicle will be assigned by your site manager in the morning.
              </Text>
            )}
          </>
        )}

        {confirmError && <Text className="text-sm text-bad-strong">{confirmError}</Text>}

        {/* Confirmation is information for the office, not a gate on the app --
            a driver who never presses this can still use everything else. */}
        {confirmed ? (
          <View className="flex-row items-center gap-1.5 self-start rounded-lg bg-emerald-50 px-3 py-2">
            <Feather name="check-circle" size={15} color="#059669" />
            <Text className="text-sm font-bold text-emerald-700">Confirmed</Text>
          </View>
        ) : (
          <Pressable
            onPress={onConfirm}
            disabled={confirming}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 self-start rounded-lg bg-marine-600 px-4 py-2.5"
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-bold text-white">{isStandby ? "Confirm standby" : "Confirm attendance"}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

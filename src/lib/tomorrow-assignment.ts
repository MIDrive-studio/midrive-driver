import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";

// The Tomorrow card's one data source: my_tomorrow_assignment(), which does
// the window calculation and the three-table join server-side (see the
// function's own comment in the portal's migrations for why "tomorrow" is a
// window rather than a fixed date offset). This hook only has to hold the
// result and know when to ask again.
//
// Refetch pattern copied from usePendingAvailability (availability-pending.ts):
// on mount, and again when the app returns to the foreground after a minute
// away -- there is no realtime channel in this codebase to subscribe to
// instead, and a driver who never backgrounds the app still gets the answer
// that was current when they opened it.

export type TomorrowAssignment = {
  assignmentId: string;
  date: string;
  status: "in" | "standby";
  startTime: string | null;
  vehicleRegistration: string | null;
  isOwnerDriver: boolean;
  acknowledgedAt: string | null;
};

type RpcShape = {
  assignmentId: string;
  date: string;
  assignmentStatus: "in" | "standby";
  startTime: string | null;
  vehicleRegistration: string | null;
  isOwnerDriver: boolean;
  driverAcknowledgedAt: string | null;
} | null;

const FOREGROUND_RECHECK_MS = 60_000;

function fromRpc(row: RpcShape): TomorrowAssignment | null {
  if (!row) return null;
  return {
    assignmentId: row.assignmentId,
    date: row.date,
    status: row.assignmentStatus,
    startTime: row.startTime,
    vehicleRegistration: row.vehicleRegistration,
    isOwnerDriver: row.isOwnerDriver,
    acknowledgedAt: row.driverAcknowledgedAt,
  };
}

export function useTomorrowAssignment() {
  const [assignment, setAssignment] = useState<TomorrowAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadable, setUnreadable] = useState(false);
  const lastChecked = useRef(0);

  const load = useCallback(async () => {
    lastChecked.current = Date.now();
    const { data, error } = await supabase.rpc("my_tomorrow_assignment");
    // No row and a failed read look the same to the card unless this is kept
    // apart -- see today-card's own history with this exact confusion, which
    // is the reason the old "No route assigned" section existed at all.
    setUnreadable(Boolean(error));
    if (!error) setAssignment(fromRpc(data as RpcShape));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastChecked.current < FOREGROUND_RECHECK_MS) return;
      void load();
    });

    return () => subscription.remove();
  }, [load]);

  const confirm = useCallback(async () => {
    if (!assignment) return { ok: false as const, error: "Nothing to confirm." };

    const { data, error } = await supabase.rpc("confirm_assignment", {
      p_assignment_id: assignment.assignmentId,
    });

    if (error) return { ok: false as const, error: error.message };

    setAssignment((prev) =>
      prev ? { ...prev, acknowledgedAt: data?.driverAcknowledgedAt ?? new Date().toISOString() } : prev
    );
    return { ok: true as const };
  }, [assignment]);

  return { assignment, loading, unreadable, refetch: load, confirm };
}

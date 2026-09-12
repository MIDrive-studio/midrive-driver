import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { listDocuments } from "@/lib/portal-api";

// Whether the driver owes a document that was not there when onboarding
// finished -- a version rolled out to existing drivers as well as new ones,
// or one issued to this driver by name.
//
// Checked at app-open only: once on mount, and again whenever the app returns
// to the foreground, throttled the same way usePendingAvailability is. Never
// mid-session. A document becoming outstanding while a driver is three stops
// into a route is not something that should pull the screen out from under
// them; it can wait for the next time they open the app, which is also the
// only moment whereToSend() is allowed to act on it -- see where-to-send.ts.
//
// The stages counted as "done" mirror the ones GET /api/driver/documents
// already reports: 'submitted' and 'approved'. Anything else -- not_started,
// reading, declared, signed (an in-flight state between signing and the
// server recording it), rejected -- still owes an action.

const FOREGROUND_RECHECK_MS = 60_000;
const DONE_STAGES = new Set(["submitted", "approved"]);

type OutstandingDocuments = { loading: boolean; count: number; refresh: () => void };

function useOutstandingDocumentsState(): OutstandingDocuments {
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const lastChecked = useRef(0);

  const check = useCallback(async () => {
    lastChecked.current = Date.now();
    const result = await listDocuments();

    // A count that cannot be read is not a count of zero. Leaving it as it was
    // is safer than clearing a real one because the signal dropped for a
    // moment -- the driver stays gated rather than being let through on a
    // failed read, which is the direction it is safe to be wrong in.
    if (result.ok) {
      const outstanding = result.value.documents.filter((doc) => !DONE_STAGES.has(doc.stage));
      setCount(outstanding.length);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void check();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastChecked.current < FOREGROUND_RECHECK_MS) return;
      void check();
    });

    return () => subscription.remove();
  }, [check]);

  return { loading, count, refresh: check };
}

// One instance, shared, rather than one per caller.
//
// The gate screen and the root layout's redirect effect must never disagree
// about whether a document is still outstanding. Two independent hook
// instances easily could: the gate screen refetches the moment a driver signs
// something, but the root layout's own copy would not know until its next
// throttled foreground check -- which, for a driver who never backgrounds the
// app, might be never. The root's redirect effect would then keep computing
// "/documents-gate" from stale state and pull the driver straight back to the
// screen they just cleared.
//
// Sharing one instance means the gate screen's refresh() updates the exact
// count whereToSend() reads, so the root's own effect (which already depends
// on outstandingDocuments.count) decides the next destination itself, the
// moment the count changes -- no direct navigation call needed from the gate
// screen, and no way for the two to fall out of step.
const OutstandingDocumentsContext = createContext<OutstandingDocuments | null>(null);

export function OutstandingDocumentsProvider({ children }: { children: ReactNode }) {
  const value = useOutstandingDocumentsState();
  return <OutstandingDocumentsContext.Provider value={value}>{children}</OutstandingDocumentsContext.Provider>;
}

export function useOutstandingDocuments(): OutstandingDocuments {
  const context = useContext(OutstandingDocumentsContext);
  if (!context) throw new Error("useOutstandingDocuments must be used within an OutstandingDocumentsProvider.");
  return context;
}

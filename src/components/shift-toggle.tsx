import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { endShift, isShiftActive, startShift } from "@/lib/location";
import type { Driver } from "@/types/driver";

export function ShiftToggle({ driver }: { driver: Driver }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isShiftActive().then(setActive);
  }, []);

  async function handleToggle() {
    setError(null);
    setBusy(true);

    if (active) {
      await endShift();
      setActive(false);
      setBusy(false);
      return;
    }

    const result = await startShift({ driverId: driver.id, companyId: driver.company_id, siteId: driver.site_id });
    setBusy(false);
    if (result.ok) {
      setActive(true);
    } else {
      setError(result.reason);
    }
  }

  return (
    <>
      {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}
      <Pressable
        onPress={handleToggle}
        disabled={busy}
        className={`mb-4 items-center rounded-xl py-3 ${active ? "bg-red-600" : "bg-emerald-600"} disabled:opacity-50`}
      >
        {busy ? <ActivityIndicator color="white" /> : (
          <Text className="font-semibold text-white">{active ? "End Shift" : "Start Shift"}</Text>
        )}
      </Pressable>
    </>
  );
}

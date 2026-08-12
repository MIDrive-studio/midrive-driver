import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { endShift, isShiftActive, startShift } from "@/lib/location";
import type { Driver } from "@/types/driver";

export function ShiftToggle({ driver }: { driver: Driver }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    isShiftActive().then(setActive);
  }, []);

  async function doStart() {
    setError(null);
    setPermissionDenied(false);
    setBusy(true);

    const result = await startShift({ driverId: driver.id, companyId: driver.company_id, siteId: driver.site_id });
    setBusy(false);

    if (result.ok) {
      setActive(true);
    } else {
      setError(result.reason);
      setPermissionDenied(result.reason.toLowerCase().includes("permission"));
    }
  }

  async function doEnd() {
    setBusy(true);
    await endShift();
    setActive(false);
    setBusy(false);
  }

  function handleToggle() {
    if (active) {
      Alert.alert("End Shift?", "This stops sharing your location with dispatch.", [
        { text: "Cancel", style: "cancel" },
        { text: "End Shift", style: "destructive", onPress: doEnd },
      ]);
      return;
    }
    doStart();
  }

  return (
    <View className="mb-4">
      {error && (
        <View className="mb-2">
          <Text className="text-sm text-red-600">{error}</Text>
          {permissionDenied && (
            <Pressable onPress={() => Linking.openSettings()} className="mt-1 flex-row items-center gap-1">
              <Feather name="settings" size={12} color="#475569" />
              <Text className="text-xs font-medium text-slate-600">Open Settings</Text>
            </Pressable>
          )}
        </View>
      )}
      <Pressable
        onPress={handleToggle}
        disabled={busy}
        className={`flex-row items-center justify-center gap-2 rounded-xl py-3 ${active ? "bg-red-600" : "bg-emerald-600"} disabled:opacity-50`}
      >
        {busy ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Feather name={active ? "square" : "play"} size={16} color="white" />
            <Text className="font-semibold text-white">{active ? "End Shift" : "Start Shift"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

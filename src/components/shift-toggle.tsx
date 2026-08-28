import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { endShift, isShiftActive, shiftStartedAt, startShift } from "@/lib/location";
import type { Driver } from "@/types/driver";

/**
 * The prominent disclosure, shown before the system asks for background
 * location.
 *
 * Google requires this and reviews the wording: it has to name what is
 * collected, what it is used for, and that collection continues when the app is
 * closed or not in use. Missing or vague disclosure is the most common reason a
 * background-location app is rejected.
 *
 * It is also simply the honest thing to put in front of somebody before their
 * phone starts reporting where they are. The wording says plainly when it
 * stops, because that is the part a driver actually cares about.
 */
function askForDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Sharing your location on shift",
      "MiDrive DA collects your location and shares it with your dispatch team so they can see " +
        "where the fleet is during the working day.\n\n" +
        "This continues in the background, even when the app is closed or not in use.\n\n" +
        "It starts when you press Start Shift and stops the moment you press End Shift. It is not " +
        "collected at any other time.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

function startedLabel(startedAt: number | null): string | null {
  if (!startedAt) return null;

  const time = new Date(startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `Sharing your location since ${time}`;
}

export function ShiftToggle({ driver }: { driver: Driver }) {
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const [on, started] = await Promise.all([isShiftActive(), shiftStartedAt()]);
      if (cancelled) return;
      setActive(on);
      setStartedAt(started);
    }

    void read();

    return () => {
      cancelled = true;
    };
  }, []);

  async function doStart() {
    setError(null);
    setPermissionDenied(false);
    setBusy(true);

    const result = await startShift(
      { driverId: driver.id, companyId: driver.company_id, siteId: driver.site_id },
      askForDisclosure
    );

    setBusy(false);

    if (result.ok) {
      setActive(true);
      setStartedAt(await shiftStartedAt());
      return;
    }

    // An empty reason means they declined the explanation, which needs no
    // error shown back at them -- they know what they chose.
    setError(result.reason || null);
    setPermissionDenied(result.needsSettings);
  }

  async function doEnd() {
    setBusy(true);
    await endShift();
    setActive(false);
    setStartedAt(null);
    setBusy(false);
  }

  function handleToggle() {
    if (active) {
      Alert.alert("End shift?", "This stops sharing your location with dispatch.", [
        { text: "Cancel", style: "cancel" },
        { text: "End Shift", style: "destructive", onPress: doEnd },
      ]);
      return;
    }
    doStart();
  }

  const since = startedLabel(startedAt);

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

      {/* Said on the screen, not only in a permission dialog nobody re-reads.
          Somebody glancing at their phone should be able to tell whether it is
          currently reporting where they are. */}
      {active && since && (
        <View className="mt-2 flex-row items-center justify-center gap-1.5">
          <Feather name="map-pin" size={11} color="#dc2626" />
          <Text className="text-xs text-slate-600">{since}</Text>
        </View>
      )}
    </View>
  );
}

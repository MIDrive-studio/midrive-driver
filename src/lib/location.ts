import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "@/lib/supabase";

export const LOCATION_TASK_NAME = "driver-location-task";
const DRIVER_CONTEXT_KEY = "driver-location-context";

type DriverLocationContext = { driverId: string; companyId: string; siteId: string };

// Runs outside the React tree (background task), so it can't read component
// state -- the driver/company/site ids it needs are stashed in AsyncStorage
// by startShift() below, and the Supabase session it needs is already in
// AsyncStorage too (persistSession: true in lib/supabase.ts), so this insert
// works whether or not the app is currently in the foreground.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const raw = await AsyncStorage.getItem(DRIVER_CONTEXT_KEY);
  if (!raw) return;
  const context = JSON.parse(raw) as DriverLocationContext;

  await supabase.from("driver_locations").insert({
    company_id: context.companyId,
    site_id: context.siteId,
    driver_id: context.driverId,
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
  });
});

export async function isShiftActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
}

export async function startShift(
  context: DriverLocationContext
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { ok: false, reason: "Location permission is required to start a shift." };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return { ok: false, reason: "Background location permission is required to track your shift." };
  }

  await AsyncStorage.setItem(DRIVER_CONTEXT_KEY, JSON.stringify(context));

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60_000,
    distanceInterval: 100,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "MiDrive Driver",
      notificationBody: "Sharing your location while on shift.",
    },
  });

  return { ok: true };
}

export async function endShift(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (registered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await AsyncStorage.removeItem(DRIVER_CONTEXT_KEY);
}

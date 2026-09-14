import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

// The app's one piece of push infrastructure: a token minted on this device,
// stored on the driver's own row, and read back by the portal when it has
// something to say (see lib/tomorrow/notify.ts on the portal side).
//
// Registration is best-effort throughout. A driver who denies the permission,
// opens this on a simulator, or has no network for a moment still has a
// working app -- push is additive information for the admin, never a
// requirement to use MiDrive (see confirm_assignment's own comment for the
// same rule applied to confirming).

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(driverId: string): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    // Permission refused: nothing to register, and nothing to treat as an
    // error. The Tomorrow card still shows once the app is opened -- see
    // useTomorrowAssignment's foreground recheck.
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    await supabase
      .from("drivers")
      .update({ expo_push_token: token.data, expo_push_token_updated_at: new Date().toISOString() })
      .eq("id", driverId);
  } catch {
    // A simulator, an emulator with no Google Play services, or a device that
    // otherwise cannot mint a token -- the app carries on without one.
  }
}

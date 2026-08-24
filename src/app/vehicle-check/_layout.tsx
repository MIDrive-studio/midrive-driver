import { Stack } from "expo-router";
import { VehicleCheckProvider } from "@/lib/vehicle-check-context";

// The walk-around is one job across four screens, so the photographs live in a
// provider around the stack rather than being passed between routes.
//
// Router params were the obvious alternative and are wrong here: eight local
// file URIs plus their measurements would have to be serialised into a URL on
// every navigation, and going back from the review screen to retake one angle
// would have to reconstruct the whole set from a string. Holding it in one
// place means Back is just Back.
export default function VehicleCheckLayout() {
  return (
    <VehicleCheckProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // Nothing in this flow should be dismissable by a swipe. A driver
          // half-way through a walk-around who swipes the screen away has lost
          // the photographs they have already taken.
          gestureEnabled: false,
        }}
      />
    </VehicleCheckProvider>
  );
}

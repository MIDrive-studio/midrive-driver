import { Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { FuelStation, FuelStationWithDistance } from "@/types/fuel";

// The 250m threshold the server also enforces when allocating a card. Shown
// here so a driver knows before tapping whether they are close enough, rather
// than being refused after filling in their odometer.
export const IN_RANGE_METRES = 250;

export function metresBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function withDistance(
  stations: FuelStation[],
  latitude: number | null,
  longitude: number | null
): FuelStationWithDistance[] {
  return stations
    .map((station) => ({
      ...station,
      distance:
        latitude != null && longitude != null
          ? metresBetween(latitude, longitude, station.latitude, station.longitude)
          : null,
    }))
    // Nearest first, and stations with no distance sink to the bottom rather
    // than sorting as if they were on top of the driver.
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
}

type Props = {
  stations: FuelStationWithDistance[];
  selectedId: string | null;
  onSelect: (station: FuelStationWithDistance) => void;
};

export function FuelStationList({ stations, selectedId, onSelect }: Props) {
  if (stations.length === 0) {
    return (
      <View className="items-center gap-2 py-8">
        <Feather name="map-pin" size={28} color="#cbd5e1" />
        <Text className="text-center text-sm text-slate-400">
          No approved fuel stations found. Contact your manager.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {stations.map((station) => {
        const inRange = station.distance != null && station.distance <= IN_RANGE_METRES;
        const selected = selectedId === station.id;

        return (
          <Pressable
            key={station.id}
            onPress={() => onSelect(station)}
            className={`rounded-xl border-2 p-3 ${
              selected
                ? "border-amber-500 bg-amber-50"
                : inRange
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white"
            }`}
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                  {station.name}
                </Text>
                {station.address && (
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {station.address}
                  </Text>
                )}
                <View className="mt-1 flex-row items-center gap-1">
                  <Feather name="map-pin" size={11} color="#94a3b8" />
                  <Text className={`text-xs font-medium ${inRange ? "text-emerald-600" : "text-slate-500"}`}>
                    {station.distance != null ? `${Math.round(station.distance)}m away` : "Distance unknown"}
                  </Text>
                  {inRange && <Text className="ml-1 text-xs font-bold text-emerald-600">✓ In range</Text>}
                </View>
              </View>

              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
                  )
                }
                hitSlop={8}
                className="rounded-lg bg-blue-50 p-2"
              >
                <Feather name="navigation" size={16} color="#2563eb" />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

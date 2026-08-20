import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useWorkingSite } from "@/lib/working-site";
import { FuelCardReveal } from "@/components/fuel-card-reveal";
import { FuelStationList, IN_RANGE_METRES, withDistance } from "@/components/fuel-station-list";
import type { AllocatedCard, Allocation, FuelStationWithDistance, FuelStep, MileageCheck } from "@/types/fuel";

// Getting a fuel card, as a sequence of checks rather than a button.
//
// Every check here is repeated on the server -- the station's approval, the
// 250m proximity, the odometer bounds. What the app adds is telling the driver
// which check they have failed while they can still do something about it,
// instead of refusing at the end with no explanation.

const STEP_TITLES: Record<FuelStep, string> = {
  station: "Where are you fuelling?",
  mileage: "Confirm the odometer",
  reveal: "Your fuel card",
  record: "What did you spend?",
};

export default function FuelScreen() {
  const { driver } = useAuth();
  const { site: workingSite } = useWorkingSite(driver?.id);

  const [step, setStep] = useState<FuelStep>("station");
  const [stations, setStations] = useState<FuelStationWithDistance[]>([]);
  const [selectedStation, setSelectedStation] = useState<FuelStationWithDistance | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [route, setRoute] = useState<string | null>(null);
  const [mileage, setMileage] = useState("");
  const [mileageCheck, setMileageCheck] = useState<MileageCheck | null>(null);

  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [card, setCard] = useState<AllocatedCard | null>(null);

  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    let position: { latitude: number; longitude: number } | null = null;

    if (status === "granted") {
      try {
        const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        position = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
      } catch {
        // Distances just show as unknown; the server still has the final say.
      }
    }

    setCoords(position);

    const { data, error: stationError } = await supabase
      .from("fuel_stations")
      .select("id, name, address, city, postcode, latitude, longitude");

    if (stationError) {
      setError(`Couldn't load fuel stations -- ${stationError.message}`);
    } else {
      setStations(withDistance(data ?? [], position?.latitude ?? null, position?.longitude ?? null));
    }

    // Today's route, so the allocation records what they were doing. Absent is
    // fine -- a driver may be fuelling outside a rostered day.
    if (driver) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: assignment } = await supabase
        .from("rota_assignments")
        .select("route")
        .eq("driver_id", driver.id)
        .eq("date", today)
        .maybeSingle();

      if (assignment?.route) setRoute(assignment.route);
    }

    setLoading(false);
    setRefreshing(false);
  }, [driver]);

  useEffect(() => {
    load();
  }, [load]);

  // An allocation that is still live is picked up on open, so closing the app
  // mid-fuelling doesn't strand the driver with a card they can't see.
  useEffect(() => {
    if (!driver) return;

    (async () => {
      const { data } = await supabase
        .from("fuel_card_allocations")
        .select("id, fuel_card_id, expires_at")
        .eq("driver_id", driver.id)
        .is("completed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      const { data: cardRow } = await supabase
        .from("fuel_cards")
        .select("id, card_name, provider, card_number, last_four, pin, expiry_date")
        .eq("id", data.fuel_card_id)
        .maybeSingle();

      if (cardRow) {
        setAllocation({
          allocationId: data.id,
          fuelCardId: data.fuel_card_id,
          expiresAt: data.expires_at,
          reused: true,
        });
        setCard(cardRow as AllocatedCard);
        setStep("reveal");
      }
    })();
  }, [driver]);

  async function handleVerifyMileage() {
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("verify_fuel_mileage", {
      p_vehicle_registration: vehicleRegistration.trim().toUpperCase(),
      p_mileage: Number(mileage),
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = data as MileageCheck;
    setMileageCheck(result);
    if (!result.valid) setError(result.reason ?? "That odometer reading was rejected.");
  }

  async function handleAllocate() {
    if (!selectedStation) return;

    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("allocate_fuel_card", {
      p_station_id: selectedStation.id,
      p_latitude: coords?.latitude ?? null,
      p_longitude: coords?.longitude ?? null,
      p_vehicle_registration: vehicleRegistration.trim().toUpperCase(),
      p_mileage: Number(mileage),
      p_route: route,
      p_device_info: `${Platform.OS} ${Platform.Version}`,
    });

    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    const result = data as Allocation;

    // Readable only now that the allocation exists -- before this the row-level
    // policy would return nothing.
    const { data: cardRow, error: cardError } = await supabase
      .from("fuel_cards")
      .select("id, card_name, provider, card_number, last_four, pin, expiry_date")
      .eq("id", result.fuelCardId)
      .maybeSingle();

    setBusy(false);

    if (cardError || !cardRow) {
      setError("A card was allocated but couldn't be read. Tell your manager.");
      return;
    }

    setAllocation(result);
    setCard(cardRow as AllocatedCard);
    setStep("reveal");
  }

  async function handleRecord() {
    if (!allocation) return;

    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("complete_fuel_allocation", {
      p_allocation_id: allocation.allocationId,
      p_litres: litres ? Number(litres) : null,
      p_fuel_cost: cost ? Number(cost) : null,
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const flags = (data as { fraudFlags?: unknown[] })?.fraudFlags ?? [];

    Alert.alert(
      "Fuelling recorded",
      flags.length > 0
        ? "Recorded. Some details were flagged for your manager to review."
        : "Recorded. Thanks.",
      [
        {
          text: "Done",
          onPress: () => {
            setStep("station");
            setAllocation(null);
            setCard(null);
            setSelectedStation(null);
            setMileage("");
            setMileageCheck(null);
            setLitres("");
            setCost("");
            load();
          },
        },
      ]
    );
  }

  if (!driver || loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const inRange = selectedStation?.distance != null && selectedStation.distance <= IN_RANGE_METRES;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Feather name="droplet" size={18} color="#f59e0b" />
          <Text className="text-lg font-bold text-slate-900">Fuel Card</Text>
        </View>
        <Text className="text-xs text-slate-500">{STEP_TITLES[step]}</Text>
      </View>

      {/* The fuel is charged to the depot the driver is working at today, which
          is their loan destination when on loan. Stating it here means a driver
          who spots the wrong site can raise it before they fill up. */}
      {workingSite?.site_name && (
        <View className="flex-row items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-4 py-2">
          <Feather name="map-pin" size={12} color="#64748b" />
          <Text className="text-xs text-slate-600">
            Fuelling for <Text className="font-bold text-slate-800">{workingSite.site_name}</Text>
            {workingSite.on_loan ? " — you're on loan there today" : ""}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          className="flex-1 px-4 py-4"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            step === "station" ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            ) : undefined
          }
        >
          {error && (
            <View className="mb-4 rounded-lg bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {step === "station" && (
            <View className="gap-4">
              {!coords && (
                <View className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Text className="text-xs text-amber-700">
                    Location is off, so distances can&apos;t be shown. You need to be within {IN_RANGE_METRES}m of the
                    station to get a card, so turn it on and pull down to refresh.
                  </Text>
                </View>
              )}

              <FuelStationList
                stations={stations}
                selectedId={selectedStation?.id ?? null}
                onSelect={setSelectedStation}
              />

              <Pressable
                onPress={() => setStep("mileage")}
                disabled={!selectedStation}
                className={`items-center rounded-lg py-3 ${selectedStation ? "bg-slate-900" : "bg-slate-300"}`}
              >
                <Text className="text-sm font-bold text-white">Continue</Text>
              </Pressable>

              {selectedStation && !inRange && (
                <Text className="text-center text-xs text-amber-700">
                  You&apos;re{" "}
                  {selectedStation.distance != null ? `${Math.round(selectedStation.distance)}m` : "an unknown distance"}{" "}
                  from {selectedStation.name}. You&apos;ll need to be within {IN_RANGE_METRES}m before a card is issued.
                </Text>
              )}
            </View>
          )}

          {step === "mileage" && (
            <View className="gap-4">
              <View className="gap-2 rounded-xl bg-slate-100 p-4">
                <View className="flex-row items-center gap-2">
                  <Feather name="truck" size={16} color="#334155" />
                  <Text className="text-sm font-bold text-slate-900">Vehicle check</Text>
                </View>
                <View className="flex-row flex-wrap gap-y-2">
                  <View className="w-1/2">
                    <Text className="text-xs text-slate-400">Driver</Text>
                    <Text className="text-sm font-bold text-slate-900">{driver.full_name}</Text>
                  </View>
                  <View className="w-1/2">
                    <Text className="text-xs text-slate-400">Route</Text>
                    <Text className="text-sm font-bold text-slate-900">{route ?? "—"}</Text>
                  </View>
                  <View className="w-full">
                    <Text className="text-xs text-slate-400">Station</Text>
                    <Text className="text-sm font-bold text-slate-900">{selectedStation?.name}</Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="mb-1 text-xs font-medium text-slate-600">Vehicle registration</Text>
                <TextInput
                  value={vehicleRegistration}
                  onChangeText={(v) => {
                    setVehicleRegistration(v.toUpperCase());
                    setMileageCheck(null);
                  }}
                  placeholder="e.g. AB12 CDE"
                  autoCapitalize="characters"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                />
              </View>

              {mileageCheck?.previousMileage != null && (
                <View className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <Text className="text-xs text-blue-700">
                    Previous recorded mileage:{" "}
                    <Text className="font-bold">{mileageCheck.previousMileage.toLocaleString()}</Text> miles
                  </Text>
                  <Text className="mt-0.5 text-xs text-blue-600">
                    Allowed range: {mileageCheck.previousMileage.toLocaleString()} –{" "}
                    {(mileageCheck.previousMileage + 500).toLocaleString()}
                  </Text>
                </View>
              )}

              <View>
                <Text className="mb-1 text-xs font-medium text-slate-600">Current odometer reading (miles)</Text>
                <TextInput
                  value={mileage}
                  onChangeText={(v) => {
                    setMileage(v.replace(/[^0-9]/g, ""));
                    setMileageCheck(null);
                  }}
                  placeholder="e.g. 52310"
                  keyboardType="number-pad"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg"
                />
                <Text className="mt-1 text-xs text-slate-400">Whole numbers only</Text>
              </View>

              {mileageCheck?.valid && (
                <View className="flex-row items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <Feather name="check-circle" size={16} color="#059669" />
                  <Text className="flex-1 text-sm text-emerald-700">
                    Mileage verified. You can now request a fuel card.
                  </Text>
                </View>
              )}

              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setStep("station")}
                  className="flex-1 items-center rounded-lg border border-slate-300 py-3"
                >
                  <Text className="text-sm font-medium text-slate-700">Back</Text>
                </Pressable>

                {!mileageCheck?.valid ? (
                  <Pressable
                    onPress={handleVerifyMileage}
                    disabled={busy || !mileage || !vehicleRegistration.trim()}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                      busy || !mileage || !vehicleRegistration.trim() ? "bg-slate-300" : "bg-slate-900"
                    }`}
                  >
                    {busy && <ActivityIndicator size="small" color="white" />}
                    <Text className="text-sm font-bold text-white">Verify Mileage</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleAllocate}
                    disabled={busy}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-amber-500 py-3"
                  >
                    {busy && <ActivityIndicator size="small" color="white" />}
                    <Text className="text-sm font-bold text-white">Request Fuel Card</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {step === "reveal" && card && allocation && (
            <FuelCardReveal card={card} expiresAt={allocation.expiresAt} onComplete={() => setStep("record")} />
          )}

          {step === "record" && (
            <View className="gap-4">
              <Text className="text-sm text-slate-600">
                Enter what you put in, so your manager can match it against the card statement.
              </Text>

              <View>
                <Text className="mb-1 text-xs font-medium text-slate-600">Litres</Text>
                <TextInput
                  value={litres}
                  onChangeText={(v) => setLitres(v.replace(/[^0-9.]/g, ""))}
                  placeholder="e.g. 58.4"
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg"
                />
              </View>

              <View>
                <Text className="mb-1 text-xs font-medium text-slate-600">Total cost (£)</Text>
                <TextInput
                  value={cost}
                  onChangeText={(v) => setCost(v.replace(/[^0-9.]/g, ""))}
                  placeholder="e.g. 82.15"
                  keyboardType="decimal-pad"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg"
                />
              </View>

              <Pressable
                onPress={handleRecord}
                disabled={busy || !litres || !cost}
                className={`flex-row items-center justify-center gap-2 rounded-lg py-4 ${
                  busy || !litres || !cost ? "bg-slate-300" : "bg-emerald-600"
                }`}
              >
                {busy && <ActivityIndicator size="small" color="white" />}
                <Text className="text-base font-bold text-white">Save fuelling</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

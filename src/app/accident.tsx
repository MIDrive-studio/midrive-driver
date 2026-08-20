import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { LocationPicker } from "@/components/location-picker";
import { useWorkingSite } from "@/lib/working-site";
import type { AccidentDraft, AccidentStep, EvidenceItem } from "@/types/accident";

// Reporting an accident, as a sequence of small questions rather than one long
// form. Someone doing this at the roadside is not in a state to work down forty
// fields, and each step is answerable in isolation.
//
// Progress is saved after every change, because the most likely interruption
// here is the phone being put down mid-report -- to move a vehicle, speak to
// the other driver, or talk to the police. Losing the report at that moment
// would be the worst possible time for it.

const DRAFT_KEY = (driverId: string) => `accident_report_draft_${driverId}`;
const MAX_EVIDENCE = 12;

const STEP_TITLES: Record<AccidentStep, string> = {
  vehicle: "Enter vehicle registration",
  when: "When did it happen?",
  time: "Confirm accident time",
  confirm: "Confirm your details",
  location: "Set accident location",
  evidence: "Upload accident evidence",
  third_party: "Third party details",
  description: "Describe what happened",
  review: "Review & submit",
};

function emptyDraft(): AccidentDraft {
  return {
    step: "vehicle",
    timeMode: null,
    vehicleRegistration: "",
    date_time: new Date().toISOString(),
    latitude: null,
    longitude: null,
    location_address: "",
    evidence: [],
    third_party_name: "",
    third_party_phone: "",
    third_party_vehicle_registration: "",
    third_party_insurance_company: "",
    third_party_policy_number: "",
    description: "",
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccidentScreen() {
  const router = useRouter();
  const { driver } = useAuth();

  const [draft, setDraft] = useState<AccidentDraft>(emptyDraft);
  const [draftChecked, setDraftChecked] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showPicker, setShowPicker] = useState<"date" | "time" | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  const driverId = driver?.id;
  const { site: workingSite } = useWorkingSite(driverId);

  // Look for an unfinished report before showing anything, so the driver is
  // never silently started on a fresh one while a saved report exists.
  useEffect(() => {
    if (!driverId) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY(driverId));
        if (raw) {
          const saved = JSON.parse(raw) as AccidentDraft;
          if (saved?.step && saved.step !== "vehicle") {
            setDraft(saved);
            setShowResume(true);
          }
        }
      } catch {
        // A corrupt draft is not worth blocking a report over.
      }
      setDraftChecked(true);
    })();
  }, [driverId]);

  useEffect(() => {
    if (!driverId || !draftChecked || showResume) return;
    AsyncStorage.setItem(DRAFT_KEY(driverId), JSON.stringify(draft)).catch(() => {});
  }, [draft, driverId, draftChecked, showResume]);

  useEffect(() => {
    if (draft.step !== "location" || locationRequested || draft.latitude != null) return;
    setLocationRequested(true);
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step, locationRequested, draft.latitude]);

  const update = useCallback((patch: Partial<AccidentDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const go = useCallback((step: AccidentStep) => update({ step }), [update]);

  async function discardDraft() {
    if (driverId) await AsyncStorage.removeItem(DRAFT_KEY(driverId)).catch(() => {});
    setDraft(emptyDraft());
    setShowResume(false);
  }

  async function captureLocation() {
    setLocating(true);
    setError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Location permission is needed to record where the accident happened.");
      setLocating(false);
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      update({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setError("Couldn't get your location. Check your signal and try again.");
    }

    setLocating(false);
  }

  async function addEvidence(fromCamera: boolean) {
    if (draft.evidence.length >= MAX_EVIDENCE) {
      setError(`You can attach up to ${MAX_EVIDENCE} items.`);
      return;
    }

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(fromCamera ? "Camera permission is needed to take photos." : "Photo access is needed to attach evidence.");
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images", "videos"],
      quality: 0.6,
      allowsMultipleSelection: !fromCamera,
      selectionLimit: MAX_EVIDENCE - draft.evidence.length,
    };

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;

    const added: EvidenceItem[] = result.assets.map((asset) => ({
      uri: asset.uri,
      media_type: asset.type === "video" ? "video" : "photo",
    }));

    update({ evidence: [...draft.evidence, ...added].slice(0, MAX_EVIDENCE) });
  }

  async function handleSubmit() {
    if (!driver) return;

    setSubmitting(true);
    setError(null);

    // The report is created first: evidence rows and storage paths both key off
    // its id, and a photo with no report to attach to is unrecoverable.
    //
    // site_id is sent, but a trigger overrides it with the site the driver is
    // actually working at that day -- their loan destination when on loan, their
    // own site otherwise. So it is read back rather than assumed, and the
    // evidence below is filed against whichever site the report landed on.
    const { data: report, error: reportError } = await supabase
      .from("accident_reports")
      .insert({
        company_id: driver.company_id,
        site_id: driver.site_id,
        driver_id: driver.id,
        driver_name: driver.full_name,
        vehicle_registration: draft.vehicleRegistration.trim().toUpperCase(),
        date_time: draft.date_time,
        latitude: draft.latitude,
        longitude: draft.longitude,
        location_address: draft.location_address.trim() || null,
        description: draft.description.trim(),
        third_party_name: draft.third_party_name.trim() || null,
        third_party_phone: draft.third_party_phone.trim() || null,
        third_party_vehicle_registration: draft.third_party_vehicle_registration.trim().toUpperCase() || null,
        third_party_insurance_company: draft.third_party_insurance_company.trim() || null,
        third_party_policy_number: draft.third_party_policy_number.trim() || null,
        status: "open",
      })
      .select("id, site_id")
      .single();

    if (reportError || !report) {
      setError(`Couldn't submit the report — ${reportError?.message ?? "please try again"}.`);
      setSubmitting(false);
      return;
    }

    // Evidence failing must not lose the report, which is the part that matters
    // and is already saved. Failures are counted and reported instead.
    let failedUploads = 0;

    for (const [index, item] of draft.evidence.entries()) {
      try {
        const extension = item.media_type === "video" ? "mp4" : "jpg";
        const path = `${report.site_id}/${report.id}/${Date.now()}-${index}.${extension}`;
        const response = await fetch(item.uri);
        const bytes = new Uint8Array(await response.arrayBuffer());

        const { error: uploadError } = await supabase.storage
          .from("accident-evidence")
          .upload(path, bytes, { contentType: item.media_type === "video" ? "video/mp4" : "image/jpeg" });

        if (uploadError) throw new Error(uploadError.message);

        const { error: rowError } = await supabase.from("accident_evidence").insert({
          accident_id: report.id,
          site_id: report.site_id,
          media_type: item.media_type,
          file_path: path,
        });

        if (rowError) throw new Error(rowError.message);
      } catch {
        failedUploads += 1;
      }
    }

    if (driverId) await AsyncStorage.removeItem(DRAFT_KEY(driverId)).catch(() => {});
    setSubmitting(false);

    Alert.alert(
      "Report submitted",
      failedUploads > 0
        ? `Your report has been sent. ${failedUploads} of ${draft.evidence.length} attachments failed to upload — tell your manager so they can be added.`
        : "Your report has been sent to your manager.",
      [{ text: "Done", onPress: () => router.back() }]
    );
  }

  if (!driver) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <View>
          <Text className="text-lg font-bold text-slate-900">Report Accident</Text>
          <Text className="text-xs text-slate-500">{showResume ? "Resume your report" : STEP_TITLES[draft.step]}</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={22} color="#64748b" />
        </Pressable>
      </View>

      {/* Which depot this lands on is not always the one the driver is based
          at, so it is stated rather than left to be discovered afterwards. */}
      {workingSite?.site_name && (
        <View className="flex-row items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-4 py-2">
          <Feather name="map-pin" size={12} color="#64748b" />
          <Text className="text-xs text-slate-600">
            Reporting for <Text className="font-bold text-slate-800">{workingSite.site_name}</Text>
            {workingSite.on_loan ? " — you're on loan there today" : ""}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 px-4 py-5" keyboardShouldPersistTaps="handled">
          {error && (
            <View className="mb-4 rounded-lg bg-red-50 px-3 py-2">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          {showResume ? (
            <View className="gap-4">
              <View className="items-center py-4">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <Feather name="file-text" size={26} color="#d97706" />
                </View>
                <Text className="text-sm font-bold text-slate-800">You have an unfinished accident report.</Text>
                <Text className="mt-1 text-xs text-slate-500">Would you like to continue where you left off?</Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() =>
                    Alert.alert("Discard draft?", "This permanently deletes your saved progress.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Discard", style: "destructive", onPress: discardDraft },
                    ])
                  }
                  className="flex-1 items-center rounded-lg border border-slate-300 py-3"
                >
                  <Text className="text-sm font-medium text-slate-700">Start New</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowResume(false)}
                  className="flex-1 items-center rounded-lg bg-slate-900 py-3"
                >
                  <Text className="text-sm font-bold text-white">Continue</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {draft.step === "vehicle" && (
                <View className="gap-4">
                  <View className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Text className="text-sm font-bold text-amber-700">Vehicle registration</Text>
                    <Text className="mt-1 text-xs text-amber-600">
                      Enter the registration of the vehicle you were driving.
                    </Text>
                  </View>

                  <Field label="Vehicle Registration *">
                    <TextInput
                      value={draft.vehicleRegistration}
                      onChangeText={(v) => update({ vehicleRegistration: v.toUpperCase() })}
                      placeholder="e.g. AB12 CDE"
                      autoCapitalize="characters"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>

                  <NextButton
                    label="Continue"
                    disabled={!draft.vehicleRegistration.trim()}
                    onPress={() => go("when")}
                  />
                </View>
              )}

              {draft.step === "when" && (
                <View className="gap-3">
                  <Text className="text-sm font-bold text-slate-600">When did the accident happen?</Text>

                  <Pressable
                    onPress={() => {
                      update({ timeMode: "now", date_time: new Date().toISOString() });
                      go("time");
                    }}
                    className="rounded-lg border border-blue-200 bg-blue-50 p-4 active:bg-blue-100"
                  >
                    <Text className="text-sm font-bold text-slate-900">Now</Text>
                    <Text className="text-xs text-slate-600">The accident just happened</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      update({ timeMode: "past" });
                      go("time");
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 active:bg-slate-100"
                  >
                    <Text className="text-sm font-bold text-slate-900">Select Date & Time</Text>
                    <Text className="text-xs text-slate-600">The accident happened earlier</Text>
                  </Pressable>
                </View>
              )}

              {draft.step === "time" && (
                <View className="gap-4">
                  <Text className="text-sm text-slate-600">
                    {draft.timeMode === "now"
                      ? "Confirm or adjust the accident time:"
                      : "Enter when the accident happened:"}
                  </Text>

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setShowPicker("date")}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-3"
                    >
                      <Text className="text-xs text-slate-500">Date</Text>
                      <Text className="text-sm font-semibold text-slate-900">
                        {new Date(draft.date_time).toLocaleDateString("en-GB")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowPicker("time")}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-3"
                    >
                      <Text className="text-xs text-slate-500">Time</Text>
                      <Text className="text-sm font-semibold text-slate-900">
                        {new Date(draft.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </Pressable>
                  </View>

                  {showPicker && (
                    <DateTimePicker
                      value={new Date(draft.date_time)}
                      mode={showPicker}
                      maximumDate={new Date()}
                      onChange={(_, selected) => {
                        setShowPicker(Platform.OS === "ios" ? showPicker : null);
                        if (selected) update({ date_time: selected.toISOString() });
                        if (Platform.OS === "ios") setShowPicker(null);
                      }}
                    />
                  )}

                  <View className="rounded-lg bg-blue-50 p-3">
                    <Text className="text-xs font-bold text-blue-700">Set time: {formatDateTime(draft.date_time)}</Text>
                  </View>

                  <StepButtons onBack={() => go("when")} onNext={() => go("confirm")} nextLabel="Next" />
                </View>
              )}

              {draft.step === "confirm" && (
                <View className="gap-4">
                  <Text className="text-sm text-slate-600">Please confirm your details before continuing:</Text>

                  <View className="gap-3 rounded-lg bg-slate-100 p-4">
                    <View>
                      <Text className="text-xs font-medium text-slate-500">Driver Name</Text>
                      <Text className="text-sm font-bold text-slate-800">{driver.full_name}</Text>
                    </View>
                    <View>
                      <Text className="text-xs font-medium text-slate-500">Vehicle Registration</Text>
                      <Text className="text-sm font-bold text-slate-800">{draft.vehicleRegistration}</Text>
                    </View>
                  </View>

                  <StepButtons onBack={() => go("time")} onNext={() => go("location")} nextLabel="Continue" />
                </View>
              )}

              {draft.step === "location" && (
                <View className="gap-4">
                  <View className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <Text className="text-sm font-bold text-blue-700">Where did it happen?</Text>
                    <Text className="mt-1 text-xs text-blue-600">
                      Drag the pin, or tap the map, to mark exactly where the accident happened.
                    </Text>
                  </View>

                  <LocationPicker
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={(latitude, longitude) => update({ latitude, longitude })}
                  />

                  {draft.latitude != null && draft.longitude != null ? (
                    <View className="rounded-lg bg-slate-100 p-3">
                      <Text className="text-xs font-medium text-slate-500">Selected location</Text>
                      <Text className="text-sm font-bold text-slate-800">
                        {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
                      </Text>
                    </View>
                  ) : (
                    <View className="rounded-lg bg-amber-50 p-3">
                      <Text className="text-xs text-amber-700">
                        {locating
                          ? "Finding you on the map..."
                          : "No pin placed yet — tap the map where the accident happened, or use the button below."}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={captureLocation}
                    disabled={locating}
                    className="flex-row items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3"
                  >
                    {locating ? <ActivityIndicator size="small" /> : <Feather name="map-pin" size={16} color="#334155" />}
                    <Text className="text-sm font-medium text-slate-700">
                      {locating ? "Detecting..." : draft.latitude == null ? "Capture my location" : "Reset pin to where I am"}
                    </Text>
                  </Pressable>

                  <Field label="Accident address (optional)">
                    <TextInput
                      value={draft.location_address}
                      onChangeText={(v) => update({ location_address: v })}
                      placeholder="Road name, junction, landmark"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>

                  <StepButtons
                    onBack={() => go("confirm")}
                    onNext={() => go("evidence")}
                    nextLabel="Next"
                    nextDisabled={draft.latitude == null}
                  />
                </View>
              )}

              {draft.step === "evidence" && (
                <View className="gap-4">
                  <Text className="text-sm text-slate-600">
                    Photos of the damage, the other vehicle, the road and any injuries. These matter most straight after
                    the accident — they are hard to get later.
                  </Text>

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => addEvidence(true)}
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-slate-900 py-3"
                    >
                      <Feather name="camera" size={16} color="white" />
                      <Text className="text-sm font-bold text-white">Take photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => addEvidence(false)}
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3"
                    >
                      <Feather name="image" size={16} color="#334155" />
                      <Text className="text-sm font-medium text-slate-700">Choose</Text>
                    </Pressable>
                  </View>

                  {draft.evidence.length > 0 && (
                    <View className="flex-row flex-wrap gap-2">
                      {draft.evidence.map((item, index) => (
                        <View key={`${item.uri}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-lg bg-slate-200">
                          <Image source={{ uri: item.uri }} className="h-full w-full" resizeMode="cover" />
                          {item.media_type === "video" && (
                            <View className="absolute inset-0 items-center justify-center bg-black/30">
                              <Feather name="play" size={18} color="white" />
                            </View>
                          )}
                          <Pressable
                            onPress={() => update({ evidence: draft.evidence.filter((_, i) => i !== index) })}
                            className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                            hitSlop={6}
                          >
                            <Feather name="x" size={12} color="white" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text className="text-xs text-slate-400">
                    {draft.evidence.length} of {MAX_EVIDENCE} attached
                  </Text>

                  <StepButtons onBack={() => go("location")} onNext={() => go("third_party")} nextLabel="Next" />
                </View>
              )}

              {draft.step === "third_party" && (
                <View className="gap-3">
                  <Text className="text-sm text-slate-600">
                    Details of the other party. Leave blank if nobody else was involved.
                  </Text>

                  <Field label="Name">
                    <TextInput
                      value={draft.third_party_name}
                      onChangeText={(v) => update({ third_party_name: v })}
                      placeholder="Third party name"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>
                  <Field label="Phone Number">
                    <TextInput
                      value={draft.third_party_phone}
                      onChangeText={(v) => update({ third_party_phone: v })}
                      placeholder="Phone number"
                      keyboardType="phone-pad"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>
                  <Field label="Vehicle Registration">
                    <TextInput
                      value={draft.third_party_vehicle_registration}
                      onChangeText={(v) => update({ third_party_vehicle_registration: v.toUpperCase() })}
                      placeholder="AB12 CDE"
                      autoCapitalize="characters"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>
                  <Field label="Insurance Company">
                    <TextInput
                      value={draft.third_party_insurance_company}
                      onChangeText={(v) => update({ third_party_insurance_company: v })}
                      placeholder="Insurance company name"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>
                  <Field label="Policy Number">
                    <TextInput
                      value={draft.third_party_policy_number}
                      onChangeText={(v) => update({ third_party_policy_number: v })}
                      placeholder="Policy number"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                    />
                  </Field>

                  <StepButtons onBack={() => go("evidence")} onNext={() => go("description")} nextLabel="Next" />
                </View>
              )}

              {draft.step === "description" && (
                <View className="gap-4">
                  <Text className="text-sm text-slate-600">Describe what happened in the accident.</Text>

                  <TextInput
                    value={draft.description}
                    onChangeText={(v) => update({ description: v })}
                    placeholder="What happened, how it occurred, any injuries..."
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                    className="h-40 rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
                  />

                  <StepButtons
                    onBack={() => go("third_party")}
                    onNext={() => go("review")}
                    nextLabel="Review"
                    nextDisabled={!draft.description.trim()}
                  />
                </View>
              )}

              {draft.step === "review" && (
                <View className="gap-3">
                  <Text className="text-sm font-bold text-slate-600">Review your accident report:</Text>

                  <Summary label="Date & Time" value={formatDateTime(draft.date_time)} />
                  <Summary label="Vehicle" value={draft.vehicleRegistration} />
                  <Summary
                    label="Location"
                    value={
                      draft.location_address ||
                      (draft.latitude != null ? `${draft.latitude.toFixed(5)}, ${draft.longitude?.toFixed(5)}` : "Not recorded")
                    }
                  />
                  <Summary label="What Happened" value={draft.description} />
                  <Summary
                    label="Third Party"
                    value={
                      draft.third_party_name || draft.third_party_vehicle_registration
                        ? [draft.third_party_name, draft.third_party_phone, draft.third_party_vehicle_registration, draft.third_party_insurance_company]
                            .filter(Boolean)
                            .join("\n")
                        : "None recorded"
                    }
                  />
                  <Summary label={`Evidence (${draft.evidence.length})`} value={draft.evidence.length ? "" : "No evidence attached"}>
                    {draft.evidence.length > 0 && (
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        {draft.evidence.map((item, index) => (
                          <Image
                            key={`${item.uri}-${index}`}
                            source={{ uri: item.uri }}
                            className="h-16 w-16 rounded-lg bg-slate-200"
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    )}
                  </Summary>

                  <View className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Text className="text-xs text-amber-700">
                      Once submitted you won&apos;t be able to edit this report. Your manager will review it and handle
                      the claim.
                    </Text>
                  </View>

                  <View className="flex-row gap-2 pb-8">
                    <Pressable
                      onPress={() => go("description")}
                      disabled={submitting}
                      className="flex-1 items-center rounded-lg border border-slate-300 py-3"
                    >
                      <Text className="text-sm font-medium text-slate-700">Back</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={submitting}
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 disabled:opacity-50"
                    >
                      {submitting && <ActivityIndicator size="small" color="white" />}
                      <Text className="text-sm font-bold text-white">
                        {submitting ? "Submitting..." : "Submit Report"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-slate-600">{label}</Text>
      {children}
    </View>
  );
}

function Summary({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <View className="rounded-lg bg-slate-100 p-3">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      {value ? <Text className="text-sm font-semibold text-slate-800">{value}</Text> : null}
      {children}
    </View>
  );
}

function NextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-lg py-3 ${disabled ? "bg-slate-300" : "bg-slate-900"}`}
    >
      <Text className="text-sm font-bold text-white">{label}</Text>
    </Pressable>
  );
}

function StepButtons({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <View className="flex-row gap-2">
      <Pressable onPress={onBack} className="flex-1 items-center rounded-lg border border-slate-300 py-3">
        <Text className="text-sm font-medium text-slate-700">Back</Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        className={`flex-1 items-center rounded-lg py-3 ${nextDisabled ? "bg-slate-300" : "bg-slate-900"}`}
      >
        <Text className="text-sm font-bold text-white">{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

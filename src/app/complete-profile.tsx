import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { DriverProfileUpdate } from "@/types/driver";

// Plain strings for every text field -- always initialized to "" and only
// converted to `string | null` (DriverProfileUpdate's shape) at submit time.
type FormState = {
  date_of_birth: string;
  phone: string;
  nationality: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  utr_number: string;
  ni_number: string;
  vat_registered: boolean;
  vat_number: string;
  bank_account_name: string;
  bank_sort_code: string;
  bank_account_number: string;
};

// Required (label, form key) pairs, matching PROFILE_REQUIRED_FIELDS in
// lib/profile-completion.ts.
//
// "phone" used to be excluded here on the grounds that an administrator sets it
// when creating the driver -- but the home screen still counted it, so a driver
// whose record had no phone was told to add one and given no field to add it
// in. It is editable now.
//
// "utr_number" is deliberately absent: HMRC takes weeks or months to issue one,
// and a new driver cannot produce a number that does not exist yet. It is asked
// for on the form as optional, and chased separately once they have it.
const REQUIRED: { key: keyof FormState; label: string }[] = [
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "phone", label: "Phone Number" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode" },
  { key: "next_of_kin_name", label: "Next of Kin" },
  { key: "next_of_kin_phone", label: "Next of Kin Phone" },
  { key: "next_of_kin_relationship", label: "Relationship to You" },
  { key: "ni_number", label: "National Insurance Number" },
  { key: "bank_account_name", label: "Bank Account Name" },
  { key: "bank_sort_code", label: "Sort Code" },
  { key: "bank_account_number", label: "Account Number" },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "characters" | "words";
  maxLength?: number;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
      />
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (isoDate: string) => void }) {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00Z`) : new Date(2000, 0, 1);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(selected.toISOString().slice(0, 10));
  }

  const displayValue = value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      <Pressable onPress={() => setShow(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-3">
        <Text className={displayValue ? "text-slate-900" : "text-slate-400"}>{displayValue ?? "Select date"}</Text>
      </Pressable>
      {show && (
        <DateTimePicker value={dateValue} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} maximumDate={new Date()} onChange={handleChange} />
      )}
      {show && Platform.OS === "ios" && (
        <Pressable onPress={() => setShow(false)} className="mt-1 self-end">
          <Text className="text-sm font-medium text-amber-600">Done</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CompleteProfileScreen() {
  const { driver, reloadDriver } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    date_of_birth: driver?.date_of_birth ?? "",
    phone: driver?.phone ?? "",
    nationality: driver?.nationality ?? "",
    address_line1: driver?.address_line1 ?? "",
    address_line2: driver?.address_line2 ?? "",
    city: driver?.city ?? "",
    postcode: driver?.postcode ?? "",
    next_of_kin_name: driver?.next_of_kin_name ?? "",
    next_of_kin_phone: driver?.next_of_kin_phone ?? "",
    next_of_kin_relationship: driver?.next_of_kin_relationship ?? "",
    utr_number: driver?.utr_number ?? "",
    ni_number: driver?.ni_number ?? "",
    vat_registered: driver?.vat_registered ?? false,
    vat_number: driver?.vat_number ?? "",
    bank_account_name: driver?.bank_account_name ?? "",
    bank_sort_code: driver?.bank_sort_code ?? "",
    bank_account_number: driver?.bank_account_number ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!driver) return;
    setError(null);

    const missing = REQUIRED.filter(({ key }) => !form[key]);
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((m) => m.label).join(", ")}.`);
      return;
    }

    setSubmitting(true);

    // Explicit field allowlist -- never spread raw form state -- matches
    // the DriverProfileUpdate type's contract.
    const payload: DriverProfileUpdate = {
      date_of_birth: form.date_of_birth || null,
      phone: form.phone || null,
      nationality: form.nationality || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      postcode: form.postcode || null,
      next_of_kin_name: form.next_of_kin_name || null,
      next_of_kin_phone: form.next_of_kin_phone || null,
      next_of_kin_relationship: form.next_of_kin_relationship || null,
      utr_number: form.utr_number || null,
      ni_number: form.ni_number || null,
      vat_registered: form.vat_registered,
      vat_number: form.vat_registered ? form.vat_number || null : null,
      bank_account_name: form.bank_account_name || null,
      bank_sort_code: form.bank_sort_code || null,
      bank_account_number: form.bank_account_number || null,
      profile_status: "completed",
    };

    const { error: updateError } = await supabase.from("drivers").update(payload).eq("id", driver.id);

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await reloadDriver();

    // Leaving is this screen's job now. It used to rely on the root layout
    // bouncing it away once profile_status flipped, which meant the screen
    // could only be exited by a redirect that also made it unreachable.
    router.replace("/(tabs)/home");
  }

  // Two different visits to one screen. A new driver is being onboarded and has
  // nowhere else to go; a driver who came back to add their bank details chose
  // to be here and must be able to leave without filling anything in. Same
  // form, different framing, and only one of them gets a way out.
  const onboarding = driver?.profile_status !== "completed";

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Measured on a device rather than assumed: with the keyboard up, this
          form had not moved a pixel and the focused field was entirely behind
          it. "padding" on Android as well as iOS, because nothing here resizes
          the window, so nothing but this moves the content. */}
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-6 pb-24 pt-6" keyboardShouldPersistTaps="handled">
          {!onboarding && (
            <Pressable
              onPress={() => router.replace("/(tabs)/home")}
              className="mb-4 flex-row items-center gap-1.5 self-start py-1"
            >
              <Text className="text-sm font-medium text-slate-600">&larr; Back</Text>
            </Pressable>
          )}

          <Text className="mb-1 text-2xl font-bold text-slate-900">
            {onboarding ? "Complete Your Profile" : "Your Details"}
          </Text>
          <Text className="mb-6 text-slate-500">
            {onboarding
              ? "We need a few more details before you can start using the app."
              : "Keep these up to date. Payroll needs your bank details, UTR and NI number before it can pay you."}
          </Text>

          {error && (
            <View className="mb-4 rounded-lg bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}

          <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Personal</Text>
          <DateField label="Date of Birth" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
          <Field label="Nationality" value={form.nationality} onChangeText={(v) => set("nationality", v)} autoCapitalize="words" />
          <Field label="Phone Number" value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />

          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Address</Text>
          <Field label="Address Line 1" value={form.address_line1} onChangeText={(v) => set("address_line1", v)} autoCapitalize="words" />
          <Field label="Address Line 2" value={form.address_line2} onChangeText={(v) => set("address_line2", v)} autoCapitalize="words" />
          <Field label="City" value={form.city} onChangeText={(v) => set("city", v)} autoCapitalize="words" />
          <Field label="Postcode" value={form.postcode} onChangeText={(v) => set("postcode", v.toUpperCase())} autoCapitalize="characters" />

          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency Contact</Text>
          <Field label="Contact Name" value={form.next_of_kin_name} onChangeText={(v) => set("next_of_kin_name", v)} autoCapitalize="words" />
          <Field label="Contact Phone" value={form.next_of_kin_phone} onChangeText={(v) => set("next_of_kin_phone", v)} keyboardType="phone-pad" />
          <Field label="Relationship to You" value={form.next_of_kin_relationship} onChangeText={(v) => set("next_of_kin_relationship", v)} placeholder="Partner, parent, friend..." autoCapitalize="words" />

          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tax & Banking</Text>
          {/* Optional on purpose. HMRC takes weeks or months to issue a UTR, so a
              new driver cannot supply one and must not be blocked waiting for it.
              Saying when it is needed is more use than marking it required. */}
          <Field label="UTR Number (when you have it)" value={form.utr_number} onChangeText={(v) => set("utr_number", v)} keyboardType="numeric" maxLength={10} />
          <Text className="-mt-3 mb-4 text-xs text-slate-500">
            Leave blank if HMRC has not sent yours yet. You can add it here any time — payroll needs it
            before it can pay you as self-employed.
          </Text>
          <Field label="NI Number" value={form.ni_number} onChangeText={(v) => set("ni_number", v.toUpperCase())} autoCapitalize="characters" maxLength={9} />

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-slate-700">VAT Registered</Text>
            <Switch value={form.vat_registered} onValueChange={(v) => set("vat_registered", v)} trackColor={{ true: "#f59e0b" }} />
          </View>
          {form.vat_registered && (
            <Field label="VAT Number" value={form.vat_number} onChangeText={(v) => set("vat_number", v.toUpperCase())} autoCapitalize="characters" />
          )}

          <Field label="Bank Account Name" value={form.bank_account_name} onChangeText={(v) => set("bank_account_name", v)} autoCapitalize="words" />
          <Field label="Sort Code" value={form.bank_sort_code} onChangeText={(v) => set("bank_sort_code", v)} keyboardType="numeric" maxLength={6} />
          <Field label="Account Number" value={form.bank_account_number} onChangeText={(v) => set("bank_account_number", v)} keyboardType="numeric" maxLength={8} />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="mt-2 items-center rounded-lg bg-slate-900 py-3 disabled:opacity-50"
          >
            {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Save & Continue</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

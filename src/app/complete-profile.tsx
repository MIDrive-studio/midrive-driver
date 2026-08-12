import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { DriverProfileUpdate } from "@/types/driver";

// Plain strings for every text field -- always initialized to "" and only
// converted to `string | null` (DriverProfileUpdate's shape) at submit time.
type FormState = {
  date_of_birth: string;
  nationality: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  emergency_contact: string;
  emergency_phone: string;
  utr_number: string;
  ni_number: string;
  vat_registered: boolean;
  vat_number: string;
  bank_account_name: string;
  bank_sort_code: string;
  bank_account_number: string;
};

const emptyForm: FormState = {
  date_of_birth: "",
  nationality: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  emergency_contact: "",
  emergency_phone: "",
  utr_number: "",
  ni_number: "",
  vat_registered: false,
  vat_number: "",
  bank_account_name: "",
  bank_sort_code: "",
  bank_account_number: "",
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
      />
    </View>
  );
}

export default function CompleteProfileScreen() {
  const { driver, reloadDriver } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!driver) return;
    setError(null);

    // Matches PROFILE_REQUIRED_FIELDS in lib/profile-completion.ts, minus
    // "phone" (admin-set at driver creation, not edited on this screen).
    const required: (keyof FormState)[] = [
      "date_of_birth",
      "address_line1",
      "city",
      "postcode",
      "emergency_contact",
      "emergency_phone",
      "ni_number",
      "utr_number",
      "bank_account_name",
      "bank_sort_code",
      "bank_account_number",
    ];
    const missing = required.find((key) => !form[key]);
    if (missing) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    // Explicit field allowlist -- never spread raw form state -- matches
    // the DriverProfileUpdate type's contract.
    const payload: DriverProfileUpdate = {
      date_of_birth: form.date_of_birth || null,
      nationality: form.nationality || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      postcode: form.postcode || null,
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
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
    // Root layout's redirect effect sends us to /(tabs)/home once
    // driver.profile_status flips to "completed".
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-2xl font-bold text-slate-900">Complete Your Profile</Text>
        <Text className="mb-6 text-slate-500">
          We need a few more details before you can start using the app.
        </Text>

        {error && (
          <View className="mb-4 rounded-lg bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Personal</Text>
        <Field label="Date of Birth (YYYY-MM-DD)" value={form.date_of_birth} onChangeText={(v) => set("date_of_birth", v)} placeholder="1990-01-31" />
        <Field label="Nationality" value={form.nationality} onChangeText={(v) => set("nationality", v)} />

        <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Address</Text>
        <Field label="Address Line 1" value={form.address_line1} onChangeText={(v) => set("address_line1", v)} />
        <Field label="Address Line 2" value={form.address_line2} onChangeText={(v) => set("address_line2", v)} />
        <Field label="City" value={form.city} onChangeText={(v) => set("city", v)} />
        <Field label="Postcode" value={form.postcode} onChangeText={(v) => set("postcode", v)} />

        <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency Contact</Text>
        <Field label="Contact Name" value={form.emergency_contact} onChangeText={(v) => set("emergency_contact", v)} />
        <Field label="Contact Phone" value={form.emergency_phone} onChangeText={(v) => set("emergency_phone", v)} keyboardType="phone-pad" />

        <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tax & Banking</Text>
        <Field label="UTR Number" value={form.utr_number} onChangeText={(v) => set("utr_number", v)} keyboardType="numeric" />
        <Field label="NI Number" value={form.ni_number} onChangeText={(v) => set("ni_number", v)} />

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-slate-700">VAT Registered</Text>
          <Switch value={form.vat_registered} onValueChange={(v) => set("vat_registered", v)} />
        </View>
        {form.vat_registered && (
          <Field label="VAT Number" value={form.vat_number} onChangeText={(v) => set("vat_number", v)} />
        )}

        <Field label="Bank Account Name" value={form.bank_account_name} onChangeText={(v) => set("bank_account_name", v)} />
        <Field label="Sort Code" value={form.bank_sort_code} onChangeText={(v) => set("bank_sort_code", v)} keyboardType="numeric" />
        <Field label="Account Number" value={form.bank_account_number} onChangeText={(v) => set("bank_account_number", v)} keyboardType="numeric" />

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-2 items-center rounded-lg bg-slate-900 py-3 disabled:opacity-50"
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Save & Continue</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

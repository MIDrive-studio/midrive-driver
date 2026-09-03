import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

// The personal details onboarding asks for.
//
// The list is not this screen's to choose. driver_onboarding_state() decides
// what "Personal details" means -- name, date of birth, nationality, phone,
// National Insurance number and a next of kin with a relationship -- and this
// form exists to fill exactly that. When the two disagree the checklist wins,
// and a driver fills in every box here and is still told something is missing.
// So the fields below are in the same order and say the same things.
//
// Name is shown and not editable: guard_driver_self_update() refuses a driver
// changing their own name, and offering a box the database will reject is
// worse than not offering one.

type FormState = {
  date_of_birth: string;
  nationality: string;
  phone: string;
  ni_number: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
};

// Every one of these is required, because the checker requires every one. The
// labels are what a person would call the thing, and the error names them the
// same way, so "still needed: contact number" and the box called Contact
// number are recognisably the same field.
const FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "date_of_birth", label: "Date of birth" },
  { key: "nationality", label: "Nationality" },
  { key: "phone", label: "Contact number" },
  { key: "ni_number", label: "National Insurance number" },
  { key: "next_of_kin_name", label: "Next of kin" },
  { key: "next_of_kin_phone", label: "Their phone number" },
  { key: "next_of_kin_relationship", label: "How you know them" },
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
      <Text className="mb-1 text-sm font-medium text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
      />
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00Z`) : new Date(1990, 0, 1);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(selected.toISOString().slice(0, 10));
  }

  const shown = value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-ink-muted">{label}</Text>
      <Pressable onPress={() => setShow(true)} className="rounded-lg border border-line-strong bg-white px-4 py-3">
        <Text className={shown ? "text-ink" : "text-ink-faint"}>{shown ?? "Select date"}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={handleChange}
        />
      )}
      {show && Platform.OS === "ios" && (
        <Pressable onPress={() => setShow(false)} className="mt-1 self-end">
          <Text className="text-sm font-medium text-marine-600">Done</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PersonalStep() {
  const router = useRouter();
  const { driver, reloadDriver } = useAuth();
  const [form, setForm] = useState<FormState>(() => ({
    date_of_birth: driver?.date_of_birth ?? "",
    nationality: driver?.nationality ?? "",
    phone: driver?.phone ?? "",
    ni_number: driver?.ni_number ?? "",
    next_of_kin_name: driver?.next_of_kin_name ?? "",
    next_of_kin_phone: driver?.next_of_kin_phone ?? "",
    next_of_kin_relationship: driver?.next_of_kin_relationship ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!driver) return;
    setError(null);

    const missing = FIELDS.filter(({ key }) => !form[key].trim());
    if (missing.length > 0) {
      setError(`Still needed: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`);
      return;
    }

    setSaving(true);

    // An explicit list, never a spread of form state. The same reasoning as
    // Complete Profile: a field added to the form later should not silently
    // become a field this screen writes to the database.
    const { error: saveError } = await supabase
      .from("drivers")
      .update({
        date_of_birth: form.date_of_birth,
        nationality: form.nationality.trim(),
        phone: form.phone.trim(),
        ni_number: form.ni_number.trim().toUpperCase(),
        next_of_kin_name: form.next_of_kin_name.trim(),
        next_of_kin_phone: form.next_of_kin_phone.trim(),
        next_of_kin_relationship: form.next_of_kin_relationship.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    // The driver record the rest of the app holds is now out of date. The
    // checklist re-reads the onboarding state on focus; this refreshes the
    // record the form itself was built from.
    await reloadDriver();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Your details</Text>
      </View>

      {/* The keyboard covered the lower fields.

          On iOS nothing moves unless something moves it, so padding is added
          below the content. On Android the window itself resizes, and adding
          padding as well pushes the content twice as far -- so the behaviour is
          left undefined there, matching the accident report screen, which is the
          longest form in the app and the one this pattern was proven on.

          The generous bottom padding is the other half: resizing only helps if
          there is somewhere for the last field to scroll to. */}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
          <Text className="mb-5 text-sm text-ink-subtle">
            {driver?.full_name ? `We have you as ${driver.full_name}. ` : ""}
            Ask the office if your name needs changing.
          </Text>

          <DateField label="Date of birth" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
          <Field
            label="Nationality"
            value={form.nationality}
            onChangeText={(v) => set("nationality", v)}
            autoCapitalize="words"
          />
          <Field
            label="Contact number"
            value={form.phone}
            onChangeText={(v) => set("phone", v)}
            keyboardType="phone-pad"
          />
          <Field
            label="National Insurance number"
            value={form.ni_number}
            onChangeText={(v) => set("ni_number", v)}
            placeholder="QQ 12 34 56 C"
            autoCapitalize="characters"
            maxLength={13}
          />

          <Text className="mb-1 mt-2 text-base font-semibold text-ink">Next of kin</Text>
          <Text className="mb-4 text-sm text-ink-subtle">Who we would call if something happened to you at work.</Text>

          <Field
            label="Their name"
            value={form.next_of_kin_name}
            onChangeText={(v) => set("next_of_kin_name", v)}
            autoCapitalize="words"
          />
          <Field
            label="Their phone number"
            value={form.next_of_kin_phone}
            onChangeText={(v) => set("next_of_kin_phone", v)}
            keyboardType="phone-pad"
          />
          <Field
            label="How you know them"
            value={form.next_of_kin_relationship}
            onChangeText={(v) => set("next_of_kin_relationship", v)}
            placeholder="Partner, parent, friend..."
            autoCapitalize="words"
          />

          {error ? (
            <View className="mb-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
              <Text className="text-sm text-bad-strong">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 px-6 py-4 active:bg-marine-700 disabled:opacity-50"
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-base font-semibold text-white">{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

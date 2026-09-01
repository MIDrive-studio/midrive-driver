import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { addressCover, monthYear, shortDate, type AddressLine } from "@/lib/address-cover";

// Seven years of addresses, with no gaps.
//
// The hard part is not the form, it is knowing when you are finished. A driver
// adding three addresses has no way to tell whether they have covered seven
// years unless something says so, and "Seven years of addresses are needed,
// with no gaps" -- which is all the checklist can say -- does not tell anyone
// which year is missing. So this screen names the date it still needs back to,
// and recomputes it every time a line is added.

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "characters" | "words";
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
      />
    </View>
  );
}

function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [show, setShow] = useState(false);
  const current = value ? new Date(`${value}T00:00:00Z`) : new Date();

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(selected.toISOString().slice(0, 10));
  }

  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-medium text-ink-muted">{label}</Text>
      <Pressable onPress={() => setShow(true)} className="rounded-lg border border-line-strong bg-white px-4 py-3">
        <Text className={value ? "text-ink" : "text-ink-faint"}>
          {value ? monthYear(new Date(`${value}T00:00:00Z`)) : "Select month"}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={current}
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

export default function AddressesStep() {
  const router = useRouter();
  const { driver } = useAuth();
  const [lines, setLines] = useState<AddressLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    lived_from: "",
    lived_to: "",
    stillHere: false,
  });

  const load = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("driver_address_history")
      .select("id, address_line1, address_line2, city, postcode, lived_from, lived_to")
      .eq("driver_id", driver.id)
      .order("lived_from", { ascending: false });
    setLines((data as AddressLine[]) ?? []);
    setError(loadError?.message ?? null);
    setLoading(false);
  }, [driver]);

  useEffect(() => {
    load();
  }, [load]);

  const cover = addressCover(lines);

  async function handleAdd() {
    if (!driver) return;
    setError(null);

    if (!form.address_line1.trim() || !form.lived_from) {
      setError("The address and the month you moved in are both needed.");
      return;
    }
    if (!form.stillHere && !form.lived_to) {
      setError("Say when you left, or tick that you still live there.");
      return;
    }
    if (!form.stillHere && form.lived_to < form.lived_from) {
      setError("You cannot have left before you moved in.");
      return;
    }

    setSaving(true);
    const { error: addError } = await supabase.from("driver_address_history").insert({
      driver_id: driver.id,
      company_id: driver.company_id,
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      postcode: form.postcode.trim() || null,
      lived_from: form.lived_from,
      lived_to: form.stillHere ? null : form.lived_to,
    });
    setSaving(false);

    if (addError) {
      setError(addError.message);
      return;
    }

    setForm({ address_line1: "", address_line2: "", city: "", postcode: "", lived_from: "", lived_to: "", stillHere: false });
    setAdding(false);
    await load();
  }

  async function handleRemove(id: string) {
    setError(null);
    const { error: removeError } = await supabase.from("driver_address_history").delete().eq("id", id);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    await load();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Where you have lived</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10" keyboardShouldPersistTaps="handled">
        <View
          className={`mb-5 rounded-xl border px-4 py-3 ${
            cover.covered ? "border-ok-line bg-ok-surface" : "border-warn-line bg-warn-surface"
          }`}
        >
          <Text className={`text-sm font-semibold ${cover.covered ? "text-ok-strong" : "text-warn-strong"}`}>
            {cover.covered ? "That is seven years covered." : "We need seven years, with no gaps."}
          </Text>
          {!cover.covered ? (
            <Text className="mt-1 text-sm text-ink-muted">
              {lines.length === 0
                ? `Start with where you live now and work backwards to ${monthYear(cover.needFrom)}.`
                : `Covered back to ${monthYear(cover.reachedTo)}. Add where you lived before that, down to ${monthYear(cover.needFrom)}.`}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#1f5089" />
        ) : (
          lines.map((line) => (
            <View key={line.id} className="mb-2 flex-row items-start gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{line.address_line1}</Text>
                {line.address_line2 || line.city || line.postcode ? (
                  <Text className="text-sm text-ink-subtle">
                    {[line.address_line2, line.city, line.postcode].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
                <Text className="mt-1 text-sm text-ink-muted">
                  {shortDate(line.lived_from)} — {line.lived_to ? shortDate(line.lived_to) : "now"}
                </Text>
              </View>
              <Pressable onPress={() => handleRemove(line.id)} hitSlop={10} className="p-1">
                <Feather name="trash-2" size={18} color="#b91c1c" />
              </Pressable>
            </View>
          ))
        )}

        {error ? (
          <View className="my-3 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
          </View>
        ) : null}

        {adding ? (
          <View className="mt-3 rounded-xl border border-line bg-white p-4">
            <Field label="Address" value={form.address_line1} onChangeText={(v) => setForm((f) => ({ ...f, address_line1: v }))} autoCapitalize="words" />
            <Field label="Address line 2 (optional)" value={form.address_line2} onChangeText={(v) => setForm((f) => ({ ...f, address_line2: v }))} autoCapitalize="words" />
            <Field label="Town or city" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
            <Field label="Postcode" value={form.postcode} onChangeText={(v) => setForm((f) => ({ ...f, postcode: v }))} autoCapitalize="characters" />
            <MonthField label="Moved in" value={form.lived_from} onChange={(v) => setForm((f) => ({ ...f, lived_from: v }))} />

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-ink-muted">I still live here</Text>
              <Switch
                value={form.stillHere}
                onValueChange={(v) => setForm((f) => ({ ...f, stillHere: v, lived_to: v ? "" : f.lived_to }))}
                trackColor={{ true: "#1f5089", false: "#cbd5e1" }}
              />
            </View>

            {!form.stillHere ? (
              <MonthField label="Moved out" value={form.lived_to} onChange={(v) => setForm((f) => ({ ...f, lived_to: v }))} />
            ) : null}

            <View className="mt-1 flex-row gap-2">
              <Pressable
                onPress={handleAdd}
                disabled={saving}
                className="flex-1 items-center rounded-xl bg-marine-600 py-3 active:bg-marine-700 disabled:opacity-50"
              >
                <Text className="text-sm font-semibold text-white">{saving ? "Adding..." : "Add this address"}</Text>
              </Pressable>
              <Pressable onPress={() => setAdding(false)} className="items-center rounded-xl border border-line-strong px-4 py-3">
                <Text className="text-sm font-semibold text-ink-muted">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-4 active:bg-surface-sunken"
          >
            <Feather name="plus" size={18} color="#1f5089" />
            <Text className="text-sm font-semibold text-marine-700">Add an address</Text>
          </Pressable>
        )}

        {cover.covered ? (
          <Pressable
            onPress={() => router.back()}
            className="mt-5 items-center rounded-xl bg-marine-600 py-4 active:bg-marine-700"
          >
            <Text className="text-base font-semibold text-white">Done</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

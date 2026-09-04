import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { addressCover, monthYear, shortDate, type AddressLine } from "@/lib/address-cover";
import { lookupPostcode, type PickableAddress } from "@/lib/portal-api";
import { formatAsTyped, isComplete } from "@/lib/postcode";

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
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<PickableAddress[] | null>(null);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  // The address the driver picked. Held so that changing the postcode
  // afterwards can throw it away: an address chosen for one postcode is not an
  // address at another, and leaving it there is how somebody ends up filed at
  // a house they have never been to.
  const [chosen, setChosen] = useState<PickableAddress | null>(null);
  // Which postcode the list on screen belongs to, so a stale answer arriving
  // late cannot overwrite a newer one.
  const lookedUp = useRef<string>("");

  const [form, setForm] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postcode: "",
    lived_from: "",
    lived_to: "",
    stillHere: false,
  });

  const EMPTY_FORM = {
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postcode: "",
    lived_from: "",
    lived_to: "",
    stillHere: false,
  };

  const load = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("driver_address_history")
      .select("id, address_line1, address_line2, city, county, postcode, lived_from, lived_to")
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

  /**
   * The postcode changed.
   *
   * Formatting happens on the keystroke because the rule is fixed -- the
   * inward code is the last three characters -- and the lookup happens only
   * once there is a whole postcode to look up. Typing "N", "NN", "NN1" must
   * not be three requests to a service that bills per request.
   */
  function onPostcodeChange(raw: string) {
    const formatted = formatAsTyped(raw);
    setForm((f) => ({ ...f, postcode: formatted }));
    setError(null);

    // Anything chosen belonged to the old postcode. An address selected for
    // one postcode is not an address at another, and quietly keeping it is how
    // somebody ends up filed at a house they have never been to.
    if (chosen && formatted !== chosen.postcode) {
      setChosen(null);
      setForm((f) => ({ ...f, address_line1: "", address_line2: "", city: "", county: "" }));
    }

    if (formatted !== lookedUp.current) {
      setFound(null);
      setLookupNote(null);
    }

    if (isComplete(formatted)) {
      runLookup(formatted);
    } else if (formatted.length > 0) {
      setLookupNote("Keep going -- we will look it up once the postcode is complete.");
    }
  }

  /**
   * What the postcode can tell us, which is more on some days than others.
   *
   * The door numbers are licensed data, so whether a list comes back depends
   * on what the office pays for. Everything here degrades rather than fails:
   * a list to pick from if there is one, the town filled in if not, and the
   * fields typed by hand if the service cannot be reached at all. None of
   * those outcomes stops somebody entering an address, because an address
   * they cannot enter is an onboarding they cannot finish.
   */
  async function runLookup(postcode: string) {
    // Asked for already, and the answer is on screen.
    if (lookedUp.current === postcode && found) return;

    lookedUp.current = postcode;
    setLooking(true);
    setFound(null);
    setLookupNote(null);

    const result = await lookupPostcode(postcode);

    // A slower earlier request landing after a newer one would put the wrong
    // street on screen, so a stale answer is dropped rather than shown.
    if (lookedUp.current !== postcode) return;

    setLooking(false);

    if (!result.ok) {
      setLookupNote(
        result.unavailable
          ? "We could not check that just now. Type the address in below."
          : result.error
      );
      return;
    }

    const { lookup } = result.value;
    setForm((f) => ({
      ...f,
      postcode: lookup.postcode,
      city: f.city || (lookup.city ?? ""),
      county: f.county || (lookup.county ?? ""),
    }));

    if (lookup.hasAddresses) {
      setFound(lookup.addresses);
      setLookupNote(null);
      return;
    }

    // A real postcode with nothing behind it is a different thing from a
    // postcode that does not exist, and the driver has to be told which.
    setLookupNote(
      lookup.city
        ? `Postcode found. We think that is ${lookup.city} -- change it if not, and add the street below.`
        : "Postcode found. Add the street and number below."
    );
  }

  /** Everything the provider knew, onto the form, in one go. */
  function pick(address: PickableAddress) {
    setChosen(address);
    setFound(null);
    setLookupNote(null);
    setForm((f) => ({
      ...f,
      address_line1: address.line1,
      address_line2: address.line2 ?? "",
      city: address.city ?? "",
      county: address.county ?? "",
      postcode: address.postcode,
    }));
  }
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

    // Whether what is in the form is still the record that was selected.
    const stillMatches =
      chosen !== null &&
      chosen.line1 === form.address_line1.trim() &&
      (chosen.line2 ?? "") === form.address_line2.trim() &&
      (chosen.city ?? "") === form.city.trim() &&
      chosen.postcode === form.postcode.trim();

    setSaving(true);
    const { error: addError } = await supabase.from("driver_address_history").insert({
      driver_id: driver.id,
      company_id: driver.company_id,
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      county: form.county.trim() || null,
      postcode: form.postcode.trim() || null,

      // The parts, only when they came from a provider. A driver who edited a
      // field after picking has changed the address, so the components no
      // longer describe what is stored and are dropped rather than left to
      // contradict the lines above them.
      building_number: stillMatches ? chosen!.buildingNumber : null,
      building_name: stillMatches ? chosen!.buildingName : null,
      street: stillMatches ? chosen!.street : null,

      lived_from: form.lived_from,
      lived_to: form.stillHere ? null : form.lived_to,
    });
    setSaving(false);

    if (addError) {
      setError(addError.message);
      return;
    }

    setForm(EMPTY_FORM);
    setFound(null);
    setLookupNote(null);
    setChosen(null);
    lookedUp.current = "";
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

      {/* The keyboard covered the lower fields.

          "padding" on both platforms, which is not what the rest of the app
          does. The usual advice -- leave Android alone because the window
          resizes itself -- was tested on the device and is false here: with the
          keyboard up, the form had not moved a pixel and the focused field was
          entirely behind it. Nothing resizes, so nothing but this moves it.

          The generous bottom padding is the other half: resizing only helps if
          there is somewhere for the last field to scroll to. */}
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
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
              {/* Postcode first, because it is the short thing somebody knows
                  by heart and everything else can often be got from it. The
                  fields below stay editable either way -- a lookup that fills
                  them in is saving typing, not deciding the answer. */}
              <Text className="mb-1 text-sm font-medium text-ink-muted">Postcode</Text>
              <TextInput
                value={form.postcode}
                onChangeText={onPostcodeChange}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="NN1 4LN"
                className="mb-2 rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
              />

              {looking ? (
                <View className="mb-3 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#1f5089" />
                  <Text className="text-sm text-ink-subtle">Looking up addresses...</Text>
                </View>
              ) : lookupNote ? (
                <Text className="mb-3 text-sm text-ink-subtle">{lookupNote}</Text>
              ) : null}

              {/* The list. Shown only while there is a choice to make: once an
                  address is picked it is replaced by the filled-in fields, so
                  the screen never shows both a question and its answer. */}
              {found && found.length > 0 ? (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-ink-muted">
                    {found.length} {found.length === 1 ? "address" : "addresses"} at this postcode
                  </Text>
                  <View className="overflow-hidden rounded-xl border border-line-strong">
                    {found.map((a, index) => (
                      <Pressable
                        key={`${a.label}-${index}`}
                        onPress={() => pick(a)}
                        className={`bg-white px-3 py-3 active:bg-marine-50 ${index ? "border-t border-line" : ""}`}
                      >
                        <Text className="text-[15px] text-ink">{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {chosen ? (
                <View className="mb-4 flex-row items-start gap-2 rounded-lg border border-ok-line bg-ok-surface px-3 py-2.5">
                  <Feather name="check" size={16} color="#047857" style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-ok-strong">
                    Selected. Change the postcode above to pick a different address.
                  </Text>
                </View>
              ) : null}

              <Field label="Address" value={form.address_line1} onChangeText={(v) => setForm((f) => ({ ...f, address_line1: v }))} autoCapitalize="words" />
              <Field label="Address line 2 (optional)" value={form.address_line2} onChangeText={(v) => setForm((f) => ({ ...f, address_line2: v }))} autoCapitalize="words" />
              <Field label="Town or city" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
              <Field label="County (optional)" value={form.county} onChangeText={(v) => setForm((f) => ({ ...f, county: v }))} autoCapitalize="words" />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

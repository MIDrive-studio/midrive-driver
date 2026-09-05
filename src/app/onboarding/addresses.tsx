import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { addressCover, monthYear, shortDate, type AddressLine } from "@/lib/address-cover";
import { lookupPostcode, searchAddresses, type PickableAddress } from "@/lib/portal-api";
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
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<PickableAddress[] | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  // Counts searches so a slow older one can be told from the current one.
  const searchSeq = useRef(0);
  // The record the driver picked. Held so that what gets stored can be checked
  // against it -- editing a field afterwards means the components no longer
  // describe the address, and stale parts are worse than none.
  const [chosen, setChosen] = useState<PickableAddress | null>(null);
  // Which postcode the list on screen belongs to, so a stale answer arriving
  // late cannot overwrite a newer one.
  const lookedUp = useRef<string>("");

  // The number or name is held apart from the street so it can be insisted on.
  // Asked as one line, a street-only result from the map looked exactly like a
  // complete address and saved as one.
  const EMPTY_FORM = {
    building: "",
    street: "",
    address_line2: "",
    city: "",
    county: "",
    postcode: "",
    lived_from: "",
    lived_to: "",
    stillHere: false,
  };

  const [form, setForm] = useState(EMPTY_FORM);

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
   * Searching, on a pause rather than a keystroke.
   *
   * There is no minimum length. "1" is a search and so is "14 Luton Road
   * Dunstable"; the results narrow because the query got more specific, not
   * because a character count let it through.
   *
   * What keeps that inside OpenStreetMap's usage policy is this timer and the
   * throttle on the server. A request follows a pause in typing, not a letter,
   * so somebody typing an address quickly makes one request rather than
   * twenty.
   */
  useEffect(() => {
    const query = search.trim();

    if (query === "") {
      setSuggestions(null);
      setSearchNote(null);
      return;
    }

    const timer = setTimeout(() => {
      runSearch(query);
    }, 350);

    // Typing again before the timer fires cancels it, which is why holding a
    // key down does not queue a request per repeat.
    return () => clearTimeout(timer);
  }, [search]);

  async function runSearch(query: string) {
    // Marks this as the newest search. Anything older that lands after it is
    // discarded rather than shown -- typing "14 Lut" then "14 Luton Road" must
    // not end with the first answer overwriting the second.
    const mine = ++searchSeq.current;

    setSearching(true);
    const result = await searchAddresses(query);

    if (mine !== searchSeq.current) return;

    setSearching(false);

    if (!result.ok) {
      setSuggestions(null);
      setSearchNote(
        result.unavailable
          ? "Address search is not available just now. Type the address in below."
          : result.error
      );
      return;
    }

    const { addresses } = result.value;
    setSuggestions(addresses);
    // Said plainly. Open data does not have every house, and a driver whose
    // address is missing needs to know to type it rather than keep trying.
    setSearchNote(addresses.length === 0 ? "No match. Type the address in below." : null);
  }

  /** Everything the record held, onto the form, in one go. */
  function pick(address: PickableAddress) {
    setChosen(address);
    setSuggestions(null);
    setSearchNote(null);
    setSearch("");
    setForm((f) => ({
      ...f,
      // Whatever the record actually has. OpenStreetMap often has no house
      // number, and this is deliberately left empty rather than filled with
      // the street when it does not -- an empty box the driver must complete
      // is the point.
      building: address.buildingNumber ?? address.buildingName ?? "",
      street: address.street ?? address.line1,
      address_line2: address.line2 ?? "",
      city: address.city ?? "",
      county: address.county ?? "",
      // Never overwritten with an empty one: plenty of OSM records have no
      // postcode, and blanking what the driver typed would be a step back.
      postcode: address.postcode || f.postcode,
    }));
  }

  /**
   * The postcode, typed by hand.
   *
   * Kept for the driver whose house is not in OpenStreetMap: it formats the
   * postcode and fills in the town, which is most of the typing saved even
   * when the search found nothing.
   */
  function onPostcodeChange(raw: string) {
    const formatted = formatAsTyped(raw);
    setForm((f) => ({ ...f, postcode: formatted }));
    setError(null);

    if (isComplete(formatted) && formatted !== lookedUp.current) {
      lookedUp.current = formatted;
      lookupPostcode(formatted).then((result) => {
        if (!result.ok) return;
        const { lookup } = result.value;
        setForm((f) => ({
          ...f,
          postcode: lookup.postcode,
          city: f.city || (lookup.city ?? ""),
          county: f.county || (lookup.county ?? ""),
        }));
      });
    }
  }
  async function handleAdd() {
    if (!driver) return;
    setError(null);

    // A street with no number is not somewhere anybody lives, and it is what a
    // map search returns when it has nothing better. It used to save.
    if (!form.building.trim()) {
      setError("The house number or name is needed. If the search did not fill it in, type it yourself.");
      return;
    }
    if (!form.street.trim() || !form.lived_from) {
      setError("The street and the month you moved in are both needed.");
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

    const line1 = `${form.building.trim()} ${form.street.trim()}`.trim();

    setSaving(true);
    const { error: addError } = await supabase.from("driver_address_history").insert({
      driver_id: driver.id,
      company_id: driver.company_id,
      address_line1: line1,
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      county: form.county.trim() || null,
      postcode: form.postcode.trim() || null,

      // The parts, only when they came from a provider. A driver who edited a
      // field after picking has changed the address, so the components no
      // longer describe what is stored and are dropped rather than left to
      // contradict the lines above them.
      // What the driver actually entered, whether or not it came from the map.
      // Anything with a digit in it is a number and the rest is a name -- the
      // one distinction worth drawing, and it is drawn from what was typed
      // rather than guessed at.
      building_number: /d/.test(form.building.trim()) ? form.building.trim() : null,
      building_name: /d/.test(form.building.trim()) ? null : form.building.trim(),
      street: form.street.trim() || null,

      lived_from: form.lived_from,
      lived_to: form.stillHere ? null : form.lived_to,
    });
    setSaving(false);

    if (addError) {
      setError(addError.message);
      return;
    }

    setForm(EMPTY_FORM);
    setSearch("");
    setSuggestions(null);
    setSearchNote(null);
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
              {/* Search first, and anything at all is a search: a number, a
                  street, a town, a postcode, or all of them. The fields below
                  stay editable throughout -- a suggestion that fills them in is
                  saving typing, not deciding the answer. */}
              <Text className="mb-1 text-sm font-medium text-ink-muted">Find your address</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Start typing, e.g. 14 Luton Road"
                className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
              />

              {searching ? (
                <View className="mb-3 mt-2 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#1f5089" />
                  <Text className="text-sm text-ink-subtle">Searching...</Text>
                </View>
              ) : searchNote ? (
                <Text className="mb-3 mt-2 text-sm text-ink-subtle">{searchNote}</Text>
              ) : null}

              {/* Directly under the field, as a dropdown reads. Each row is a
                  full-width target because this is used with a thumb. */}
              {suggestions && suggestions.length > 0 ? (
                <View className="mb-4 mt-2 overflow-hidden rounded-xl border border-line-strong">
                  {suggestions.map((a, index) => (
                    <Pressable
                      key={`${a.label}-${index}`}
                      onPress={() => pick(a)}
                      className={`bg-white px-3 py-3.5 active:bg-marine-50 ${index ? "border-t border-line" : ""}`}
                    >
                      <Text className="text-[15px] text-ink">{a.line1}</Text>
                      <Text className="mt-0.5 text-sm text-ink-subtle">
                        {[a.city, a.county, a.postcode].filter(Boolean).join(", ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {chosen ? (
                <View className="mb-4 mt-2 flex-row items-start gap-2 rounded-lg border border-ok-line bg-ok-surface px-3 py-2.5">
                  <Feather name="check" size={16} color="#047857" style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-ok-strong">
                    Filled in below. Change anything that is not right, or search again.
                  </Text>
                </View>
              ) : null}

              <View className="mb-4 mt-1 h-px bg-line" />

              <Field
                label="House number or name"
                value={form.building}
                onChangeText={(v) => setForm((f) => ({ ...f, building: v }))}
                autoCapitalize="words"
              />
              <Field
                label="Street"
                value={form.street}
                onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
                autoCapitalize="words"
              />
              <Field label="Address line 2 (optional)" value={form.address_line2} onChangeText={(v) => setForm((f) => ({ ...f, address_line2: v }))} autoCapitalize="words" />
              <Field label="Town or city" value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} autoCapitalize="words" />
              <Field label="County (optional)" value={form.county} onChangeText={(v) => setForm((f) => ({ ...f, county: v }))} autoCapitalize="words" />

              {/* Typed rather than searched. It still formats itself and
                  fills in the town, which is most of the typing saved for
                  somebody whose address is not in the map. */}
              <View className="mb-3">
                <Text className="mb-1 text-sm font-medium text-ink-muted">Postcode</Text>
                <TextInput
                  value={form.postcode}
                  onChangeText={onPostcodeChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="NN1 4LN"
                  className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
                />
              </View>
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

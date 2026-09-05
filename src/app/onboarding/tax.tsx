import { useState } from "react";
import { leaveStep } from "@/lib/go-back";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

// Tax, as far as onboarding needs it.
//
// The rule this fills in is deliberate and worth stating, because it looks like
// a missing validation until you know why: a UTR number is NOT required. HMRC
// can take months to issue one, and requiring it before a driver may work would
// hold up every new starter for a quarter. So the question is required and the
// number is not -- a driver who says they are applying has answered.
//
// VAT is the other half: most drivers are not registered, and the number is
// only needed from the ones who are.

type UtrStatus = "has" | "applying";

export default function TaxStep() {
  const router = useRouter();
  const { driver, reloadDriver } = useAuth();

  // Only 'has' and 'applying' exist in the database's check constraint. The
  // app's Driver type also lists "none", which the database would refuse, so
  // it is deliberately not offered here.
  const [status, setStatus] = useState<UtrStatus | null>(
    driver?.utr_status === "has" || driver?.utr_status === "applying" ? driver.utr_status : null
  );
  const [utrNumber, setUtrNumber] = useState(driver?.utr_number ?? "");
  const [vatRegistered, setVatRegistered] = useState(Boolean(driver?.vat_registered));
  const [vatNumber, setVatNumber] = useState(driver?.vat_number ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!driver) return;
    setError(null);

    if (!status) {
      setError("Please say whether you have a UTR number yet.");
      return;
    }

    const utr = utrNumber.replace(/\D/g, "");
    if (status === "has" && utr.length !== 10) {
      setError("A UTR number is ten digits. If you have not been sent one yet, choose 'Not yet'.");
      return;
    }
    if (vatRegistered && !vatNumber.trim()) {
      setError("Your VAT number is needed, or turn VAT registered off.");
      return;
    }

    setSaving(true);

    const { error: saveError } = await supabase
      .from("drivers")
      .update({
        utr_status: status,
        // Cleared rather than left behind when the answer changes to "not yet",
        // so the record cannot hold a number beside an answer that denies it.
        utr_number: status === "has" ? utr : null,
        vat_registered: vatRegistered,
        vat_number: vatRegistered ? vatNumber.trim().toUpperCase() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await reloadDriver();
    leaveStep(router);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => leaveStep(router)} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Tax details</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
          <Text className="mb-5 text-sm text-ink-muted">
            You work self-employed, so HMRC needs a Unique Taxpayer Reference for you. You do not need it to start.
          </Text>

          {error ? (
            <View className="mb-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
              <Text className="text-sm text-bad-strong">{error}</Text>
            </View>
          ) : null}

          <Text className="mb-2 text-sm font-medium text-ink-muted">Do you have a UTR number yet?</Text>
          <View className="mb-4 flex-row gap-2">
            {([
              { value: "has" as const, label: "Yes, I have one" },
              { value: "applying" as const, label: "Not yet" },
            ]).map((option) => {
              const picked = status === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setStatus(option.value)}
                  className={`flex-1 items-center rounded-xl border py-3 ${
                    picked ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${picked ? "text-marine-700" : "text-ink-muted"}`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {status === "has" ? (
            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-ink-muted">UTR number</Text>
              <TextInput
                value={utrNumber}
                onChangeText={(v) => setUtrNumber(v.replace(/\D/g, "").slice(0, 10))}
                placeholder="1234567890"
                keyboardType="number-pad"
                maxLength={10}
                className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
              />
              <Text className="mt-1 text-xs text-ink-subtle">
                Ten digits. On letters from HMRC, and in your HMRC online account.
              </Text>
            </View>
          ) : status === "applying" ? (
            <View className="mb-4 rounded-lg border border-line bg-surface-sunken px-4 py-3">
              <Text className="text-sm text-ink-muted">
                That is fine &mdash; you can start work without it. Add it here as soon as HMRC sends it, because payroll
                needs it before it can pay you as self-employed.
              </Text>
            </View>
          ) : null}

          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-medium text-ink">VAT registered</Text>
              <Text className="mt-0.5 text-xs text-ink-subtle">Most drivers are not. Leave this off if unsure.</Text>
            </View>
            <Switch
              value={vatRegistered}
              onValueChange={setVatRegistered}
              trackColor={{ true: "#1f5089", false: "#cbd5e1" }}
            />
          </View>

          {vatRegistered ? (
            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-ink-muted">VAT number</Text>
              <TextInput
                value={vatNumber}
                onChangeText={setVatNumber}
                placeholder="GB123456789"
                autoCapitalize="characters"
                className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
              />
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-50"
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-base font-semibold text-white">{saving ? "Saving..." : "Save tax details"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

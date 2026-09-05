import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

// Where the driver gets paid.
//
// The last thing onboarding asks for, and deliberately so: these are the
// details that move money, and asking for them before anyone has checked the
// person is real gets the order wrong. driver_onboarding_state() keeps this
// stage locked until everything else is settled, and a database trigger
// refuses the write even if this screen were reached early -- so this form does
// not have to police the order, only fill it in.
//
// What counts as done is the checker's rule, not this screen's: account name,
// sort code and account number, all three present. Nothing here is optional,
// because a payment cannot be made on two of the three.

/** Six digits, shown the way a bank prints them. */
function formatSortCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return digits.replace(/(\d{2})(?=\d)/g, "$1-");
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
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
      {hint ? <Text className="mt-1 text-xs text-ink-subtle">{hint}</Text> : null}
    </View>
  );
}

export default function BankStep() {
  const router = useRouter();
  const { driver, reloadDriver } = useAuth();

  const [accountName, setAccountName] = useState(driver?.bank_account_name ?? "");
  const [sortCode, setSortCode] = useState(formatSortCode(driver?.bank_sort_code ?? ""));
  const [accountNumber, setAccountNumber] = useState(driver?.bank_account_number ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!driver) return;
    setError(null);

    const sortDigits = sortCode.replace(/\D/g, "");
    const accountDigits = accountNumber.replace(/\D/g, "");

    if (!accountName.trim()) {
      setError("The name on the account is needed.");
      return;
    }
    // Checked before saving rather than after a failed payment. A sort code is
    // always six digits and an account number always eight; anything else is a
    // typing mistake, and the person who finds out is otherwise payroll.
    if (sortDigits.length !== 6) {
      setError("A sort code is six digits, like 12-34-56.");
      return;
    }
    if (accountDigits.length !== 8) {
      setError("An account number is eight digits.");
      return;
    }

    setSaving(true);

    // An explicit list, never a spread of form state, for the same reason as
    // the other onboarding forms: a field added here later should not silently
    // become a field this screen writes.
    const { error: saveError } = await supabase
      .from("drivers")
      .update({
        bank_account_name: accountName.trim(),
        bank_sort_code: sortDigits,
        bank_account_number: accountDigits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await reloadDriver();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Bank details</Text>
      </View>

      {/* "padding" on both platforms. The same finding as the other onboarding
          forms: nothing resizes on this device with the keyboard up, so without
          this the last field sits behind it. */}
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
          <Text className="mb-5 text-sm text-ink-muted">
            Where your pay goes. It must be an account in your own name &mdash; payroll cannot pay a third party.
          </Text>

          {error ? (
            <View className="mb-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
              <Text className="text-sm text-bad-strong">{error}</Text>
            </View>
          ) : null}

          <Field
            label="Name on the account"
            value={accountName}
            onChangeText={setAccountName}
            placeholder="As your bank has it"
            autoCapitalize="words"
          />
          <Field
            label="Sort code"
            value={sortCode}
            onChangeText={(v) => setSortCode(formatSortCode(v))}
            placeholder="12-34-56"
            keyboardType="number-pad"
            maxLength={8}
          />
          <Field
            label="Account number"
            value={accountNumber}
            onChangeText={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 8))}
            placeholder="12345678"
            keyboardType="number-pad"
            maxLength={8}
          />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-50"
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="text-base font-semibold text-white">{saving ? "Saving..." : "Save bank details"}</Text>
          </Pressable>

          <Text className="mt-3 text-xs text-ink-subtle">
            Only the office payroll team can see these. You can change them later from your profile.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

// Requesting a reset link. Setting the new password itself does not happen
// here -- it happens on a web page (midrive-v2's /reset-password, built the
// same way account setup already is), because that is the only place that
// can catch the Supabase recovery link Apple and Google's mail scanners
// won't burn before the driver ever sees it. This screen's only job is to
// ask for the email and fire the request; see lib/supabase.ts for why this
// app never tries to catch the link itself.

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function handleSend() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setSubmitting(true);

    // Not told apart from a failure: whether this email has an account is
    // not something to reveal to whoever is standing at the login screen.
    await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: "https://midrive-v2.vercel.app/reset-password",
    });

    setSubmitting(false);
    setSent(true);
  }

  return (
    <View className="flex-1 items-center justify-center bg-slate-900 p-4">
      <View className="w-full max-w-sm">
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-amber-500">
            <Feather name="key" size={28} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">Forgot password?</Text>
          <Text className="mt-1 text-center text-sm text-slate-400">
            Enter the email on your account and we&apos;ll send you a link to reset it.
          </Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="rounded-2xl bg-white p-6 shadow-2xl">
            {sent ? (
              <View>
                <Text className="text-sm leading-5 text-slate-700">
                  If an account exists for that email, we&apos;ve sent a link to reset your password. Check your
                  inbox, open it on this phone, and follow the instructions there.
                </Text>

                <Pressable
                  onPress={() => router.replace("/login")}
                  className="mt-5 h-11 items-center justify-center rounded-lg bg-slate-900"
                >
                  <Text className="text-base font-semibold text-white">Back to sign in</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text className="mb-1 text-sm font-medium text-slate-700">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  returnKeyType="go"
                  onSubmitEditing={handleSend}
                  editable={!submitting}
                  className="mb-6 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
                />

                <Pressable
                  onPress={handleSend}
                  disabled={!canSubmit}
                  className="h-11 items-center justify-center rounded-lg bg-slate-900 disabled:opacity-50"
                >
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="text-base font-semibold text-white">Send reset link</Text>}
                </Pressable>

                <Pressable onPress={() => router.replace("/login")} hitSlop={8} className="mt-4 items-center">
                  <Text className="text-sm font-medium text-slate-500">Back to sign in</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

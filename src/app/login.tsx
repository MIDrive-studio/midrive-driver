import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
    }
    // On success, the root layout's redirect effect takes over.
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <Text className="mb-1 text-center text-3xl font-bold text-slate-900">MiDrive</Text>
        <Text className="mb-8 text-center text-slate-500">Sign in to your driver account</Text>

        {error && (
          <View className="mb-4 rounded-lg bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        <Text className="mb-1 text-sm font-medium text-slate-700">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          className="mb-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        />

        <Text className="mb-1 text-sm font-medium text-slate-700">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
          className="mb-6 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        />

        <Pressable
          onPress={handleSignIn}
          disabled={submitting}
          className="items-center rounded-lg bg-indigo-600 py-3 disabled:opacity-50"
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Sign In</Text>}
        </Pressable>

        <Text className="mt-6 text-center text-xs text-slate-400">
          New here? Use the invite link sent to your email to set your password first.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

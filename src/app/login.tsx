import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <View className="flex-1 items-center justify-center bg-slate-900 p-4">
      <View className="w-full max-w-sm">
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-amber-500">
            <Feather name="truck" size={30} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">MiDrive Driver</Text>
          <Text className="mt-1 text-sm text-slate-400">Sign in to your driver account</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="rounded-2xl bg-white p-6 shadow-2xl">
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
            <View className="mb-6 flex-row items-center rounded-lg border border-slate-300 bg-white pr-3">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="••••••••"
                className="flex-1 px-4 py-3 text-slate-900"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={submitting}
              className="h-11 items-center justify-center rounded-lg bg-slate-900 disabled:opacity-50"
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-base font-semibold text-white">Sign In</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        <Text className="mt-6 text-center text-xs text-slate-400">
          New here? Use the invite link sent to your email to set your password first.
        </Text>
      </View>
    </View>
  );
}

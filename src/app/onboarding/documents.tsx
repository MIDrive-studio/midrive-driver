import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { listDocuments, type DocumentSummary } from "@/lib/portal-api";

// The company's documents, and which of them are still owed.
//
// The list is the portal's, not this screen's: the same call the office reads,
// so a document assigned this morning appears here without the app knowing
// anything about assignments.

const STAGE: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; tint: string; ring: string; open: boolean }> = {
  not_started: { label: "To read and sign", icon: "arrow-right", tint: "#1f5089", ring: "bg-marine-100", open: true },
  reading: { label: "Started", icon: "arrow-right", tint: "#1f5089", ring: "bg-marine-100", open: true },
  answered: { label: "Started", icon: "arrow-right", tint: "#1f5089", ring: "bg-marine-100", open: true },
  declared: { label: "Started", icon: "arrow-right", tint: "#1f5089", ring: "bg-marine-100", open: true },
  signed: { label: "Signed", icon: "check", tint: "#047857", ring: "bg-ok-surface", open: false },
  submitted: { label: "Signed", icon: "check", tint: "#047857", ring: "bg-ok-surface", open: false },
  approved: { label: "Signed", icon: "check", tint: "#047857", ring: "bg-ok-surface", open: false },
  rejected: { label: "Sent back", icon: "alert-circle", tint: "#b91c1c", ring: "bg-bad-surface", open: true },
};

export default function DocumentsStep() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listDocuments();
    if (result.ok) {
      setDocuments(result.value.documents);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const outstanding = (documents ?? []).filter((d) => STAGE[d.stage]?.open).length;
  const total = documents?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Company documents</Text>
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#1f5089" />}
      >
        {loading && !documents ? (
          <ActivityIndicator size="small" color="#1f5089" className="mt-6" />
        ) : error ? (
          <View className="mt-4 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
            <Pressable onPress={load} className="mt-3">
              <Text className="text-sm font-semibold text-marine-700">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="mb-4 text-sm text-ink-muted">
              {outstanding === 0
                ? `All ${total} signed. Nothing else to do here.`
                : `${total - outstanding} of ${total} signed. Read each one to the end, then sign it.`}
            </Text>

            {(documents ?? []).map((doc) => {
              const stage = STAGE[doc.stage] ?? STAGE.not_started;
              return (
                <Pressable
                  key={doc.template_id}
                  onPress={() =>
                    router.push(`/onboarding/sign?id=${doc.template_id}` as Parameters<typeof router.push>[0])
                  }
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 active:bg-surface-sunken"
                >
                  <View className={`h-9 w-9 items-center justify-center rounded-full ${stage.ring}`}>
                    <Feather name={stage.icon} size={18} color={stage.tint} />
                  </View>

                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">{doc.title}</Text>
                    <Text className="mt-0.5 text-sm text-ink-subtle">{stage.label}</Text>
                  </View>

                  <Feather name="chevron-right" size={20} color="#94a3b8" />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

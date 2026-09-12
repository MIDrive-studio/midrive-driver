import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { listDocuments, type DocumentSummary } from "@/lib/portal-api";
import { useOutstandingDocuments } from "@/lib/outstanding-documents";

// A document became required since onboarding finished, and it stands between
// the driver and the rest of the app until it is signed.
//
// Not the onboarding checklist screen, on purpose, even though the two look
// alike -- that one shows everything a driver has ever been assigned and lets
// them work through it at their own pace over days. This shows only what is
// actually outstanding right now, because that is the whole of what a
// returning driver needs to act on: everything else, they have already done.
//
// No back button and gestureEnabled is off at the route level (see
// _layout.tsx). Leaving this screen happens by clearing what is on it, not by
// dismissing it.
//
// There is no way to skip one and come back to it later, because there is
// nothing to skip TO -- this is not a list with other places to go.

const DONE_STAGES = new Set(["submitted", "approved"]);

export default function DocumentsGate() {
  const router = useRouter();
  const outstandingDocuments = useOutstandingDocuments();

  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listDocuments();
    if (result.ok) {
      setDocuments(result.value.documents.filter((doc) => !DONE_STAGES.has(doc.stage)));
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);

    // The shared count, not just this screen's own list -- refreshed on every
    // return to this screen (including straight back from signing one) so the
    // root layout's redirect effect sees the drop immediately and moves the
    // driver on to the tabs itself the moment nothing is left. This screen
    // never navigates there directly; see outstanding-documents.tsx for why.
    outstandingDocuments.refresh();
    // outstandingDocuments.refresh is stable (useCallback with no deps in the
    // hook), so it is deliberately left out of this callback's own deps to
    // avoid re-creating `load` every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="border-b border-line px-5 py-4">
        <Text className="text-lg font-bold text-ink">Before you carry on</Text>
        <Text className="mt-1 text-sm text-ink-muted">
          {documents === null
            ? "Checking what's outstanding…"
            : documents.length === 1
              ? "There is one document to read and sign."
              : `There are ${documents?.length ?? 0} documents to read and sign.`}
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="px-5 py-5"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#1f5089" />}
      >
        {loading && !documents ? (
          <ActivityIndicator size="small" color="#1f5089" className="mt-6" />
        ) : error ? (
          <View className="rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
            <Pressable onPress={load} className="mt-3">
              <Text className="text-sm font-semibold text-marine-700">Try again</Text>
            </Pressable>
          </View>
        ) : documents && documents.length === 0 ? (
          // Reachable for a moment between signing the last one and the root
          // layout noticing the shared count has dropped to zero and moving
          // the driver on -- not a state anybody should sit in, but an empty
          // screen would be worse than saying what is actually true.
          <View className="items-center py-10">
            <ActivityIndicator size="small" color="#1f5089" />
            <Text className="mt-3 text-sm text-ink-muted">All done. Taking you through…</Text>
          </View>
        ) : (
          documents?.map((doc) => (
            <Pressable
              key={doc.template_id}
              onPress={() => router.push(`/onboarding/sign?id=${doc.template_id}` as Parameters<typeof router.push>[0])}
              className="mb-2 flex-row items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 active:bg-surface-sunken"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-marine-100">
                <Feather name="file-text" size={18} color="#1f5089" />
              </View>

              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{doc.title}</Text>
                <Text className="mt-0.5 text-sm text-ink-subtle">
                  {doc.stage === "not_started" ? "Not started" : "Continue where you left off"}
                </Text>
              </View>

              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

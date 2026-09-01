import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { pickPhoto, sendDocument, type PickedPhoto, type UploadKind } from "@/lib/document-upload";

// Sending a licence or a right to work.
//
// One screen for both, chosen by the `kind` parameter, because they are the
// same job with different words and two screens would drift apart within a
// month. The wording that differs is here; everything else is shared.
//
// What the driver sees before uploading is the last thing they sent and what
// the office made of it. That is the whole reason this screen reads
// driver_documents rather than only writing to it: a rejection the driver
// cannot see is not a rejection, and "Too blurry to read" is the difference
// between them sending a better photo and them sending the same photo again.

const COPY: Record<UploadKind, { title: string; lead: string; hint: string }> = {
  drivers_licence: {
    title: "Your driving licence",
    lead: "A photo of the front of your photocard licence.",
    hint: "Lay it flat, fill the frame, and check the number is readable before you send it.",
  },
  right_to_work: {
    title: "Your right to work",
    lead: "A photo of your passport, share code letter, or visa.",
    hint: "Make sure the whole page is in the picture and nothing is cut off at the edges.",
  },
};

type Filed = {
  id: string;
  file_path: string;
  review_status: string;
  review_note: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; tone: string; border: string; text: string }> = {
  pending: { label: "With the office", tone: "bg-warn-surface", border: "border-warn-line", text: "text-warn-strong" },
  approved: { label: "Accepted", tone: "bg-ok-surface", border: "border-ok-line", text: "text-ok-strong" },
  rejected: { label: "Sent back", tone: "bg-bad-surface", border: "border-bad-line", text: "text-bad-strong" },
};

export default function DocumentStep() {
  const router = useRouter();
  const { driver } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: UploadKind = params.kind === "right_to_work" ? "right_to_work" : "drivers_licence";
  const copy = COPY[kind];

  const [filed, setFiled] = useState<Filed | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    // The newest of this type is the one that counts, which is the same rule
    // driver_onboarding_state() applies -- so a resubmission after a rejection
    // supersedes it here for the same reason it does there.
    const { data } = await supabase
      .from("driver_documents")
      .select("id, file_path, review_status, review_note, created_at")
      .eq("driver_id", driver.id)
      .eq("doc_type", kind)
      .order("created_at", { ascending: false })
      .limit(1);
    setFiled((data?.[0] as Filed) ?? null);
    setLoading(false);
  }, [driver, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function choose(fromCamera: boolean) {
    setError(null);
    const { photo: picked, error: pickError } = await pickPhoto(fromCamera);
    if (pickError) {
      setError(pickError);
      return;
    }
    if (picked) setPhoto(picked);
  }

  async function handleSend() {
    if (!driver || !photo) return;
    setSending(true);
    setError(null);

    const { error: sendError } = await sendDocument({
      kind,
      photo,
      driverId: driver.id,
      companyId: driver.company_id,
      siteId: driver.site_id,
      userId: driver.user_id,
    });

    setSending(false);

    if (sendError) {
      setError(sendError);
      return;
    }

    setPhoto(null);
    await load();
  }

  const status = filed ? (STATUS[filed.review_status] ?? STATUS.pending) : null;
  const canSend = !filed || filed.review_status === "rejected";

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12} className="p-1">
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">{copy.title}</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10">
        <Text className="text-sm text-ink-muted">{copy.lead}</Text>

        {loading ? (
          <ActivityIndicator size="small" color="#1f5089" className="mt-6" />
        ) : (
          <>
            {filed && status ? (
              <View className={`mt-4 rounded-xl border px-4 py-3 ${status.border} ${status.tone}`}>
                <Text className={`text-sm font-semibold ${status.text}`}>{status.label}</Text>
                {filed.review_status === "rejected" ? (
                  <Text className="mt-1 text-sm text-ink-muted">
                    {filed.review_note ?? "Please send another photo."}
                  </Text>
                ) : filed.review_status === "pending" ? (
                  <Text className="mt-1 text-sm text-ink-muted">
                    Nothing more to do. The office will check it and you will see the result here.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {canSend ? (
              <>
                <View className="mt-4 rounded-xl border border-line bg-white p-4">
                  {photo ? (
                    <>
                      <Image
                        source={{ uri: photo.uri }}
                        className="mb-3 h-56 w-full rounded-lg"
                        resizeMode="contain"
                      />
                      <Pressable onPress={() => setPhoto(null)} className="mb-3 items-center py-1">
                        <Text className="text-sm font-semibold text-marine-700">Choose a different photo</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text className="mb-4 text-sm text-ink-subtle">{copy.hint}</Text>
                  )}

                  {!photo ? (
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => choose(true)}
                        className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-3.5 active:bg-marine-700"
                      >
                        <Feather name="camera" size={18} color="#ffffff" />
                        <Text className="text-sm font-semibold text-white">Take a photo</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => choose(false)}
                        className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line-strong py-3.5 active:bg-surface-sunken"
                      >
                        <Feather name="image" size={18} color="#1f5089" />
                        <Text className="text-sm font-semibold text-marine-700">Choose one</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handleSend}
                      disabled={sending}
                      className="flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-50"
                    >
                      {sending ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                      <Text className="text-base font-semibold text-white">
                        {sending ? "Submitting..." : "Submit"}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Text className="mt-3 text-xs text-ink-subtle">
                  Only your office can see this. It is stored privately and never shared with other companies.
                </Text>
              </>
            ) : null}

            {error ? (
              <View className="mt-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
                <Text className="text-sm text-bad-strong">{error}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

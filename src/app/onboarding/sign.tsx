import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { DocumentBlocks, type Block } from "@/components/document-blocks";
import { SignaturePad } from "@/components/signature-pad";
import { documentAction, readDocument, type DocumentContent } from "@/lib/portal-api";

// Reading a document and signing it.
//
// Three steps in one screen, because they are one act and splitting them would
// let somebody sign something they never opened: read to the end, answer
// anything the document asks, then declare and sign.
//
// The signing controls do not appear until the whole document has been shown --
// scrolled to the end, or short enough that there was nothing to scroll. That
// is the gate, and it is decided on the device so nothing waits on a network
// round trip to unlock a button somebody has plainly earned.
//
// The server is told separately, and told again immediately before signing,
// where it is a step that has to succeed anyway. So the record of having read
// it is still the server's, and a signature is still refused without one.

type Phase = "reading" | "signing" | "done";

/** Within this many points of the bottom counts as having reached it. */
const BOTTOM_SLACK = 48;

type Question = { id: string; prompt: string; options: string[]; required?: boolean };

export default function SignStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const templateId = params.id ?? "";

  const [doc, setDoc] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("reading");
  const [reachedEnd, setReachedEnd] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [declared, setDeclared] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recorded once. The scroll handler fires constantly and this is a write.
  const readSent = useRef(false);
  const viewportHeight = useRef(0);

  const load = useCallback(async () => {
    if (!templateId) return;

    const opened = await documentAction(templateId, "start");
    if (!opened.ok) {
      setError(opened.error);
      setLoading(false);
      return;
    }

    const result = await readDocument(templateId);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setDoc(result.value.document);
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    load();
  }, [load]);

  const questions: Question[] = (doc?.blocks ?? [])
    .filter((b) => b.type === "question")
    .map((b) => ({
      id: String(b.id ?? ""),
      prompt: String(b.prompt ?? ""),
      options: Array.isArray(b.options) ? (b.options as string[]) : ["Yes", "No"],
      required: b.required === true,
    }))
    .filter((q) => q.id);

  /**
   * Reaching the end enables the button. Nothing waits on the network.
   *
   * This used to enable only once the server had acknowledged the read, and
   * put the button back to grey if that call failed -- so a driver who had
   * plainly read the document watched the button light up and go out again,
   * with no way to tell whether they had done something wrong.
   *
   * Scrolling to the end is the reading. The server is told in the background,
   * and told again just before signing, where it is a step that has to succeed
   * anyway. recordRead is idempotent, so saying it twice costs nothing.
   */
  function markRead() {
    if (readSent.current) return;
    readSent.current = true;
    setReachedEnd(true);
    documentAction(templateId, "read").catch(() => {});
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - BOTTOM_SLACK) markRead();
  }

  /**
   * A document shorter than the screen has no bottom to scroll to.
   *
   * onScroll never fires, so the button stayed grey for ever and the shortest
   * documents were the ones that could not be signed at all. If it all fits,
   * it has all been shown.
   */
  function handleContentSize(_width: number, height: number) {
    if (viewportHeight.current > 0 && height <= viewportHeight.current + BOTTOM_SLACK) markRead();
  }

  async function handleSign() {
    if (!doc) return;

    const unanswered = questions.filter((q) => q.required !== false && !answers[q.id]);
    if (unanswered.length > 0) {
      setError("Please answer the question in the document before signing.");
      return;
    }

    if (!declared) {
      setError("Please confirm the declaration.");
      return;
    }

    if (!signature) {
      setError("Please sign in the box.");
      return;
    }

    setBusy(true);
    setError(null);

    // Said again here because this is where it has to be true. The background
    // call may have been made on a dead connection, and the portal refuses a
    // signature on a document it has no read event for -- which would surface
    // as a failure at the last step rather than the first.
    const read = await documentAction(templateId, "read");
    if (!read.ok) {
      setBusy(false);
      setError(read.error);
      return;
    }

    if (questions.length > 0) {
      const answered = await documentAction(templateId, "answer", { answers });
      if (!answered.ok) {
        setBusy(false);
        setError(answered.error);
        return;
      }
    }

    const declaredResult = await documentAction(templateId, "declare");
    if (!declaredResult.ok) {
      setBusy(false);
      setError(declaredResult.error);
      return;
    }

    const signedResult = await documentAction(templateId, "sign", { signature });
    setBusy(false);

    if (!signedResult.ok) {
      setError(signedResult.error);
      return;
    }

    setPhase("done");
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#1f5089" />
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-8">
        <Text className="mb-2 text-center text-base font-semibold text-ink">Couldn&apos;t open this document</Text>
        <Text className="mb-6 text-center text-sm text-ink-muted">{error ?? "Please try again in a moment."}</Text>
        <Pressable onPress={() => router.back()} className="rounded-xl bg-marine-600 px-6 py-3">
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === "done") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-8">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-ok-surface">
          <Feather name="check" size={32} color="#047857" />
        </View>
        <Text className="mt-4 text-center text-lg font-bold text-ink">Signed</Text>
        <Text className="mt-1 text-center text-sm text-ink-muted">
          {doc.title} is signed and filed. A copy is kept with your records.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-xl bg-marine-600 px-6 py-3.5 active:bg-marine-700"
        >
          <Text className="text-base font-semibold text-white">Next document</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 border-b border-line px-4 py-3">
        <Pressable
          onPress={() => (phase === "signing" ? setPhase("reading") : router.back())}
          hitSlop={12}
          className="p-1"
        >
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
          {doc.title}
        </Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          contentContainerClassName="px-5 pb-8 pt-4"
          onScroll={handleScroll}
          onContentSizeChange={handleContentSize}
          onLayout={(event) => {
            viewportHeight.current = event.nativeEvent.layout.height;
          }}
          scrollEventThrottle={200}
          keyboardShouldPersistTaps="handled"
        >
          {phase === "reading" ? (
            <>
              <DocumentBlocks blocks={doc.blocks as Block[]} />

              <View className="mt-6 rounded-xl border border-line bg-white px-4 py-4">
                <Text className="text-sm text-ink-muted">
                  {reachedEnd
                    ? "That is the end of the document."
                    : "Scroll to the end of the document to continue."}
                </Text>
                <Pressable
                  onPress={() => setPhase("signing")}
                  disabled={!reachedEnd}
                  className="mt-3 items-center rounded-xl bg-marine-600 py-3.5 active:bg-marine-700 disabled:opacity-40"
                >
                  <Text className="text-base font-semibold text-white">Continue</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {questions.map((q) => (
                <View key={q.id} className="mb-5">
                  <Text className="mb-2 text-[15px] font-semibold leading-6 text-ink">{q.prompt}</Text>
                  <View className="flex-row gap-2">
                    {q.options.map((option) => {
                      const chosen = answers[q.id] === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                          className={`flex-1 items-center rounded-xl border py-3 ${
                            chosen ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
                          }`}
                        >
                          <Text className={`text-sm font-semibold ${chosen ? "text-marine-700" : "text-ink-muted"}`}>
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {doc.declaration ? (
                <Pressable
                  onPress={() => setDeclared((d) => !d)}
                  className="mb-5 flex-row gap-3 rounded-xl border border-line bg-white px-4 py-4"
                >
                  <View
                    className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
                      declared ? "border-marine-600 bg-marine-600" : "border-line-strong bg-white"
                    }`}
                  >
                    {declared ? <Feather name="check" size={14} color="#ffffff" /> : null}
                  </View>
                  <Text className="flex-1 text-[15px] leading-6 text-ink-muted">{doc.declaration}</Text>
                </Pressable>
              ) : null}

              <Text className="mb-2 text-sm font-medium text-ink-muted">Your signature</Text>
              <SignaturePad onChange={setSignature} disabled={busy} />

              <Pressable
                onPress={handleSign}
                disabled={busy}
                className="mt-5 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-50"
              >
                {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text className="text-base font-semibold text-white">{busy ? "Signing..." : "Sign and submit"}</Text>
              </Pressable>

              <Text className="mt-3 text-xs text-ink-subtle">
                Signing records the date and time on MiDrive&apos;s server, not your phone, and keeps a copy of exactly
                the text you have just read.
              </Text>
            </>
          )}

          {error ? (
            <View className="mt-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
              <Text className="text-sm text-bad-strong">{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

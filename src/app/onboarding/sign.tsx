import { useCallback, useEffect, useRef, useState } from "react";
import { leaveStep } from "@/lib/go-back";
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
import { FollowUpForm, isShown, type FollowUp } from "@/components/follow-up-form";
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

// Reading and signing used to be two screens with a Continue button between
// them. That put a question to the driver twice -- once as a preview they
// could not answer, then again on the far side of the button -- and made them
// press Continue to reach a signature they had already earned by reading. One
// screen now: read it, answer what it asks, sign. The gate is unchanged.
type Phase = "reading" | "done";

/** Within this many points of the bottom counts as having reached it. */
const BOTTOM_SLACK = 48;

type Question = {
  id: string;
  prompt: string;
  options: string[];
  required?: boolean;
  followUp?: FollowUp;
};

export default function SignStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const templateId = params.id ?? "";

  const [doc, setDoc] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("reading");
  const [reachedEnd, setReachedEnd] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // One group is showing as soon as the answer opens the follow-up; more are
  // added by the driver saying there was another.
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
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
      followUp: (b.followUp as FollowUp | undefined) ?? undefined,
    }))
    .filter((q) => q.id);

  /**
   * Questions this document insists on before it will take a signature.
   *
   * The same test the submit path uses, written once. A screen that offers a
   * signature the submit path then refuses is worse than either rule alone,
   * and that is what two copies of this eventually become.
   */
  const unansweredRequired = questions.filter((q) => q.required !== false && !answers[q.id]);
  const readyToSign = unansweredRequired.length === 0;

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

  function setAnswer(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function removeGroup(questionId: string, index: number) {
    setAnswers((a) => {
      const next: Record<string, string> = {};
      // Renumbered as they are copied, so the groups stay 1..n with no hole
      // where the removed one was -- a gap would print as a missing conviction.
      const prefix = `${questionId}.`;
      let seen = 0;
      const count = groupCounts[questionId] ?? 1;
      for (let n = 1; n <= count; n++) {
        if (n === index) continue;
        seen += 1;
        for (const [key, value] of Object.entries(a)) {
          if (!key.startsWith(`${prefix}${n}.`)) continue;
          next[`${prefix}${seen}.${key.split(".")[2]}`] = value;
        }
      }
      for (const [key, value] of Object.entries(a)) if (!key.startsWith(prefix)) next[key] = value;
      return next;
    });
    setGroupCounts((c) => ({ ...c, [questionId]: Math.max(1, (c[questionId] ?? 1) - 1) }));
  }

  async function handleSign() {
    if (!doc) return;

    if (unansweredRequired.length > 0) {
      setError("Please answer the question in the document before signing.");
      return;
    }

    // An opened follow-up that is left blank is the thing this whole feature
    // exists to prevent: a Yes with nothing behind it. Only fields actually on
    // screen are required -- one hidden behind an answer that was never given
    // is not a question the driver dodged.
    for (const q of questions) {
      if (!q.followUp || answers[q.id] !== q.followUp.when) continue;

      for (let n = 1; n <= (groupCounts[q.id] ?? 1); n++) {
        const group: Record<string, string> = {};
        for (const f of q.followUp.fields) group[f.id] = answers[`${q.id}.${n}.${f.id}`] ?? "";

        const missing = q.followUp.fields.filter((f) => isShown(f, group) && !group[f.id].trim());
        if (missing.length > 0) {
          setError(`Please finish ${q.followUp.groupNoun.toLowerCase()} ${n}: ${missing[0].label}`);
          return;
        }
      }
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
        <Pressable onPress={() => leaveStep(router)} className="rounded-xl bg-marine-600 px-6 py-3">
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
          onPress={() => leaveStep(router)}
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
          onPress={() => leaveStep(router)}
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
          // Also on the way out of a scroll, not only during one.
          //
          // Throttled onScroll can miss the resting position entirely: a flick
          // that comes to rest between two windows reports nothing further, and
          // the driver sits at the bottom of the document watching a grey
          // button. These two always fire once the movement is over, so the
          // final position is tested whatever the throttle did.
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
          onContentSizeChange={handleContentSize}
          onLayout={(event) => {
            viewportHeight.current = event.nativeEvent.layout.height;
          }}
          // One event per frame rather than one per fifth of a second. The
          // handler compares four numbers and sets a boolean, and markRead is
          // guarded by a ref so the write happens once however often this runs.
          // At 200ms the button could lag a fifth of a second behind the finger,
          // which is exactly long enough to read as broken.
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          <DocumentBlocks
            blocks={doc.blocks as Block[]}
            // The question is answered where the document asks it. Everything
            // needed to answer is already in scope here, so the document keeps
            // its own order and the driver is asked once.
            renderQuestion={(block) => {
              const question = questions.find((q) => q.id === block.id);
              if (!question) return null;
              return (
                <View className="mb-5 rounded-xl border border-line bg-white px-4 py-4">
                  <Text className="mb-3 text-[15px] font-semibold leading-6 text-ink">{question.prompt}</Text>
                  <View className="flex-row gap-2">
                    {question.options.map((option) => {
                      const picked = answers[question.id] === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => {
                            setAnswer(question.id, option);
                            // Opening the follow-up shows one group straight
                            // away. Answering the other way leaves whatever was
                            // typed alone rather than throwing it away -- a
                            // mis-tap should not cost somebody four answers.
                            if (question.followUp && option === question.followUp.when && !groupCounts[question.id]) {
                              setGroupCounts((c) => ({ ...c, [question.id]: 1 }));
                            }
                          }}
                          className={`flex-1 items-center rounded-xl border py-3 ${
                            picked ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
                          }`}
                        >
                          <Text className={`text-sm font-semibold ${picked ? "text-marine-700" : "text-ink-muted"}`}>
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {question.followUp && answers[question.id] === question.followUp.when ? (
                    <View className="mt-4">
                      <FollowUpForm
                        questionId={question.id}
                        followUp={question.followUp}
                        answers={answers}
                        onChange={setAnswer}
                        groupCount={groupCounts[question.id] ?? 1}
                        onAddGroup={() => setGroupCounts((c) => ({ ...c, [question.id]: (c[question.id] ?? 1) + 1 }))}
                        onRemoveGroup={(index) => removeGroup(question.id, index)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            }}
          />

          {/* The gate. Unchanged in what it demands -- the whole document has
              to have been shown -- only in what it looks like: there is no
              button to press once it opens, because pressing Continue to reach
              a signature you have already earned is a step that does nothing. */}
          {!reachedEnd ? (
            <View className="mt-6 rounded-xl border border-line bg-white px-4 py-4">
              <Text className="text-sm text-ink-muted">Scroll to the end of the document to continue.</Text>
            </View>
          ) : !readyToSign ? (
            <View className="mt-6 rounded-xl border border-line bg-white px-4 py-4">
              <Text className="text-sm text-ink-muted">
                Answer the question above, and you can sign.
              </Text>
            </View>
          ) : (
            <>
              {doc.declaration ? (
                <Pressable
                  onPress={() => setDeclared((d) => !d)}
                  className="mb-5 mt-6 flex-row gap-3 rounded-xl border border-line bg-white px-4 py-4"
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

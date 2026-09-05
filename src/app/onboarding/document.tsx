import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { formatDateAsTyped, isoToTypedDate, typedDateToISO } from "@/lib/dates";
import { takeCapturedDocument } from "@/lib/captured-document";
import { BASES, documentsFor, labelFor, shareCodeRequired, usesNationalInsurance, type Basis } from "@/lib/right-to-work";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { readDocumentPhoto, type Reading } from "@/lib/portal-api";
import { nextStep } from "@/lib/next-step";
import { pickPhoto, prepareForReading, sendDocument, type PickedPhoto, type UploadKind } from "@/lib/document-upload";
import type { OnboardingState } from "@/types/onboarding";

// Sending a licence or a right to work.
//
// One screen for both, chosen by the `kind` parameter, because they are the
// same job with different words and two screens would drift apart in a month.
//
// It runs as a short sequence rather than a form: photograph it, have it read,
// correct what was read, submit. The reading is a typing aid and never more
// than that -- the number stored is the one the driver confirmed, and if the
// portal cannot be reached the step still works with an empty box and a
// keyboard.

// "basis" is only ever reached for a right to work. A licence is a licence,
// and asking a driver which kind of licence they are sending would be a
// question with one answer.
type Step = "basis" | "capture" | "confirm" | "filed";

const COPY: Record<
  UploadKind,
  { title: string; frontLabel: string; frontHint: string; backLabel?: string; backHint?: string; numberLabel: string }
> = {
  drivers_licence: {
    title: "Your driving licence",
    frontLabel: "Front of your licence",
    frontHint: "The side with your photo. Lay it flat and fill the frame.",
    backLabel: "Back of your licence",
    backHint: "The side with the table of categories.",
    numberLabel: "Licence number",
  },
  right_to_work: {
    title: "Your right to work",
    frontLabel: "Your document",
    frontHint: "A passport photo page, share code letter, or visa. Keep the whole page in shot.",
    numberLabel: "Document number",
  },
};

type Filed = {
  id: string;
  review_status: string;
  review_note: string | null;
};

const STATUS: Record<string, { label: string; tone: string; border: string; text: string }> = {
  pending: { label: "Submitted", tone: "bg-warn-surface", border: "border-warn-line", text: "text-warn-strong" },
  approved: { label: "Accepted", tone: "bg-ok-surface", border: "border-ok-line", text: "text-ok-strong" },
  rejected: { label: "Sent back", tone: "bg-bad-surface", border: "border-bad-line", text: "text-bad-strong" },
};

function Shot({
  label,
  hint,
  photo,
  onPick,
  disabled,
}: {
  label: string;
  hint: string;
  photo: PickedPhoto | null;
  onPick: (fromCamera: boolean) => void;
  disabled: boolean;
}) {
  return (
    <View className="mb-3 rounded-xl border border-line bg-white p-4">
      <Text className="text-sm font-semibold text-ink">{label}</Text>

      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} className="mt-3 h-44 w-full rounded-lg" resizeMode="contain" />
          <Pressable onPress={() => onPick(true)} disabled={disabled} className="mt-2 items-center py-1">
            <Text className="text-sm font-semibold text-marine-700">Retake</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mb-3 mt-1 text-sm text-ink-subtle">{hint}</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onPick(true)}
              disabled={disabled}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-3.5 active:bg-marine-700 disabled:opacity-50"
            >
              <Feather name="camera" size={18} color="#ffffff" />
              <Text className="text-sm font-semibold text-white">Take a photo</Text>
            </Pressable>
            <Pressable
              onPress={() => onPick(false)}
              disabled={disabled}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line-strong py-3.5 active:bg-surface-sunken disabled:opacity-50"
            >
              <Feather name="image" size={18} color="#1f5089" />
              <Text className="text-sm font-semibold text-marine-700">Choose one</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "characters" | "words";
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
      />
    </View>
  );
}


export default function DocumentStep() {
  const router = useRouter();
  const { driver } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: UploadKind = params.kind === "right_to_work" ? "right_to_work" : "drivers_licence";
  const copy = COPY[kind];
  const needsBack = kind === "drivers_licence";

  const [step, setStep] = useState<Step>(kind === "right_to_work" ? "basis" : "capture");
  const [basis, setBasis] = useState<Basis | null>(null);
  const [documentKind, setDocumentKind] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState("");
  const [filed, setFiled] = useState<Filed | null>(null);
  const [loading, setLoading] = useState(true);

  const [front, setFront] = useState<PickedPhoto | null>(null);
  const [back, setBack] = useState<PickedPhoto | null>(null);

  const [reading, setReading] = useState<Reading | null>(null);
  const [readingNote, setReadingNote] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [checkCode, setCheckCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    // The newest of this type is the one that counts, which is the rule
    // driver_onboarding_state() applies -- so a resubmission after a rejection
    // supersedes it here for the same reason it does there.
    const { data } = await supabase
      .from("driver_documents")
      .select("id, review_status, review_note")
      .eq("driver_id", driver.id)
      .eq("doc_type", kind)
      .order("created_at", { ascending: false })
      .limit(1);

    const newest = (data?.[0] as Filed) ?? null;
    setFiled(newest);
    // A rejected document is not a finished step: it reopens at the camera.
    const restart = kind === "right_to_work" ? "basis" : "capture";
    setStep(newest && newest.review_status !== "rejected" ? "filed" : restart);
    setLoading(false);
  }, [driver, kind]);

  useEffect(() => {
    load();
  }, [load]);

  // The camera leaves its photograph behind and navigates back; this collects
  // it. Taken rather than read, so returning to this screen for any other
  // reason cannot re-apply a photograph that has already been used.
  useFocusEffect(
    useCallback(() => {
      const captured = takeCapturedDocument();
      if (!captured) return;
      if (captured.side === "front") setFront(captured.photo);
      else setBack(captured.photo);
    }, [])
  );

  async function choose(which: "front" | "back", fromCamera: boolean) {
    setError(null);

    // Our own camera, because the phone's cannot be given a guide box and a
    // licence photographed from across the desk is the main reason the reader
    // fails. Choosing from the library still uses the picker: there is nothing
    // to guide once the photograph has been taken.
    if (fromCamera) {
      router.push(`/onboarding/capture-document?kind=${kind}&side=${which}` as never);
      return;
    }

    const { photo, error: pickError } = await pickPhoto(fromCamera);
    if (pickError) {
      setError(pickError);
      return;
    }
    if (!photo) return;
    if (which === "front") setFront(photo);
    else setBack(photo);
  }

  /** Read the front, then show what it said for the driver to correct. */
  async function handleRead() {
    if (!front) return;
    setBusy(true);
    setError(null);
    setReadingNote(null);

    const base64 = await prepareForReading(front);
    const result = base64
      ? await readDocumentPhoto(kind === "drivers_licence" ? "drivers_licence" : "passport", {
          mediaType: "image/jpeg",
          data: base64,
        })
      : null;

    if (result?.ok) {
      const read = result.value.reading;
      setReading(read);
      setNumber(read.document_number ?? "");
      setExpiry(isoToTypedDate(read.expires_on));
      setReadingNote(
        read.legible && read.document_number
          ? "We read this from your photo. Check it against the document and correct anything wrong."
          : (read.note ?? "We could not read it clearly. Please type the details in.")
      );
    } else {
      // The portal being unreachable is not a bad photograph, and the driver
      // must not be told to retake one that was always fine.
      setReadingNote("Please type the details in from the document.");
    }

    setBusy(false);
    setStep("confirm");
  }

  async function handleSubmit() {
    if (!driver || !front) return;

    if (!number.trim()) {
      setError(`${copy.numberLabel} is needed.`);
      return;
    }

    const iso = expiry.trim() ? typedDateToISO(expiry) : null;
    if (expiry.trim() && !iso) {
      setError("The expiry date should be written as DD/MM/YYYY.");
      return;
    }

    // Refused here rather than by the office three days later. Without a share
    // code the office cannot complete the check at all, so a submission
    // missing one is a wasted round trip for everybody.
    if (basis && shareCodeRequired(basis) && !shareCode.trim()) {
      setError("Your share code is needed. Get one from gov.uk -- \"Prove your right to work to an employer\".");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: sendError } = await sendDocument({
      kind,
      front,
      back: needsBack ? back : null,
      driverId: driver.id,
      companyId: driver.company_id,
      siteId: driver.site_id,
      userId: driver.user_id,
      confirmed: {
        documentNumber: number.trim().toUpperCase(),
        expiresOn: iso,
        checkCode: kind === "drivers_licence" ? checkCode.trim().toUpperCase() || null : null,
        nationalityBasis: basis,
        documentKind: documentKind,
        shareCode: shareCode.trim().toUpperCase() || null,
        extracted: reading ?? null,
      },
    });

    if (sendError) {
      setBusy(false);
      setError(sendError);
      return;
    }

    // Straight on to whatever needs them next, rather than back to a list they
    // would have to read to work that out. `replace` rather than `push`: the
    // step just finished is not somewhere to go back to.
    const { data } = await supabase.rpc("driver_onboarding_state", { p_driver_id: driver.id });
    const where = nextStep(data as OnboardingState | null, kind === "drivers_licence" ? "licence" : "right_to_work");

    setBusy(false);
    router.replace((where ?? "/onboarding") as Parameters<typeof router.replace>[0]);
  }

  const status = filed ? (STATUS[filed.review_status] ?? STATUS.pending) : null;
  const readyToRead = Boolean(front) && (!needsBack || Boolean(back));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable
          onPress={() => {
            if (step === "confirm") return setStep("capture");
            if (step === "capture" && kind === "right_to_work") return setStep("basis");
            return router.back();
          }}
          hitSlop={12}
          className="p-1"
        >
          <Feather name="chevron-left" size={24} color="#1f5089" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">{copy.title}</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pb-24" keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator size="small" color="#1f5089" className="mt-6" />
          ) : (
            <>
              {step === "filed" && filed && status ? (
                <View className={`mb-4 rounded-xl border px-4 py-3 ${status.border} ${status.tone}`}>
                  <Text className={`text-sm font-semibold ${status.text}`}>{status.label}</Text>
                  <Text className="mt-1 text-sm text-ink-muted">
                    Nothing more to do. The office will check it and you will see the result here.
                  </Text>
                </View>
              ) : null}

              {filed?.review_status === "rejected" ? (
                <View className="mb-4 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
                  <Text className="text-sm font-semibold text-bad-strong">Sent back</Text>
                  <Text className="mt-1 text-sm text-ink-muted">
                    {filed.review_note ?? "Please send another photo."}
                  </Text>
                </View>
              ) : null}

              {step === "basis" ? (
                <>
                  <Text className="mb-1 text-base font-semibold text-ink">What is your right to work based on?</Text>
                  <Text className="mb-4 text-sm text-ink-muted">
                    This decides which documents we can accept, so it is asked first.
                  </Text>

                  {BASES.map((option) => {
                    const picked = basis === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          setBasis(option.value);
                          // The kinds differ per route, so a kind chosen under
                          // the old answer is not a kind under the new one.
                          setDocumentKind(null);
                          setError(null);
                        }}
                        className={`mb-2 rounded-xl border px-4 py-3.5 ${
                          picked ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
                        }`}
                      >
                        <Text className={`text-[15px] font-semibold ${picked ? "text-marine-700" : "text-ink"}`}>
                          {option.label}
                        </Text>
                        <Text className="mt-0.5 text-sm text-ink-subtle">{option.hint}</Text>
                      </Pressable>
                    );
                  })}

                  {basis ? (
                    <>
                      <Text className="mb-1 mt-5 text-base font-semibold text-ink">What are you sending us?</Text>
                      <Text className="mb-4 text-sm text-ink-muted">Pick the document you have to hand.</Text>

                      {documentsFor(basis).map((option) => {
                        const picked = documentKind === option.kind;
                        return (
                          <Pressable
                            key={option.kind}
                            onPress={() => {
                              setDocumentKind(option.kind);
                              setError(null);
                            }}
                            className={`mb-2 rounded-xl border px-4 py-3.5 ${
                              picked ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
                            }`}
                          >
                            <Text className={`text-[15px] font-semibold ${picked ? "text-marine-700" : "text-ink"}`}>
                              {option.label}
                            </Text>
                            <Text className="mt-0.5 text-sm text-ink-subtle">{option.hint}</Text>
                          </Pressable>
                        );
                      })}

                      {/* Already given on the personal details step, so it is
                          pointed at rather than asked for again. */}
                      {documentKind && usesNationalInsurance(basis, documentKind) ? (
                        <View className="mb-2 mt-1 rounded-xl border border-marine-200 bg-marine-50 px-4 py-3">
                          <Text className="text-sm text-marine-800">
                            We will use the National Insurance number you already gave us alongside this.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <Pressable
                    onPress={() => setStep("capture")}
                    disabled={!basis || !documentKind}
                    className="mt-3 items-center rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-40"
                  >
                    <Text className="text-base font-semibold text-white">Next</Text>
                  </Pressable>
                </>
              ) : null}

              {step === "capture" ? (
                <>
                  <Shot
                    label={basis && documentKind ? labelFor(basis, documentKind) : copy.frontLabel}
                    hint={
                      basis && documentKind
                        ? (documentsFor(basis).find((d) => d.kind === documentKind)?.hint ?? copy.frontHint)
                        : copy.frontHint
                    }
                    photo={front}
                    onPick={(fromCamera) => choose("front", fromCamera)}
                    disabled={busy}
                  />

                  {needsBack && copy.backLabel && copy.backHint ? (
                    <Shot
                      label={copy.backLabel}
                      hint={copy.backHint}
                      photo={back}
                      onPick={(fromCamera) => choose("back", fromCamera)}
                      disabled={busy}
                    />
                  ) : null}

                  <Pressable
                    onPress={handleRead}
                    disabled={busy || !readyToRead}
                    className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-40"
                  >
                    {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                    <Text className="text-base font-semibold text-white">{busy ? "Reading..." : "Next"}</Text>
                  </Pressable>

                  {!readyToRead ? (
                    <Text className="mt-2 text-center text-xs text-ink-subtle">
                      {needsBack ? "Both sides are needed." : "A photo is needed."}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {step === "confirm" ? (
                <>
                  {readingNote ? (
                    <View className="mb-4 rounded-xl border border-marine-200 bg-marine-50 px-4 py-3">
                      <Text className="text-sm text-marine-800">{readingNote}</Text>
                    </View>
                  ) : null}

                  <Field
                    label={copy.numberLabel}
                    value={number}
                    onChangeText={setNumber}
                    autoCapitalize="characters"
                    placeholder="As printed on the document"
                  />

                  <Field
                    label="Expiry date"
                    value={expiry}
                    onChangeText={(v) => setExpiry(formatDateAsTyped(v))}
                    placeholder="DD/MM/YYYY"
                    keyboardType="number-pad"
                  />

                  {kind === "drivers_licence" ? (
                    <>
                      <Field
                        label="DVLA check code"
                        value={checkCode}
                        onChangeText={setCheckCode}
                        autoCapitalize="characters"
                        placeholder="Ab12 Cd34 Ef"
                      />
                      <Text className="-mt-2 mb-4 text-xs text-ink-subtle">
                        Get this from gov.uk &mdash; &ldquo;View or share your driving licence information&rdquo;. It
                        lets the office check your licence with the DVLA without you sending anything else.
                      </Text>
                    </>
                  ) : null}

                  {/* Every route but the British one. A British or Irish
                      passport proves an unlimited right to work by itself;
                      the online check exists for status held digitally. */}
                  {basis && shareCodeRequired(basis) ? (
                    <>
                      <Field
                        label="Home Office share code"
                        value={shareCode}
                        onChangeText={setShareCode}
                        autoCapitalize="characters"
                        placeholder="W12 3AB 456"
                      />
                      <Text className="-mt-2 mb-4 text-xs text-ink-subtle">
                        Get this from gov.uk &mdash; &ldquo;Prove your right to work to an employer&rdquo;. It lets the
                        office confirm your status with the Home Office. Codes expire after 90 days, so send it soon
                        after you generate it.
                      </Text>
                    </>
                  ) : null}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={busy}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-marine-600 py-4 active:bg-marine-700 disabled:opacity-50"
                  >
                    {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                    <Text className="text-base font-semibold text-white">{busy ? "Submitting..." : "Submit"}</Text>
                  </Pressable>
                </>
              ) : null}

              {error ? (
                <View className="mt-4 rounded-lg border border-bad-line bg-bad-surface px-4 py-3">
                  <Text className="text-sm text-bad-strong">{error}</Text>
                </View>
              ) : null}

              {step !== "filed" ? (
                <Text className="mt-3 text-xs text-ink-subtle">
                  Only your office can see this. It is stored privately and never shared with other companies.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useRef, useState } from "react";
import { leaveStep } from "@/lib/go-back";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { useFramingGuidance } from "@/lib/framing-guidance";
import { leaveCapturedDocument } from "@/lib/captured-document";
import type { PickedPhoto } from "@/lib/document-upload";
import { SHAPE_RATIO, type DocumentShape } from "@/lib/right-to-work";

// Photographing a document, with somewhere to put it.
//
// The phone's own camera app was doing this, and it cannot be given an overlay.
// So a driver was told "take a photo of your licence" and left to guess how
// close, how square, and how much of the desk to include. What came back was
// often a licence occupying a quarter of the frame at an angle, which is the
// main reason the reader fails to read one.
//
// A box on the screen fixes that without asking the driver to understand
// anything: fill the box. It is cut to the real shape of whatever they said
// they were sending -- a bank card, an open passport, or an A4 certificate --
// so a document that fills it is square on and close enough to read.
//
// The shape matters more than it looks. A card-shaped box round a birth
// certificate tells the driver to do the wrong thing and they will do it: the
// box is the instruction, not the caption under it.
//
// Built on the same pieces as the vehicle walk-around camera, which has done
// this for van photographs since before this existed: a live CameraView, an
// outline over it, and the accelerometer telling the driver to hold the phone
// flat. Nothing new was needed.

// What the driver is being asked to line up, in words, per shape. The box
// itself is the instruction; this is the sentence under it.
const GUIDANCE: Record<DocumentShape, string> = {
  card: "Lay the card flat and fill the box. Keep all four corners inside it.",
  passport: "Open the passport at the photo page, lay it flat, and fill the box.",
  document: "Lay the certificate flat and fill the box. Keep all four corners inside it.",
};

const SHAPE_NAME: Record<DocumentShape, string> = {
  card: "card",
  passport: "passport",
  document: "certificate",
};

const TITLES: Record<string, string> = {
  drivers_licence: "Driving licence",
  right_to_work: "Right to work document",
};

export default function CaptureDocumentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; side?: string; shape?: string }>();
  // The box is cut to what the driver is actually holding. A card-shaped box
  // round an A4 certificate tells them to do the wrong thing, and they will
  // do it -- the box is the instruction, not the caption.
  const shape: DocumentShape =
    params.shape === "passport" || params.shape === "document" ? params.shape : "card";
  const side: "front" | "back" = params.side === "back" ? "back" : "front";
  const title = TITLES[params.kind ?? ""] ?? "Document";

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [pending, setPending] = useState<PickedPhoto | null>(null);

  // The same tilt hint the van camera uses. A licence photographed at an angle
  // is the single most common reason the reader cannot read one, and holding
  // the phone flat is the one thing a phone can actually check for itself.
  const guidance = useFramingGuidance(pending === null && permission?.granted === true);

  async function take() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    const shot = await cameraRef.current.takePictureAsync({ quality: 0.9 });

    setCapturing(false);
    if (!shot?.uri) return;

    // Shown before it is accepted. A blurred or glared photograph is obvious to
    // a person and invisible to the phone, and retaking it here costs one tap
    // against a rejected document and a day of waiting.
    setPending({ uri: shot.uri, width: shot.width, height: shot.height });
  }

  function keep() {
    if (!pending) return;
    leaveCapturedDocument(side, pending);
    leaveStep(router);
  }

  // --- Permission -----------------------------------------------------------

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#ffffff" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black px-8">
        <Feather name="camera-off" size={32} color="#ffffff" />
        <Text className="mt-4 text-center text-base font-semibold text-white">Camera permission needed</Text>
        <Text className="mb-6 mt-1 text-center text-sm text-white/70">
          MiDrive needs the camera to photograph your {title.toLowerCase()}.
        </Text>
        <Pressable onPress={requestPermission} className="rounded-xl bg-white px-6 py-3">
          <Text className="text-sm font-semibold text-slate-900">Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => leaveStep(router)} className="mt-3 px-6 py-3">
          <Text className="text-sm font-semibold text-white/70">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // --- Checking the photograph ---------------------------------------------

  if (pending) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 items-center justify-center px-4">
          <Image source={{ uri: pending.uri }} className="h-full w-full" resizeMode="contain" />
        </View>
        <View className="px-5 pb-6">
          <Text className="mb-3 text-center text-sm text-white/80">
            Can you read every word on it? If not, take it again.
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setPending(null)}
              className="flex-1 items-center rounded-xl border border-white/40 py-3.5"
            >
              <Text className="text-base font-semibold text-white">Retake</Text>
            </Pressable>
            <Pressable onPress={keep} className="flex-1 items-center rounded-xl bg-white py-3.5">
              <Text className="text-base font-semibold text-slate-900">Use this photo</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- The camera -----------------------------------------------------------

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Over the preview. pointerEvents per layer, so the box never swallows a
          tap meant for the shutter. */}
      <SafeAreaView className="absolute inset-0" pointerEvents="box-none">
        <View className="flex-row items-start justify-between px-4 pt-2" pointerEvents="box-none">
          <View className="rounded-xl bg-black/55 px-3 py-2">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-marine-200">{title}</Text>
            <Text className="text-xl font-bold text-white">{side === "front" ? "Front" : "Back"}</Text>
          </View>

          <Pressable
            onPress={() => leaveStep(router)}
            accessibilityRole="button"
            accessibilityLabel="Close the camera"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/55"
          >
            <Feather name="x" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {/* The box. This is the whole feature: move the phone until the card
            fills it. Cut to the real proportions of the card, so filling it
            means square on and close enough to read. */}
        <View className="flex-1 items-center justify-center px-5" pointerEvents="none">
          <View
            style={{ aspectRatio: SHAPE_RATIO[shape] }}
            className={`rounded-2xl border-2 ${shape === "document" ? "h-full" : "w-full"} ${
              guidance.ok ? "border-white" : "border-white/45"
            }`}
          >
            {/* Corner marks, so the shape still reads against a busy desk where
                a thin rectangle disappears into whatever is behind it. */}
            <View className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-white" />
            <View className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-white" />
            <View className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-white" />
            <View className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-white" />
          </View>
        </View>

        <View className="px-4 pb-4" pointerEvents="box-none">
          <View className="items-center">
            <View
              className={`flex-row items-center gap-2 rounded-full px-3.5 py-2 ${
                guidance.ok ? "bg-black/55" : "bg-warn-strong/90"
              }`}
            >
              <Feather
                name={guidance.ok ? "check-circle" : "smartphone"}
                size={14}
                color={guidance.ok ? "#a7f3d0" : "#ffffff"}
              />
              <Text className="text-sm font-semibold text-white">
                {guidance.ok ? `Fill the box with the ${SHAPE_NAME[shape]}` : guidance.message}
              </Text>
            </View>

            <Text className="mt-2 px-6 text-center text-xs leading-5 text-white/85">
              {GUIDANCE[shape]} Avoid glare on the photo.
            </Text>
          </View>

          <View className="mt-4 items-center">
            <Pressable
              onPress={take}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={`Photograph the ${side} of the ${title.toLowerCase()}`}
              className="h-[74px] w-[74px] items-center justify-center rounded-full border-[5px] border-white/85 bg-white/20 active:bg-white/40"
            >
              {capturing ? <ActivityIndicator color="#ffffff" /> : <View className="h-14 w-14 rounded-full bg-white" />}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

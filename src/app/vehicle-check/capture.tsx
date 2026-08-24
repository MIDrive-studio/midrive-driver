import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { VanOutline } from "@/components/van-outline";
import { useFramingGuidance } from "@/lib/framing-guidance";
import { isPoorQuality, prepareCapture, uploadCapture } from "@/lib/inspection";
import { useVehicleCheck } from "@/lib/vehicle-check-context";
import { POSITIONS, POSITION_INSTRUCTIONS, POSITION_KEYS, type CapturedPhoto, type InspectionPosition } from "@/types/inspection";

// The guided camera.
//
// Almost the whole screen is the live preview with a van outline over it,
// because that is the instruction: move until the real van sits inside the
// shape. Everything else on screen is deliberately small -- which angle this
// is, how far through you are, and one button.
//
// Each photograph is uploaded the moment it is accepted rather than all eight
// at the end. A driver in a yard has patchy signal, and eight uploads at once
// at the end is one long wait that can fail as a whole. Spread out, each upload
// happens while the driver is walking to the next corner, and a failure is one
// angle to retake rather than a lost walk-around.

export default function CaptureScreen() {
  const router = useRouter();
  const { driver } = useAuth();
  const { inspectionId, vehicle, photos, setPhoto, markUploaded, activePosition, setActivePosition, capturedCount } =
    useVehicleCheck();

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [capturing, setCapturing] = useState(false);
  const [pending, setPending] = useState<CapturedPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which angle is on screen lives in the walk-around's own state, not here, so
  // that going back from the review screen to retake one photograph returns to
  // this camera rather than stacking a second one on top of it.
  const index = Math.max(POSITION_KEYS.indexOf(activePosition), 0);
  const position = POSITIONS[index];
  const setIndex = (next: number) => setActivePosition(POSITION_KEYS[next]);
  const guidance = useFramingGuidance(pending === null && permission?.granted === true);

  const done = useMemo(() => POSITION_KEYS.filter((key) => Boolean(photos[key])), [photos]);

  const advance = useCallback(() => {
    // The next angle that has not been done, wrapping round. A driver who went
    // back to retake the front gets sent on to whatever is still missing rather
    // than made to walk the van again.
    const remaining = POSITION_KEYS.map((key, position) => ({ key, position })).filter(
      ({ key, position: at }) => at !== index && !photos[key]
    );

    if (remaining.length === 0) {
      router.push("/vehicle-check/review");
      return;
    }

    const after = remaining.find(({ position: at }) => at > index) ?? remaining[0];
    setActivePosition(POSITION_KEYS[after.position]);
  }, [index, photos, router, setActivePosition]);

  async function capture() {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    setError(null);

    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!shot?.uri) throw new Error("The camera did not return a photograph.");

      setPending(await prepareCapture(shot.uri, position.key as InspectionPosition));
    } catch (captureError) {
      setError((captureError as Error).message);
    }

    setCapturing(false);
  }

  async function accept(photo: CapturedPhoto) {
    if (!inspectionId || !driver) return;

    setSaving(true);
    setError(null);

    try {
      setPhoto(photo);
      await uploadCapture(inspectionId, driver.company_id, photo);
      markUploaded(photo.position);
      setPending(null);

      // `photos` here is the value from this render, which does not yet include
      // the one just taken -- hence excluding it by name rather than trusting
      // the map. Anything left means there is another corner to walk to.
      const remaining = POSITION_KEYS.filter((key) => key !== photo.position && !photos[key]);
      if (remaining.length === 0) router.push("/vehicle-check/review");
      else advance();
    } catch (uploadError) {
      // The photograph is kept in the walk-around either way. The review screen
      // retries anything that did not make it, so a driver in a signal blackspot
      // can finish the lap and let it catch up.
      setError(`That photograph did not upload — ${(uploadError as Error).message}. Carry on; it will retry at the end.`);
      setPending(null);
    }

    setSaving(false);
  }

  function abandon() {
    Alert.alert(
      "Leave the vehicle check?",
      capturedCount > 0
        ? `You have taken ${capturedCount} of ${POSITION_KEYS.length}. They are saved — you can pick up where you left off.`
        : "Nothing has been taken yet.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.dismissAll() },
      ]
    );
  }

  // --- Permission -----------------------------------------------------------

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-marine-950">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-marine-950 px-8">
        <Feather name="camera-off" size={32} color="#82aee1" />
        <Text className="mt-4 text-center text-lg font-bold text-white">The camera is off</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-marine-200">
          A vehicle check is eight photographs of your van, so MiDrive needs the camera. Nothing is recorded until you
          press the button.
        </Text>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          className="mt-6 rounded-xl bg-white px-6 py-3.5 active:bg-marine-100"
        >
          <Text className="text-base font-bold text-marine-800">Allow the camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="mt-3 px-6 py-3">
          <Text className="text-sm font-semibold text-marine-200">Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // --- Confirming a shot ----------------------------------------------------

  if (pending) {
    const poor = isPoorQuality(pending);

    return (
      <SafeAreaView className="flex-1 bg-marine-950">
        <View className="px-5 pb-3 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-marine-300">{position.label}</Text>
          <Text className="text-xl font-bold text-white">
            {poor ? "That photograph is too poor to use" : "Happy with that?"}
          </Text>
        </View>

        <View className="flex-1 px-5">
          <Image
            source={{ uri: pending.uri }}
            resizeMode="contain"
            className="flex-1 rounded-xl bg-black"
            accessibilityLabel={`The ${position.label} photograph you have just taken`}
          />
        </View>

        {poor && (
          <View className="mx-5 mt-3 rounded-xl border border-warn-line bg-warn-surface px-4 py-3">
            <Text className="text-sm font-semibold text-warn-strong">Not much detail came through</Text>
            <Text className="mt-1 text-xs leading-5 text-warn">
              It usually means the phone moved, the van was too dark, or something was over the lens. Wipe the lens,
              hold still for a second and take it again.
            </Text>
          </View>
        )}

        {error && (
          <View className="mx-5 mt-3 rounded-xl border border-bad-line bg-bad-surface px-4 py-3">
            <Text className="text-sm text-bad-strong">{error}</Text>
          </View>
        )}

        <View className="flex-row gap-3 px-5 pb-6 pt-4">
          <Pressable
            onPress={() => setPending(null)}
            disabled={saving}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl border border-marine-700 px-5 py-4 active:bg-marine-900"
          >
            <Text className="text-base font-bold text-white">Retake</Text>
          </Pressable>

          {/* Using a poor photograph stays possible, and is recorded as such.
              Blocking it entirely would strand a driver whose van is parked in
              a dark corner with no way to finish the check and start work. The
              office sees the override on the photograph and can judge it. */}
          <Pressable
            onPress={() => accept(poor ? { ...pending, overridden: true } : pending)}
            disabled={saving}
            accessibilityRole="button"
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-5 py-4 ${
              saving ? "bg-marine-400" : poor ? "border border-marine-600 active:bg-marine-900" : "bg-white active:bg-marine-100"
            }`}
          >
            {saving && <ActivityIndicator color={poor ? "#ffffff" : "#16345a"} />}
            <Text className={`text-base font-bold ${poor ? "text-marine-200" : "text-marine-800"}`}>
              {saving ? "Saving…" : poor ? "Use it anyway" : "Use photo"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- The camera -----------------------------------------------------------

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Everything below sits over the preview. pointerEvents is set per layer
          so the outline never swallows a tap meant for the shutter. */}
      <SafeAreaView className="absolute inset-0" pointerEvents="box-none">
        <View className="flex-row items-start justify-between px-4 pt-2" pointerEvents="box-none">
          <View className="rounded-xl bg-black/55 px-3 py-2">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-marine-200">
              {vehicle?.registration ?? "Vehicle check"}
            </Text>
            <Text className="text-xl font-bold text-white">{position.label}</Text>
            <Text className="text-xs text-marine-200">
              {index + 1} of {POSITION_KEYS.length}
            </Text>
          </View>

          <Pressable
            onPress={abandon}
            accessibilityRole="button"
            accessibilityLabel="Leave the vehicle check"
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/55"
          >
            <Feather name="x" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {/* The outline. This is the feature: look through the phone, move until
            the real van fills the shape, press the button. */}
        <View className="flex-1 items-center justify-center px-3" pointerEvents="none">
          <View className="aspect-[1000/620] w-full">
            <VanOutline
              shape={position.guide}
              mirrored={position.mirrored}
              colour="#ffffff"
              strokeWidth={6}
              opacity={guidance.ok ? 0.85 : 0.45}
            />
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
              <Text className="text-sm font-semibold text-white">{guidance.message}</Text>
            </View>

            <Text className="mt-2 px-6 text-center text-xs leading-5 text-white/85">
              {POSITION_INSTRUCTIONS[position.key as InspectionPosition]}
            </Text>
          </View>

          {error && (
            <View className="mt-3 rounded-xl bg-bad-strong/90 px-4 py-2.5">
              <Text className="text-xs text-white">{error}</Text>
            </View>
          )}

          {/* Progress as eight dots rather than a bar: each one is an angle, and
              they are tappable so a driver can go back and redo one. */}
          <View className="mt-4 flex-row justify-center gap-1.5">
            {POSITIONS.map((option, at) => {
              const captured = Boolean(photos[option.key]);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setIndex(at)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}${captured ? ", taken" : ", not taken yet"}`}
                  hitSlop={8}
                  className={`h-2.5 rounded-full ${
                    at === index ? "w-7 bg-white" : captured ? "w-2.5 bg-ok" : "w-2.5 bg-white/35"
                  }`}
                />
              );
            })}
          </View>

          <View className="mt-4 flex-row items-center justify-between px-4">
            <View className="w-16">
              {done.length > 0 && (
                <Pressable
                  onPress={() => router.push("/vehicle-check/review")}
                  accessibilityRole="button"
                  accessibilityLabel="Review the photographs taken so far"
                  className="items-center"
                >
                  <Feather name="grid" size={22} color="#ffffff" />
                  <Text className="mt-0.5 text-[11px] font-semibold text-white">
                    {done.length}/{POSITION_KEYS.length}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 76px, well over the thumb-target minimum, and reachable without
                looking -- which is the point, because the driver is looking at
                the van through the screen, not at the button. */}
            <Pressable
              onPress={capture}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={`Take the ${position.label} photograph`}
              className="h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/70 active:border-white"
            >
              <View className={`h-[58px] w-[58px] rounded-full ${capturing ? "bg-marine-300" : "bg-white"}`}>
                {capturing && <ActivityIndicator className="mt-4" color="#16345a" />}
              </View>
            </Pressable>

            <View className="w-16 items-end">
              {photos[position.key as InspectionPosition] && (
                <View className="items-center">
                  <Feather name="check-circle" size={22} color="#34d399" />
                  <Text className="mt-0.5 text-[11px] font-semibold text-white">Taken</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

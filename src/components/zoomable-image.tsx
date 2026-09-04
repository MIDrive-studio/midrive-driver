import { useState } from "react";
import { Image, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

// Looking properly at a picture inside a document.
//
// Several of the documents are scans -- the accident form, the handbook pages,
// the training slides -- and a scan shrunk to the width of a phone is a picture
// of some words rather than words. A driver is being asked to read and sign
// these, so being unable to read them is not a cosmetic problem.
//
// Pinch and drag, in a full-screen view, with a double tap to snap back. Built
// on the gesture and animation libraries the app already carries rather than a
// new dependency: a photo viewer is two gestures and a transform.

const MAX_SCALE = 6;
const MIN_SCALE = 1;

export function ZoomableImage({ uri, caption }: { uri: string; caption?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* The thumbnail in the document. Tapping it is the only way in, so it
          says so -- a picture that silently happens to be tappable is a
          picture nobody taps. */}
      <Pressable onPress={() => setOpen(true)} className="mb-4">
        <Image source={{ uri }} className="h-72 w-full" resizeMode="contain" />
        <View className="mt-1 flex-row items-center justify-center gap-1.5">
          <Feather name="maximize-2" size={13} color="#64748b" />
          <Text className="text-xs text-ink-subtle">Tap to enlarge</Text>
        </View>
      </Pressable>

      <Viewer uri={uri} caption={caption} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Viewer({
  uri,
  caption,
  open,
  onClose,
}: {
  uri: string;
  caption?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  function reset() {
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  }

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      // Clamped on the way in rather than after the fact, so the picture never
      // flies off and springs back.
      const next = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Pinched back to nothing: recentre, so a zoomed-out picture is never
      // left sitting off to one side.
      if (scale.value <= MIN_SCALE) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((event) => {
      // Only while zoomed in. Dragging a picture that already fits does
      // nothing but detach it from the page.
      if (scale.value <= MIN_SCALE) return;
      x.value = savedX.value + event.translationX;
      y.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // A quick way in and a quick way out: doubling in to a readable size is
      // faster than pinching, and doubling again puts it back.
      if (scale.value > MIN_SCALE) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(3);
        savedScale.value = 3;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <View className="flex-1 bg-black">
        <GestureDetector gesture={gesture}>
          <Animated.View className="flex-1 items-center justify-center" collapsable={false}>
            <Animated.Image
              source={{ uri }}
              style={[{ width, height: height * 0.8 }, style]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={() => {
            reset();
            onClose();
          }}
          hitSlop={12}
          className="absolute right-4 top-14 h-11 w-11 items-center justify-center rounded-full bg-white/15"
        >
          <Feather name="x" size={22} color="#ffffff" />
        </Pressable>

        <View className="absolute inset-x-0 bottom-10 items-center px-8">
          {caption ? <Text className="mb-1 text-center text-sm text-white/80">{caption}</Text> : null}
          <Text className="text-center text-xs text-white/50">Pinch or double tap to zoom</Text>
        </View>
      </View>
    </Modal>
  );
}

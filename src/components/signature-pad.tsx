import { useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";

// Signing with a finger.
//
// The strokes are kept as SVG paths and handed up as an SVG string. The portal
// turns that into the PNG the signed PDF prints, because the PDF is the
// document of record and only one place should decide what a signature looks
// like in it.
//
// Deliberately not a canvas library. react-native-svg is already here for the
// van outline, a signature is a handful of polylines, and a dependency added
// for one screen is a dependency that outlives the screen.

type Stroke = string;

export function SignaturePad({
  onChange,
  disabled,
}: {
  /** The signature as an SVG document, or null once cleared. */
  onChange: (svg: string | null) => void;
  disabled?: boolean;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<string>("");
  const size = useRef({ width: 0, height: 0 });

  // Held in a ref as well as state: the responder callbacks are created once
  // and would otherwise close over the first render's empty array.
  const live = useRef<{ strokes: Stroke[]; current: string }>({ strokes: [], current: "" });

  function publish() {
    const all = live.current.strokes;
    if (all.length === 0) {
      onChange(null);
      return;
    }
    const { width, height } = size.current;
    onChange(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">` +
        all.map((d) => `<path d="${d}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("") +
        `</svg>`
    );
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        live.current.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrent(live.current.current);
      },

      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        live.current.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrent(live.current.current);
      },

      onPanResponderRelease: () => {
        // A tap with no movement is a dot, not a stroke, and a page of dots is
        // not a signature.
        if (live.current.current.includes("L")) {
          live.current.strokes = [...live.current.strokes, live.current.current];
          setStrokes(live.current.strokes);
        }
        live.current.current = "";
        setCurrent("");
        publish();
      },
    })
  ).current;

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    size.current = { width, height };
  }

  function clear() {
    live.current = { strokes: [], current: "" };
    setStrokes([]);
    setCurrent("");
    onChange(null);
  }

  const empty = strokes.length === 0 && current === "";

  return (
    <View>
      <View
        onLayout={handleLayout}
        {...(disabled ? {} : responder.panHandlers)}
        className="h-48 overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-white"
      >
        <Svg width="100%" height="100%">
          {strokes.map((d, index) => (
            <Path key={index} d={d} fill="none" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {current ? (
            <Path d={current} fill="none" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>

        {empty ? (
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <Text className="text-sm text-ink-faint">Sign here with your finger</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-2 flex-row justify-end">
        <Pressable onPress={clear} disabled={disabled || empty} className="px-2 py-1">
          <Text className={`text-sm font-semibold ${empty ? "text-ink-faint" : "text-marine-700"}`}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

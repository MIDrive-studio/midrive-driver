import { Image, View, type DimensionValue } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import type { GuideShape } from "@/types/inspection";

// The outline that sits over the live camera.
//
// This is the whole idea of the feature on the driver's side: you look through
// the phone, move until the real van fills the shape, and press the button.
//
// Eight traced photographs, not a hand-drawn approximation of eight angles --
// each asset in assets/images/van-outlines/ is cropped straight from a
// reference elevation sheet (front / front-3-quarter / side / rear-3-quarter
// / rear, left and right drawn separately rather than mirrored, since the
// reference itself drew them separately) with the background removed and the
// linework converted to a white-on-transparent alpha mask. `tintColor`
// recolours that mask for the few places this needs a colour other than
// white (submitted.tsx's green, index.tsx's "finish your other check" blue),
// so the one asset per angle serves every use rather than needing a copy per
// colour.
//
// The dashed ground line is baked into each traced image already, at the
// position it actually sits at in that photograph -- there is no separate
// ground line drawn over the top here, unlike the old hand-drawn version,
// because two ground lines at two different heights would look like a fault
// rather than a guide.
//
// Dashboard has no photographic reference (it is read for what is lit up on
// the day, not compared angle-for-angle the way the exterior is) and stays
// hand-drawn, as it always was.

const ASSETS: Partial<Record<GuideShape, number>> = {
  front: require("../../assets/images/van-outlines/front.png"),
  front_left: require("../../assets/images/van-outlines/front_left.png"),
  front_right: require("../../assets/images/van-outlines/front_right.png"),
  left: require("../../assets/images/van-outlines/left.png"),
  right: require("../../assets/images/van-outlines/right.png"),
  rear_left: require("../../assets/images/van-outlines/rear_left.png"),
  rear_right: require("../../assets/images/van-outlines/rear_right.png"),
  rear: require("../../assets/images/van-outlines/rear.png"),
};

type Props = {
  shape: GuideShape;
  /** Everything inherits this, so one asset serves a white outline on a
   *  camera feed and a tinted one everywhere else it's used as an icon. */
  colour?: string;
  strokeWidth?: number;
  opacity?: number;
  width?: DimensionValue;
  height?: DimensionValue;
};

export function VanOutline({
  shape,
  colour = "#ffffff",
  strokeWidth = 5,
  opacity = 1,
  width = "100%",
  height = "100%",
}: Props) {
  if (shape === "dashboard") {
    return (
      <Svg
        viewBox="0 0 1000 620"
        width={width as number | string}
        height={height as number | string}
        fill="none"
        opacity={opacity}
      >
        <DashboardView colour={colour} strokeWidth={strokeWidth} />
      </Svg>
    );
  }

  const asset = ASSETS[shape];
  if (!asset) return null;

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Image
        source={asset}
        resizeMode="contain"
        style={{ width: "100%", height: "100%", opacity, tintColor: colour }}
      />
    </View>
  );
}

type PartProps = { colour: string; strokeWidth: number };

// An instrument binnacle seen over the top of the wheel, which is what a driver
// sitting in the cab is looking at. Drawn rather than described because "photo
// of the dashboard" gets you a photograph of the whole cab, and what the
// analysis needs is the cluster filling the frame.
function DashboardView({ colour, strokeWidth }: PartProps) {
  return (
    <G stroke={colour} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path
        d="M 160 150 C 160 128 176 114 200 114 L 800 114 C 824 114 840 128 840 150 L 840 400 C 840 424 824 438 800 438 L 200 438 C 176 438 160 424 160 400 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <Circle cx={350} cy={276} r={112} stroke={colour} strokeWidth={4} opacity={0.8} />
      <Circle cx={650} cy={276} r={112} stroke={colour} strokeWidth={4} opacity={0.8} />

      <G stroke={colour} strokeWidth={3.5} opacity={0.7}>
        <Path d="M 448 222 L 552 222 L 552 338 L 448 338 Z" />
        <Path d="M 350 276 L 296 214" />
        <Path d="M 650 276 L 704 214" />
      </G>

      {/* The top of the steering wheel rim across the bottom, which is what
          tells you which way up you are holding the phone. */}
      <Path
        d="M 118 620 C 138 474 318 452 500 452 C 682 452 862 474 882 620"
        stroke={colour}
        strokeWidth={4}
        opacity={0.7}
      />
    </G>
  );
}

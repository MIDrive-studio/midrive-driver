import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import type { GuideShape } from "@/types/inspection";

// The van outline that sits over the live camera.
//
// This is the whole idea of the feature on the driver's side: you look through
// the phone, move until the real van fills the shape, and press the button. It
// is why two mornings' photographs are comparable at all, and everything the
// admin portal does downstream -- pairing angles, comparing panels, telling new
// damage from old -- rests on the driver having something to aim at.
//
// The same drawing as components/inspections/VanSilhouette.tsx in the admin
// portal, on the same 1000 x 620 grid, so a marker the fleet manager sees on
// the left front wing is on the part of the picture the driver was told to
// frame there. Four shapes serve eight positions; the right-hand half of a van
// is the left-hand half mirrored.
//
// Proportions are a long-wheelbase high-roof panel van, drawn slightly stockier
// than a real one on purpose. A guide has to be forgiving: drawn to the exact
// proportions of one model it reads as wrong for every other van in the fleet,
// and drivers start fighting the outline instead of using it.

const GROUND = 560;

type Props = {
  shape: GuideShape;
  mirrored?: boolean;
  /** Everything inherits this, so one component serves a white outline on a
   *  camera feed and a dark one on a white card. */
  colour?: string;
  strokeWidth?: number;
  opacity?: number;
  width?: number | string;
  height?: number | string;
};

export function VanOutline({
  shape,
  mirrored = false,
  colour = "#ffffff",
  strokeWidth = 6,
  opacity = 1,
  width = "100%",
  height = "100%",
}: Props) {
  return (
    <Svg viewBox="0 0 1000 620" width={width} height={height} fill="none" opacity={opacity}>
      {/* Mirrored about the centre of the grid rather than of the shape, so the
          van stays put instead of jumping sideways when the angle flips. */}
      <G
        transform={mirrored ? "translate(1000, 0) scale(-1, 1)" : undefined}
        stroke={colour}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shape === "side" && <SideView colour={colour} strokeWidth={strokeWidth} />}
        {shape === "front" && <FrontView colour={colour} strokeWidth={strokeWidth} />}
        {shape === "rear" && <RearView colour={colour} strokeWidth={strokeWidth} />}
        {shape === "three_quarter_front" && <ThreeQuarterFront colour={colour} strokeWidth={strokeWidth} />}
        {shape === "three_quarter_rear" && <ThreeQuarterRear colour={colour} strokeWidth={strokeWidth} />}
      </G>

      {/* A horizon, not part of the vehicle. Without it the outline floats and
          reads as a sticker on the screen rather than as a van standing in
          front of you. */}
      <Line
        x1={30}
        y1={GROUND}
        x2={970}
        y2={GROUND}
        stroke={colour}
        strokeWidth={strokeWidth * 0.5}
        strokeDasharray="14, 18"
        opacity={0.45}
      />
    </Svg>
  );
}

type PartProps = { colour: string; strokeWidth: number };

function SideView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      {/* The two cubics along the bottom edge are the wheel arches. Curves
          rather than SVG arcs: an arc's sweep flag is a coin toss to get right
          and silent when wrong. */}
      <Path
        d="M 40 500 L 40 400 C 40 356 56 332 92 324 L 252 306 L 336 150 C 342 138 356 130 374 130 L 918 130 C 944 130 958 148 958 174 L 958 500 L 862 500 C 862 418 706 418 706 500 L 316 500 C 316 418 160 418 160 500 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />
      <Circle cx={238} cy={492} r={68} stroke={colour} strokeWidth={5} />
      <Circle cx={784} cy={492} r={68} stroke={colour} strokeWidth={5} />
      <Circle cx={238} cy={492} r={28} stroke={colour} strokeWidth={4} opacity={0.6} />
      <Circle cx={784} cy={492} r={28} stroke={colour} strokeWidth={4} opacity={0.6} />

      {/* Cab detail: it tells a driver at a glance which way round the outline
          is, without competing with the shape they are trying to fill. */}
      <G stroke={colour} strokeWidth={4} opacity={0.7}>
        <Path d="M 258 300 L 340 156" />
        <Path d="M 358 176 L 516 164 L 516 274 L 358 286 Z" />
        <Path d="M 524 134 L 524 500" />
        <Path d="M 700 132 L 700 500" />
        <Path d="M 336 232 L 302 222 L 298 260 L 332 268" />
      </G>
    </G>
  );
}

function FrontView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={5} opacity={0.85}>
        <Path d="M 292 496 L 292 552 L 352 552 L 352 496" />
        <Path d="M 648 496 L 648 552 L 708 552 L 708 496" />
      </G>

      <Path
        d="M 282 545 L 298 208 C 300 180 318 164 346 162 L 654 162 C 682 164 700 180 702 208 L 718 545 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={4} opacity={0.7}>
        <Path d="M 324 200 L 676 200 L 686 322 L 314 322 Z" />
        <Path d="M 310 348 L 690 348" />
        <Path d="M 372 398 L 628 398 L 630 448 L 370 448 Z" />
        <Path d="M 296 392 L 362 392 L 364 442 L 298 442 Z" />
        <Path d="M 638 392 L 704 392 L 702 442 L 636 442 Z" />
        <Path d="M 272 466 L 728 466 L 730 542 L 270 542 Z" />
      </G>

      {/* Mirrors at full weight rather than as a detail: they stick out past the
          body and are the first thing to fall outside a frame that is too
          tight. */}
      <G stroke={colour} strokeWidth={5}>
        <Path d="M 282 272 L 232 262 L 226 330 L 280 336" />
        <Path d="M 718 272 L 768 262 L 774 330 L 720 336" />
      </G>
    </G>
  );
}

function RearView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={5} opacity={0.85}>
        <Path d="M 292 496 L 292 552 L 352 552 L 352 496" />
        <Path d="M 648 496 L 648 552 L 708 552 L 708 496" />
      </G>

      <Path
        d="M 282 545 L 296 194 C 298 168 316 152 344 150 L 656 150 C 684 152 702 168 704 194 L 718 545 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={4} opacity={0.7}>
        {/* The split between the two rear doors, which is the quickest way to
            tell this outline from the front one. */}
        <Path d="M 500 176 L 500 500" />
        <Path d="M 320 188 L 320 500 L 680 500 L 680 188" />
        <Path d="M 342 214 L 486 214 L 486 316 L 342 316 Z" />
        <Path d="M 514 214 L 658 214 L 658 316 L 514 316 Z" />
        <Path d="M 292 396 L 342 396 L 344 472 L 294 472 Z" />
        <Path d="M 658 396 L 708 396 L 706 472 L 656 472 Z" />
        <Path d="M 274 500 L 726 500 L 728 542 L 272 542 Z" />
      </G>
    </G>
  );
}

// The near corner sits at x=382. Left of it is the foreshortened front face,
// right of it the flank falling away toward the rear. One vanishing point, off
// the right of the frame -- that is the whole of the perspective here.
function ThreeQuarterFront({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={5} opacity={0.85}>
        <Ellipse cx={478} cy={498} rx={46} ry={62} />
        <Ellipse cx={846} cy={444} rx={38} ry={52} />
      </G>

      <Path
        d="M 148 214 C 150 186 164 170 188 166 L 356 138 C 372 136 384 142 384 156 L 908 224 C 924 227 932 236 932 250 L 932 442 L 384 540 L 148 500 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={4} opacity={0.7}>
        <Path d="M 176 220 L 380 190 L 380 300 L 172 318 Z" />
        <Path d="M 168 380 L 380 362 L 380 404 L 168 420 Z" />
        <Path d="M 166 440 L 380 424 L 380 480 L 164 492 Z" />
        <Path d="M 400 172 L 520 187 L 520 300 L 400 292 Z" />
        <Path d="M 560 192 L 556 528" />
        <Path d="M 742 214 L 736 496" />
      </G>

      {/* The near corner itself, top to bottom. The strongest line in the
          drawing: lining the real corner up with it is what makes two days'
          photographs comparable. */}
      <Path d="M 384 152 L 384 540" stroke={colour} strokeWidth={5} opacity={0.9} />
      <Path d="M 388 244 L 436 252 L 434 300 L 388 292" stroke={colour} strokeWidth={5} />
    </G>
  );
}

function ThreeQuarterRear({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={5} opacity={0.85}>
        <Ellipse cx={496} cy={492} rx={44} ry={60} />
        <Ellipse cx={852} cy={442} rx={36} ry={50} />
      </G>

      <Path
        d="M 150 208 C 152 180 166 164 190 160 L 358 134 C 374 132 386 138 386 152 L 910 220 C 926 223 934 232 934 246 L 934 440 L 386 540 L 150 498 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={4} opacity={0.7}>
        <Path d="M 268 176 L 268 512" />
        <Path d="M 176 218 L 380 190 L 380 296 L 172 314 Z" />
        <Path d="M 166 372 L 380 354 L 380 450 L 164 464 Z" />
        <Path d="M 162 474 L 380 458 L 380 500 L 160 512 Z" />
        <Path d="M 566 190 L 562 528" />
        <Path d="M 748 212 L 742 494" />
      </G>

      <Path d="M 386 148 L 386 540" stroke={colour} strokeWidth={5} opacity={0.9} />
    </G>
  );
}

import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import type { GuideShape } from "@/types/inspection";

// The outline that sits over the live camera.
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
// frame there. Four van shapes serve eight positions, because the right-hand
// half of a van is the left-hand half mirrored; the dashboard gets its own,
// which is an instrument cluster rather than a vehicle.
//
// The first version was drawn deliberately generic, on the argument that a
// framing guide should be forgiving across a mixed fleet. That was the wrong
// call: a shape vague enough to fit any van does not look like the van in front
// of you, and a driver who cannot tell what they are aiming at ignores the
// guide. It is now a specific vehicle -- the roof step, the raked screen, the
// glazing band, the trapezoid grille -- and reads as one at arm's length, which
// is the only distance that matters here.

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
  strokeWidth = 5,
  opacity = 1,
  width = "100%",
  height = "100%",
}: Props) {
  const onWheels = shape !== "dashboard";

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
        {shape === "dashboard" && <DashboardView colour={colour} strokeWidth={strokeWidth} />}
      </G>

      {/* A horizon, not part of the vehicle. Without it the outline floats and
          reads as a sticker on the screen rather than a van standing in front
          of you. Omitted for the dashboard, which has no ground. */}
      {onWheels && (
        <Line
          x1={30}
          y1={GROUND}
          x2={970}
          y2={GROUND}
          stroke={colour}
          strokeWidth={strokeWidth * 0.55}
          strokeDasharray="14, 18"
          opacity={0.45}
        />
      )}
    </Svg>
  );
}

type PartProps = { colour: string; strokeWidth: number };

function SideView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      {/* The two cubics along the bottom edge are the wheel arches; curves
          rather than SVG arcs because an arc's sweep flag is a coin toss to get
          right and silent when wrong. The kink at x=434 is the step from the
          cab roof up to the high roof, which is the single most recognisable
          thing about this van from the side. */}
      <Path
        d="M 36 470 L 34 392 C 34 350 44 322 74 306 L 168 288 L 214 276 L 300 176 C 306 162 318 154 336 152 L 408 148 C 424 147 432 140 434 128 L 438 118 L 930 116 C 950 116 960 126 960 144 L 960 470 L 862 470 C 862 386 700 386 700 470 L 316 470 C 316 386 154 386 154 470 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <Circle cx={235} cy={486} r={74} stroke={colour} strokeWidth={4.5} />
      <Circle cx={781} cy={486} r={74} stroke={colour} strokeWidth={4.5} />
      <Circle cx={235} cy={486} r={34} stroke={colour} strokeWidth={3.5} opacity={0.65} />
      <Circle cx={781} cy={486} r={34} stroke={colour} strokeWidth={3.5} opacity={0.65} />

      <G stroke={colour} strokeWidth={3.5} opacity={0.72}>
        <Path d="M 224 272 L 298 178 L 320 177 L 242 271 Z" />
        <Path d="M 262 316 L 268 470" />
        <Path d="M 520 174 L 520 470" />
        <Path d="M 348 196 L 506 190 L 506 284 L 348 290 Z" />

        <Path d="M 540 192 L 898 188 L 898 288 L 540 292 Z" />
        <Path d="M 630 191 L 630 291" />
        <Path d="M 720 190 L 720 290" />
        <Path d="M 810 189 L 810 289" />

        <Path d="M 120 398 L 950 390" />
        <Path d="M 908 120 L 908 470" />

        <Path d="M 44 330 L 96 320 L 100 352 L 46 360 Z" />
        <Path d="M 936 202 L 954 202 L 954 300 L 936 300" />
        <Path d="M 908 470 L 962 470 L 962 506 L 908 506" />
      </G>

      {/* Mirror and aerial at full weight. Both stick out past the body and are
          the first things to fall outside a frame that is too tight. */}
      <G stroke={colour} strokeWidth={4.5}>
        <Path d="M 316 226 L 268 214 L 260 258 L 310 268" />
        <Path d="M 356 150 L 344 96" />
      </G>
    </G>
  );
}

function FrontView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={4.5} opacity={0.85}>
        <Path d="M 298 500 L 298 556 L 356 556 L 356 500" />
        <Path d="M 644 500 L 644 556 L 702 556 L 702 500" />
      </G>

      <Path
        d="M 292 528 L 300 196 C 302 166 320 148 350 146 L 650 146 C 680 148 698 166 700 196 L 708 528 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={3.5} opacity={0.72}>
        <Path d="M 440 152 L 440 172" />
        <Path d="M 478 152 L 478 172" />
        <Path d="M 516 152 L 516 172" />
        <Path d="M 554 152 L 554 172" />

        <Path d="M 322 202 L 678 202 L 690 330 L 310 330 Z" />
        <Path d="M 396 324 L 470 252" />
        <Path d="M 528 324 L 602 252" />

        <Path d="M 392 348 L 608 348 L 620 412 L 380 412 Z" />
        <Path d="M 396 366 L 606 366" />
        <Path d="M 400 384 L 610 384" />
        <Ellipse cx={500} cy={358} rx={26} ry={9} stroke={colour} />

        <Path d="M 300 344 L 388 348 L 384 404 L 302 398 Z" />
        <Path d="M 700 344 L 612 348 L 616 404 L 698 398 Z" />

        <Path d="M 286 420 L 714 420 L 716 528 L 284 528 Z" />
        <Path d="M 396 442 L 604 442 L 608 486 L 392 486 Z" />
        <Path d="M 440 496 L 560 496 L 560 520 L 440 520 Z" />
      </G>

      <G stroke={colour} strokeWidth={4.5}>
        <Path d="M 292 250 L 232 240 L 224 316 L 290 322" />
        <Path d="M 708 250 L 768 240 L 776 316 L 710 322" />
      </G>
    </G>
  );
}

function RearView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <Path
        d="M 292 520 L 298 190 C 300 162 318 146 348 144 L 652 144 C 682 146 700 162 702 190 L 708 520 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={3.5} opacity={0.72}>
        {/* Twin doors and their split, which is what distinguishes this from
            the front view immediately. */}
        <Path d="M 318 178 L 682 178 L 682 496 L 318 496 Z" />
        <Path d="M 500 178 L 500 496" strokeWidth={4} opacity={0.9} />

        <Path d="M 336 196 L 492 196 L 492 306 L 336 306 Z" />
        <Path d="M 508 196 L 664 196 L 664 306 L 508 306 Z" />

        <Path d="M 480 344 L 480 368" />
        <Path d="M 520 344 L 520 368" />

        <Path d="M 298 320 L 338 320 L 340 440 L 300 440 Z" />
        <Path d="M 702 320 L 662 320 L 660 440 L 700 440 Z" />

        <Path d="M 430 452 L 570 452 L 570 480 L 430 480 Z" />
        <Path d="M 286 496 L 714 496 L 716 548 L 284 548 Z" />
        <Path d="M 420 508 L 580 508 L 580 540 L 420 540" />
      </G>
    </G>
  );
}

// The near corner sits at x=386. Left of it is the foreshortened front face,
// right of it the flank falling away toward the rear. One vanishing point, off
// the right of the frame -- that is the whole of the perspective here.
function ThreeQuarterFront({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={4.5} opacity={0.85}>
        <Ellipse cx={486} cy={492} rx={48} ry={66} />
        <Ellipse cx={856} cy={438} rx={40} ry={56} />
      </G>

      <Path
        d="M 150 226 C 152 194 168 176 194 172 L 344 146 C 362 142 376 148 380 162 L 388 152 L 906 220 C 926 223 936 234 936 250 L 936 446 L 386 546 L 150 502 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={3.5} opacity={0.72}>
        <Path d="M 178 236 L 374 202 L 374 312 L 174 332 Z" />
        <Path d="M 170 384 L 374 366 L 374 412 L 170 428 Z" />
        <Path d="M 168 444 L 374 428 L 374 490 L 166 500 Z" />

        <Path d="M 404 178 L 528 194 L 528 306 L 404 298 Z" />
        <Path d="M 560 200 L 880 244 L 880 330 L 560 300 Z" />
        <Path d="M 640 211 L 640 309" />
        <Path d="M 720 222 L 720 318" />
        <Path d="M 800 233 L 800 324" />

        <Path d="M 556 196 L 550 534" />
        <Path d="M 900 240 L 900 452" />
      </G>

      {/* The near corner itself, top to bottom. The strongest line in the
          drawing, because lining the real corner up with it is what makes two
          mornings' photographs comparable. */}
      <Path d="M 386 158 L 386 546" stroke={colour} strokeWidth={4.5} opacity={0.9} />
      <Path d="M 390 248 L 442 258 L 440 308 L 390 298" stroke={colour} strokeWidth={4.5} />
    </G>
  );
}

function ThreeQuarterRear({ colour, strokeWidth }: PartProps) {
  return (
    <G>
      <G stroke={colour} strokeWidth={4.5} opacity={0.85}>
        <Ellipse cx={502} cy={488} rx={46} ry={64} />
        <Ellipse cx={860} cy={436} rx={38} ry={54} />
      </G>

      <Path
        d="M 152 210 C 154 182 168 164 194 160 L 356 136 C 374 134 386 140 388 154 L 908 218 C 928 221 938 232 938 248 L 938 444 L 388 544 L 152 500 Z"
        stroke={colour}
        strokeWidth={strokeWidth}
      />

      <G stroke={colour} strokeWidth={3.5} opacity={0.72}>
        <Path d="M 270 172 L 268 516" strokeWidth={4} opacity={0.9} />
        <Path d="M 176 220 L 376 192 L 376 300 L 172 318 Z" />
        <Path d="M 168 366 L 376 348 L 376 448 L 166 462 Z" />
        <Path d="M 164 476 L 376 460 L 376 504 L 162 514 Z" />

        <Path d="M 566 196 L 884 240 L 884 326 L 566 296 Z" />
        <Path d="M 646 207 L 646 305" />
        <Path d="M 726 218 L 726 314" />
        <Path d="M 806 229 L 806 320" />
        <Path d="M 562 192 L 556 530" />
      </G>

      <Path d="M 388 150 L 388 544" stroke={colour} strokeWidth={4.5} opacity={0.9} />
    </G>
  );
}

// An instrument binnacle seen over the top of the wheel, which is what a driver
// sitting in the cab is looking at. Drawn rather than described because "photo
// of the dashboard" gets you a photograph of the whole cab, and what the
// analysis needs is the cluster filling the frame.
function DashboardView({ colour, strokeWidth }: PartProps) {
  return (
    <G>
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

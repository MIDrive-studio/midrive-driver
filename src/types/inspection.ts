// The eight camera positions of a walk-around, in the order a person walks
// them. This list is the same in three places -- here, in the admin portal's
// lib/inspections/positions.ts, and in the check constraint in the migration --
// because a shared package between two repos and a database is not something
// this codebase has, and pretending otherwise would hide the coupling rather
// than remove it. If one changes, all three change.

// `guide` used to name one of five shapes, mirrored left-to-right for the
// right-hand positions. It's now the position's own key for all eight photo
// angles -- each has its own traced reference image (assets/van-outlines/),
// not a flipped copy of its opposite number, since the reference set given
// for this (front/front-3/4/side/rear-3/4/rear, left and right drawn
// separately) was specific enough per side that mirroring stopped being
// worth the fidelity it cost.
export const POSITIONS = [
  { key: "front", label: "Front", short: "Front", guide: "front" },
  { key: "front_left", label: "Front Left", short: "Front L", guide: "front_left" },
  { key: "left", label: "Left Side", short: "Left", guide: "left" },
  { key: "rear_left", label: "Rear Left", short: "Rear L", guide: "rear_left" },
  { key: "rear", label: "Rear", short: "Rear", guide: "rear" },
  { key: "rear_right", label: "Rear Right", short: "Rear R", guide: "rear_right" },
  { key: "right", label: "Right Side", short: "Right", guide: "right" },
  { key: "front_right", label: "Front Right", short: "Front R", guide: "front_right" },
  // Last, because the driver finishes the lap back at the cab door and this is
  // the one shot they can take sitting down. It is also the only one that is
  // not a comparison: a dashboard photograph is read for what is lit up on it
  // today, not for what changed since yesterday.
  { key: "dashboard", label: "Dashboard", short: "Dash", guide: "dashboard" },
] as const;

export type InspectionPosition = (typeof POSITIONS)[number]["key"];
export type GuideShape = (typeof POSITIONS)[number]["guide"];

export const POSITION_KEYS = POSITIONS.map((p) => p.key) as readonly InspectionPosition[];

export function positionAt(index: number) {
  return POSITIONS[Math.min(Math.max(index, 0), POSITIONS.length - 1)];
}

export function positionLabel(key: string): string {
  return POSITIONS.find((p) => p.key === key)?.label ?? "Unknown angle";
}

// Told as an instruction rather than described. "Stand back from the nose" is
// something you can do while holding a phone in a yard; "front elevation of the
// vehicle" is not.
export const POSITION_INSTRUCTIONS: Record<InspectionPosition, string> = {
  front: "Stand square to the front, about four steps back.",
  front_left: "Move to the front-left corner. You should see the nose and the driver's side.",
  left: "Stand square to the driver's side, far enough back to fit the whole van in.",
  rear_left: "Move to the rear-left corner. You should see the back doors and the driver's side.",
  rear: "Stand square to the back doors, about four steps back.",
  rear_right: "Move to the rear-right corner. You should see the back doors and the passenger side.",
  right: "Stand square to the passenger side, far enough back to fit the whole van in.",
  front_right: "Move to the front-right corner. You should see the nose and the passenger side.",
  dashboard: "Sit in the cab with the ignition on. Fit the dials inside the outline.",
};

export type CapturedPhoto = {
  position: InspectionPosition;
  /** Local file URI of the downscaled copy that will be uploaded. */
  uri: string;
  width: number;
  height: number;
  bytes: number;
  qualityScore: number;
  /** True when the driver was warned and used the photograph anyway. */
  overridden: boolean;
};

export type VehicleCheckContext = {
  vehicle_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  mileage: number | null;
  open_damage_count: number;
  open_safety_defect_count: number;
  last_inspection: {
    id: string;
    date: string;
    status: string;
    new_damage_count: number;
    driver_name: string | null;
  } | null;
  todays_inspection: { id: string } | null;
};

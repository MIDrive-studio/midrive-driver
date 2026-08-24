// The eight camera positions of a walk-around, in the order a person walks
// them. This list is the same in three places -- here, in the admin portal's
// lib/inspections/positions.ts, and in the check constraint in the migration --
// because a shared package between two repos and a database is not something
// this codebase has, and pretending otherwise would hide the coupling rather
// than remove it. If one changes, all three change.

export const POSITIONS = [
  { key: "front", label: "Front", short: "Front", guide: "front", mirrored: false },
  { key: "front_left", label: "Front Left", short: "Front L", guide: "three_quarter_front", mirrored: false },
  { key: "left", label: "Left Side", short: "Left", guide: "side", mirrored: false },
  { key: "rear_left", label: "Rear Left", short: "Rear L", guide: "three_quarter_rear", mirrored: false },
  { key: "rear", label: "Rear", short: "Rear", guide: "rear", mirrored: false },
  { key: "rear_right", label: "Rear Right", short: "Rear R", guide: "three_quarter_rear", mirrored: true },
  { key: "right", label: "Right Side", short: "Right", guide: "side", mirrored: true },
  { key: "front_right", label: "Front Right", short: "Front R", guide: "three_quarter_front", mirrored: true },
  // Last, because the driver finishes the lap back at the cab door and this is
  // the one shot they can take sitting down. It is also the only one that is
  // not a comparison: a dashboard photograph is read for what is lit up on it
  // today, not for what changed since yesterday.
  { key: "dashboard", label: "Dashboard", short: "Dash", guide: "dashboard", mirrored: false },
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
  uploaded: boolean;
};

export type VehicleCheckContext = {
  vehicle_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  mileage: number | null;
  open_damage_count: number;
  last_inspection: {
    id: string;
    date: string;
    status: string;
    new_damage_count: number;
    driver_name: string | null;
  } | null;
  todays_inspection: { id: string } | null;
};

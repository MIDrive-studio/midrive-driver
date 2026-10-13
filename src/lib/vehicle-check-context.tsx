import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CapturedPhoto, InspectionPosition, VehicleCheckContext as Context } from "@/types/inspection";
import { POSITION_KEYS } from "@/types/inspection";

// The walk-around in progress: which van, which inspection, and the photographs
// taken so far.
//
// Held in memory rather than written to AsyncStorage directly, unlike the
// accident draft -- but not actually lost if the app dies mid-check, because
// begin() is never called with a blank slate for a check that was already
// under way. lib/inspection-sync.ts's own durable queue is where a photo
// really lives from the moment it's accepted (copied to disk, recorded,
// uploaded whenever signal allows); vehicle-check/index.tsx reads that queue
// for the inspection id start_vehicle_inspection() hands back -- which is the
// same id a second time if one was already open for today -- and seeds begin()
// with whatever is already there. Losing that seeding is exactly how a
// driver who did seven of nine, got interrupted, and came back, would be
// quietly sent round the van again missing two corners nobody told them
// about -- which looks identical, from their side, to a walk-around that was
// simply unfinished.

type State = {
  inspectionId: string | null;
  vehicle: Context | null;
  photos: Partial<Record<InspectionPosition, CapturedPhoto>>;
  /** Which angle the camera is pointed at. Held here rather than in the camera
   *  screen so the review screen can send the driver back to retake one
   *  particular photograph without pushing a second copy of the camera onto the
   *  stack. */
  activePosition: InspectionPosition;
};

type Value = State & {
  begin: (inspectionId: string, vehicle: Context, alreadyQueued?: Partial<Record<InspectionPosition, CapturedPhoto>>) => void;
  setPhoto: (photo: CapturedPhoto) => void;
  setActivePosition: (position: InspectionPosition) => void;
  reset: () => void;
  /** The first angle still missing, or null when the walk-around is complete. */
  nextPosition: InspectionPosition | null;
  capturedCount: number;
};

const VehicleCheck = createContext<Value | null>(null);

export function VehicleCheckProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    inspectionId: null,
    vehicle: null,
    photos: {},
    activePosition: "front",
  });

  const begin = useCallback((inspectionId: string, vehicle: Context, alreadyQueued: Partial<Record<InspectionPosition, CapturedPhoto>> = {}) => {
    setState({
      inspectionId,
      vehicle,
      photos: alreadyQueued,
      activePosition: POSITION_KEYS.find((key) => !alreadyQueued[key]) ?? "front",
    });
  }, []);

  const setPhoto = useCallback((photo: CapturedPhoto) => {
    setState((current) => ({ ...current, photos: { ...current.photos, [photo.position]: photo } }));
  }, []);

  const setActivePosition = useCallback((activePosition: InspectionPosition) => {
    setState((current) => ({ ...current, activePosition }));
  }, []);

  const reset = useCallback(() => {
    setState({ inspectionId: null, vehicle: null, photos: {}, activePosition: "front" });
  }, []);

  const value = useMemo<Value>(() => {
    // In walk-around order, not in the order they happened to be taken: a
    // driver who goes back to retake the front should be sent onward to
    // whatever is still missing, not made to walk the whole van again.
    const nextPosition = POSITION_KEYS.find((key) => !state.photos[key]) ?? null;

    return {
      ...state,
      begin,
      setPhoto,
      setActivePosition,
      reset,
      nextPosition,
      capturedCount: POSITION_KEYS.filter((key) => Boolean(state.photos[key])).length,
    };
  }, [state, begin, setPhoto, setActivePosition, reset]);

  return <VehicleCheck.Provider value={value}>{children}</VehicleCheck.Provider>;
}

export function useVehicleCheck(): Value {
  const value = useContext(VehicleCheck);
  if (!value) throw new Error("useVehicleCheck must be used inside a VehicleCheckProvider.");
  return value;
}

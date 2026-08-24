import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CapturedPhoto, InspectionPosition, VehicleCheckContext as Context } from "@/types/inspection";
import { POSITION_KEYS } from "@/types/inspection";

// The walk-around in progress: which van, which inspection, and the photographs
// taken so far.
//
// Held in memory rather than written to AsyncStorage, unlike the accident
// draft. The two look similar and are not: an accident report is filled in over
// half an hour at a roadside, in a state where being interrupted is likely and
// losing the work would be awful. A walk-around is eight photographs over two
// minutes, and the photographs are already on the server the moment each one is
// accepted -- so an app that dies mid-check resumes from the server on the next
// start, which start_vehicle_inspection is written to do.

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
  begin: (inspectionId: string, vehicle: Context) => void;
  setPhoto: (photo: CapturedPhoto) => void;
  markUploaded: (position: InspectionPosition) => void;
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

  const begin = useCallback((inspectionId: string, vehicle: Context) => {
    setState({ inspectionId, vehicle, photos: {}, activePosition: "front" });
  }, []);

  const setPhoto = useCallback((photo: CapturedPhoto) => {
    setState((current) => ({ ...current, photos: { ...current.photos, [photo.position]: photo } }));
  }, []);

  const markUploaded = useCallback((position: InspectionPosition) => {
    setState((current) => {
      const existing = current.photos[position];
      if (!existing) return current;
      return { ...current, photos: { ...current.photos, [position]: { ...existing, uploaded: true } } };
    });
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
      markUploaded,
      setActivePosition,
      reset,
      nextPosition,
      capturedCount: POSITION_KEYS.filter((key) => Boolean(state.photos[key])).length,
    };
  }, [state, begin, setPhoto, markUploaded, setActivePosition, reset]);

  return <VehicleCheck.Provider value={value}>{children}</VehicleCheck.Provider>;
}

export function useVehicleCheck(): Value {
  const value = useContext(VehicleCheck);
  if (!value) throw new Error("useVehicleCheck must be used inside a VehicleCheckProvider.");
  return value;
}

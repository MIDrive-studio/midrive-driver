export type FuelStation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
};

export type FuelStationWithDistance = FuelStation & {
  /** Metres from the driver, or null when there is no fix yet. */
  distance: number | null;
};

export type AllocatedCard = {
  id: string;
  card_name: string;
  provider: string | null;
  card_number: string;
  last_four: string;
  pin: string;
  expiry_date: string | null;
};

export type Allocation = {
  allocationId: string;
  fuelCardId: string;
  expiresAt: string;
  reused: boolean;
};

export type MileageCheck = {
  valid: boolean;
  previousMileage: number | null;
  reason?: string;
};

export type FuelStep = "station" | "mileage" | "reveal" | "record";

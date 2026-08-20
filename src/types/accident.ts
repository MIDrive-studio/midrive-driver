export type EvidenceItem = {
  uri: string;
  media_type: "photo" | "video";
};

export type AccidentDraft = {
  step: AccidentStep;
  timeMode: "now" | "past" | null;
  vehicleRegistration: string;
  date_time: string;
  latitude: number | null;
  longitude: number | null;
  location_address: string;
  evidence: EvidenceItem[];
  third_party_name: string;
  third_party_phone: string;
  third_party_vehicle_registration: string;
  third_party_insurance_company: string;
  third_party_policy_number: string;
  description: string;
};

export type AccidentStep =
  | "vehicle"
  | "when"
  | "time"
  | "confirm"
  | "location"
  | "evidence"
  | "third_party"
  | "description"
  | "review";

export type AccidentReport = {
  id: string;
  date_time: string;
  location_address: string | null;
  description: string;
  vehicle_registration: string;
  status: string;
  created_at: string;
};

import type { Driver } from "@/types/driver";

// The canonical "is this profile done" field list, shared by the Home
// screen's completion card (checks the live driver record, including
// phone -- admin-set at creation, never edited here) and the Complete
// Profile form's own submit validation (the editable subset below).
export const PROFILE_REQUIRED_FIELDS: { key: keyof Driver; label: string }[] = [
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "phone", label: "Phone Number" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode" },
  { key: "utr_number", label: "UTR Number" },
  { key: "ni_number", label: "National Insurance Number" },
  { key: "bank_account_name", label: "Bank Account Name" },
  { key: "bank_sort_code", label: "Sort Code" },
  { key: "bank_account_number", label: "Account Number" },
  { key: "emergency_contact", label: "Emergency Contact Name" },
  { key: "emergency_phone", label: "Emergency Contact Phone" },
];

export function calcProfileCompletion(driver: Driver | null) {
  if (!driver) return { percent: 0, missing: PROFILE_REQUIRED_FIELDS.map((f) => f.label) };
  const missing = PROFILE_REQUIRED_FIELDS.filter((f) => {
    const value = driver[f.key];
    return value === null || value === undefined || String(value).trim() === "";
  }).map((f) => f.label);
  const percent = Math.round(((PROFILE_REQUIRED_FIELDS.length - missing.length) / PROFILE_REQUIRED_FIELDS.length) * 100);
  return { percent, missing };
}

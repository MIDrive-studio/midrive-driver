import type { Driver } from "@/types/driver";

// What counts as a finished profile.
//
// Two lists, because two different things were being conflated.
//
// A driver cannot get a UTR until HMRC issues one, which is weeks or months
// after they start. Requiring it to complete a profile meant a new driver could
// never finish, and the card said so every time they opened the app -- about a
// number nobody could give them. It is still needed before self-billing pays
// out, so it is asked for separately rather than dropped.
//
// Phone had the opposite problem: required here but deliberately absent from
// the form, on the grounds that an administrator sets it when creating the
// driver. When they had not, the card asked the driver for something the app
// gave them no way to enter. The form now has the field.

export const PROFILE_REQUIRED_FIELDS: { key: keyof Driver; label: string }[] = [
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "phone", label: "Phone Number" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode" },
  { key: "ni_number", label: "National Insurance Number" },
  { key: "bank_account_name", label: "Bank Account Name" },
  { key: "bank_sort_code", label: "Sort Code" },
  { key: "bank_account_number", label: "Account Number" },
  { key: "next_of_kin_name", label: "Next of Kin" },
  { key: "next_of_kin_phone", label: "Next of Kin Phone" },
  { key: "next_of_kin_relationship", label: "Relationship to You" },
];

/** Wanted eventually, but never a reason to hold up a profile. */
export const PROFILE_LATER_FIELDS: { key: keyof Driver; label: string }[] = [
  { key: "utr_number", label: "UTR Number" },
];

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export function calcProfileCompletion(driver: Driver | null) {
  if (!driver) {
    return {
      percent: 0,
      missing: PROFILE_REQUIRED_FIELDS.map((f) => f.label),
      missingLater: PROFILE_LATER_FIELDS.map((f) => f.label),
    };
  }

  const missing = PROFILE_REQUIRED_FIELDS.filter((f) => isBlank(driver[f.key])).map((f) => f.label);

  // Deliberately outside the percentage. A driver who has given everything they
  // physically can should see 100%, not 91% and a standing warning about
  // paperwork that has not arrived yet.
  const missingLater = PROFILE_LATER_FIELDS.filter((f) => isBlank(driver[f.key])).map((f) => f.label);

  const percent = Math.round(
    ((PROFILE_REQUIRED_FIELDS.length - missing.length) / PROFILE_REQUIRED_FIELDS.length) * 100
  );

  return { percent, missing, missingLater };
}

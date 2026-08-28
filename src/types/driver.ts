export type ProfileStatus = "pending" | "completed";

export type Driver = {
  id: string;
  company_id: string;
  site_id: string;
  user_id: string | null;

  full_name: string;
  email: string | null;
  phone: string | null;

  date_of_birth: string | null;
  nationality: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;

  utr_number: string | null;
  ni_number: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;

  profile_status: ProfileStatus;
};

// The only fields the app is ever allowed to write via Complete Profile --
// an explicit allowlist, never a spread of the raw form state, so a future
// bug in the form can't accidentally send a restricted field like site_id.
export type DriverProfileUpdate = {
  date_of_birth: string | null;
  phone: string | null;
  nationality: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  utr_number: string | null;
  ni_number: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  profile_status: "completed";
};

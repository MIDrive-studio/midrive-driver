export type ProfileStatus = "pending" | "completed";

// Where the driver stands with the company, as opposed to how much of the
// profile form they have filled in. The two are independent: a driver can have
// a completed profile and still be onboarding, which is why the app cannot
// infer one from the other.
export type DriverStatus = "onboarding" | "active" | "offboarded";

// "full" means start the whole process again; "confirm" means check what we
// already hold is still right. Set by reonboard_driver() from how long they
// were gone, and null for anyone who never left.
export type OnboardingMode = "full" | "confirm" | null;

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
  status: DriverStatus;

  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_email: string | null;
  next_of_kin_address: string | null;

  utr_status: "has" | "applying" | "none" | null;
  onboarding_mode: OnboardingMode;
  onboarding_started_at: string | null;
  details_confirmed_at: string | null;
  engagement_no: number;
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

// What a driver may prove their right to work with, and what else we need.
//
// Three routes, and they differ in ways that matter. A British passport is
// proof on its own. An EU, EEA or Swiss driver's status is held digitally by
// the Home Office, so the document is only half of it and a share code is the
// other half. Anyone else gives both.
//
// These are rules from the office, not this file's opinion, and they are here
// rather than inside a screen for two reasons: a screen cannot be tested
// without a phone, and a rule buried in JSX is a rule nobody can find when it
// changes. Every value below is a document_kind the database already accepts.
//
// Getting this wrong has two failure modes and both are bad: refuse a document
// that is valid and a legal driver cannot start; accept one that is not and
// the company is employing someone illegally. So nothing here is inferred --
// each route was specified.

export type Basis = "british" | "eu" | "other";

export type BasisChoice = {
  value: Basis;
  label: string;
  hint: string;
};

export type DocumentChoice = {
  /** The document_kind stored against the upload. */
  kind: string;
  label: string;
  hint: string;
};

export const BASES: BasisChoice[] = [
  {
    value: "british",
    label: "British or Irish citizen",
    hint: "You hold a British or Irish passport, or were born here.",
  },
  {
    value: "eu",
    label: "EU, EEA or Swiss citizen",
    hint: "Including settled and pre-settled status.",
  },
  {
    value: "other",
    label: "Any other nationality",
    hint: "A visa, work permit or other immigration status.",
  },
];

const DOCUMENTS: Record<Basis, DocumentChoice[]> = {
  british: [
    {
      kind: "passport",
      label: "Passport",
      hint: "British or Irish. The photo page. It may be expired.",
    },
    {
      kind: "birth_certificate",
      label: "Birth or adoption certificate",
      hint: "Issued in the UK, Channel Islands, Isle of Man or Ireland.",
    },
    {
      kind: "certificate_of_naturalisation",
      label: "Certificate of naturalisation or registration",
      hint: "If you became a British citizen rather than being born one.",
    },
  ],
  eu: [
    { kind: "passport", label: "Passport", hint: "The photo page." },
    {
      kind: "national_identity_card",
      label: "National identity card",
      hint: "The side with your photo.",
    },
    {
      kind: "residence_permit",
      label: "Biometric residence permit or card",
      hint: "A BRP or BRC. The side with your photo.",
    },
  ],
  other: [
    { kind: "passport", label: "Passport", hint: "The photo page, and the visa page if it is in your passport." },
    {
      kind: "residence_permit",
      label: "Biometric residence permit or card",
      hint: "A BRP or BRC. The side with your photo.",
    },
    { kind: "visa", label: "Visa or work permit", hint: "The page showing what you are permitted to do." },
  ],
};

export function documentsFor(basis: Basis): DocumentChoice[] {
  return DOCUMENTS[basis];
}

export function labelFor(basis: Basis, kind: string): string {
  return documentsFor(basis).find((d) => d.kind === kind)?.label ?? "Document";
}

/**
 * Whether a Home Office share code is needed as well as the document.
 *
 * A British or Irish passport proves an unlimited right to work by itself --
 * the online check exists for people whose status is held digitally, which
 * theirs is not. Everyone else gives one.
 */
export function shareCodeRequired(basis: Basis): boolean {
  return basis !== "british";
}

/**
 * Whether the National Insurance number already given needs to be pointed at.
 *
 * A birth certificate is not proof of the right to work on its own; it is
 * proof paired with something showing a National Insurance number. The driver
 * has already given theirs on the personal details step, so this is a note
 * rather than another question -- asking twice for something already held is
 * how a form gets a reputation.
 */
export function usesNationalInsurance(basis: Basis, kind: string): boolean {
  return basis === "british" && kind === "birth_certificate";
}

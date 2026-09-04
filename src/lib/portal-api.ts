import { supabase } from "@/lib/supabase";

// Talking to the MiDrive portal.
//
// Everything else in this app goes straight to Supabase. This does not, and
// the reason is narrow: reading a licence photo needs a vision model, a vision
// model needs an API key, and an API key in a phone app is a published API key.
// So the photo goes to the portal, which holds the key, and the reading comes
// back.
//
// The session token goes in an Authorization header because this app has no
// cookies -- Expo keeps its session in the device's own storage. The portal
// verifies that token with the auth server rather than decoding it.
//
// Deliberately optional. If EXPO_PUBLIC_PORTAL_URL is not set, or the portal
// cannot be reached, nothing breaks: the caller gets `unavailable` and the
// screen asks the driver to type the details in, which is what it would have
// done anyway before any of this existed. Onboarding must not depend on a
// second deployment being up.

const BASE = process.env.EXPO_PUBLIC_PORTAL_URL?.replace(/\/$/, "") ?? "";

export type PortalResult<T> =
  | { ok: true; value: T }
  | { ok: false; unavailable: true; error: string }
  | { ok: false; unavailable: false; error: string };

const unavailable = (error: string) => ({ ok: false as const, unavailable: true as const, error });

/** Long enough for a vision model that thinks, or a long document to be rendered. */
const TIMEOUT_MS = 60000;

/** The session token, or nothing when there is no session to speak of. */
async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function portalGet<T>(path: string): Promise<PortalResult<T>> {
  if (!BASE) return unavailable("No portal is configured for this build.");

  const token = await bearer();
  if (!token) return unavailable("Not signed in.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : "That did not work.";
      return response.status >= 500
        ? unavailable(message)
        : { ok: false, unavailable: false, error: message };
    }

    return { ok: true, value: payload as T };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "The portal could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
export async function portalPost<T>(path: string, body: unknown): Promise<PortalResult<T>> {
  if (!BASE) return unavailable("No portal is configured for this build.");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return unavailable("Not signed in.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : "That did not work.";
      // The portal says when a failure is its own rather than the caller's --
      // a vision model being down is not a badly framed photograph, and the
      // screen must not tell the driver to retake one that was fine.
      return payload.unavailable === true || response.status >= 500
        ? unavailable(message)
        : { ok: false, unavailable: false, error: message };
    }

    return { ok: true, value: payload as T };
  } catch (error) {
    // Timed out, offline, or no portal at that address. All the same to the
    // driver: do it by hand.
    return unavailable(error instanceof Error ? error.message : "The portal could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

export type Reading = {
  document_number: string | null;
  expires_on: string | null;
  legible: boolean;
  note: string | null;
};

export async function readDocumentPhoto(
  kind: "drivers_licence" | "passport" | "brp" | "other",
  image: { mediaType: string; data: string }
): Promise<PortalResult<{ reading: Reading }>> {
  return portalPost<{ reading: Reading }>("/api/driver/extract-document", {
    kind,
    mediaType: image.mediaType,
    data: image.data,
  });
}

// The company documents, and the steps of signing one.
//
// These go through the portal rather than straight to the database, and that
// is not a convenience: signing renders the PDF that is the document of
// record, stamps it with server time, and re-checks that the company is still
// configured to issue it. An app that wrote the row itself would produce a
// signature with no document behind it.

export type DocumentSummary = {
  template_id: string;
  key: string;
  title: string;
  version: number;
  requires_signature: boolean;
  blocked: string | null;
  stage: string;
  signed_at: string | null;
};

export type DocumentContent = {
  template_id: string;
  title: string;
  version: number;
  requires_signature: boolean;
  declaration: string | null;
  blocks: { type: string; [key: string]: unknown }[];
};

export async function listDocuments() {
  return portalGet<{ documents: DocumentSummary[] }>("/api/driver/documents");
}

export async function readDocument(templateId: string) {
  return portalGet<{ document: DocumentContent }>(`/api/driver/documents/${templateId}/content`);
}

export async function documentAction(templateId: string, action: string, extra: Record<string, unknown> = {}) {
  return portalPost<{ submission: unknown }>(`/api/driver/documents/${templateId}`, { action, ...extra });
}
// Finding an address from a postcode.
//
// The list of door numbers at a postcode is Royal Mail data and licensed, so
// whether one comes back depends on what the portal has been given a key for.
// Without one the postcode is still checked and the town still suggested,
// which is most of the typing saved; with one the driver picks a line and
// types nothing at all.

export type PickableAddress = {
  line1: string;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string;

  // The parts, where the provider gave them. Null throughout for an address
  // from anywhere else.
  buildingNumber: string | null;
  buildingName: string | null;
  street: string | null;

  /** The whole thing on one line, for the list the driver picks from. */
  label: string;
};

export type PostcodeLookup = {
  postcode: string;
  city: string | null;
  county: string | null;
  addresses: PickableAddress[];
  /** False means the postcode is real but nobody told us what is on the street. */
  hasAddresses: boolean;
};

export async function lookupPostcode(postcode: string) {
  return portalPost<{ lookup: PostcodeLookup }>("/api/driver/postcode", { postcode });
}

/**
 * Addresses matching what has been typed so far.
 *
 * Free and keyless behind the portal -- OpenStreetMap rather than Royal Mail --
 * so coverage is good rather than complete. An empty list is an ordinary
 * answer, not a failure, and the form stays typeable either way.
 */
export async function searchAddresses(query: string) {
  return portalPost<{ addresses: PickableAddress[] }>("/api/driver/address-search", { query });
}

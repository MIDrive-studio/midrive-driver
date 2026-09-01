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

/** Long enough for a vision model that thinks, short enough that nobody wonders. */
const TIMEOUT_MS = 30000;

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

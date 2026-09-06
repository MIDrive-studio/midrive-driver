/**
 * The message an Edge Function actually sent, rather than the one the client
 * library made up.
 *
 * supabase-js turns any non-2xx from a function into a FunctionsHttpError whose
 * `message` is the fixed string "Edge Function returned a non-2xx status code".
 * The reason the function gave -- "capacity filled", "that request has closed",
 * whatever it was -- is in the response body, which is thrown away unless
 * something reads it.
 *
 * So a driver tapping Submit and being turned down was being shown a sentence
 * about HTTP status codes instead of the sentence the server wrote for them.
 */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown })?.context;

  // A Response, when the function replied and the reply was not 2xx.
  if (context instanceof Response) {
    try {
      const body = await context.clone().text();
      if (body) {
        try {
          const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
          const stated = parsed.error ?? parsed.message;
          if (typeof stated === "string" && stated.trim()) return stated;
        } catch {
          // Not JSON. Plain text is still better than the status-code sentence,
          // as long as it is short enough to be a message rather than a page.
          const text = body.trim();
          if (text && text.length <= 300 && !text.startsWith("<")) return text;
        }
      }
    } catch {
      // The body could not be read. Fall through.
    }
  }

  // No reply at all -- no signal in the yard, the function is not deployed --
  // in which case the client's own message is the honest one.
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim() && !message.includes("non-2xx")
    ? message
    : fallback;
}

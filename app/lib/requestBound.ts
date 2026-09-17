/**
 * Bounded request-body helpers for private API routes.
 *
 * BETA-07: every private route reads the request body through a hard byte cap
 * and parses it defensively so malformed or oversized payloads are rejected
 * with a stable 4xx before any processing. This mirrors the universe payload
 * guard in `lib/universeSchema.ts` (BETA-05) and keeps chat/title/export/
 * onboarding/extraction/upload/video-analysis from buffering unbounded input.
 */

/** Hard body cap. 5 MiB is generous for structured JSON / base64 text uploads
 *  while still bounding memory usage on the server. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Read a Request body as text, refusing to buffer beyond `max` bytes.
 *
 * Overreads a single chunk so a stream that starts within the limit but
 * exceeds it later is still rejected. The guard is a hard byte cap, so a
 * chunked transfer (no Content-Length) cannot bypass it. Returns null when
 * the body exceeds the cap, and the decoded text otherwise ('' for an empty
 * body so the downstream JSON parse can decide).
 */
export async function readBodyWithLimit(
  req: Request,
  max: number = MAX_BODY_BYTES
): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) {
    return '';
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

/**
 * Parse a bounded JSON request body into an object. Returns `{ ok: true,
 * body }` on success, or a stable 4xx error object on oversize / malformed /
 * non-object JSON so callers avoid duplicating the guard.
 */
export async function parseBoundedJson(
  req: Request,
  max: number = MAX_BODY_BYTES
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const text = await readBodyWithLimit(req, max);
  if (text === null) {
    return { ok: false, status: 413, error: 'Request body too large' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'Malformed JSON body' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object' };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}
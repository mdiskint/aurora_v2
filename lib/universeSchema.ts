/**
 * Bounded validation for universe cloud payloads.
 *
 * BETA-05: rejects malformed and oversized universes deterministically before
 * they reach the database. The client-generated universe id (`clientId`) is
 * validated as a bounded, safe identifier. The `data` blob is validated for
 * shape and size so a malicious or buggy client cannot persist garbage or
 * exhaust server memory.
 */

/** Maximum serialized universe payload size in bytes (5 MiB). */
export const UNIVERSE_MAX_BYTES = 5 * 1024 * 1024;

/** Maximum length of a client-generated universe id. */
export const CLIENT_ID_MAX_LENGTH = 128;

/** Safe identifier pattern: starts alphanumeric, then word chars and hyphens. */
const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface UniversePayload {
  clientId: string;
  data: unknown;
  videoUrl?: string | null;
  lastModified?: number;
  /** Optimistic-concurrency token echoed from the server. Optional for
   *  legacy/fresh clients; when present it must be a non-negative integer. */
  version?: number;
}

export interface UniverseValidationResult {
  ok: boolean;
  error?: string;
  payload?: UniversePayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a client-supplied universe id. Returns an error string or null.
 */
export function validateClientId(clientId: unknown): string | null {
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return 'clientId must be a non-empty string';
  }
  if (clientId.length > CLIENT_ID_MAX_LENGTH) {
    return `clientId exceeds ${CLIENT_ID_MAX_LENGTH} characters`;
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return 'clientId contains unsupported characters';
  }
  return null;
}

/**
 * Validate the `data` universe blob. Returns an error string or null.
 *
 * We validate a bounded structural subset rather than the full graph so the
 * check stays cheap and forward-compatible: `title` must be a bounded string,
 * `nexuses` must be an array, and `nodes` must be a plain object. Deeper
 * shape is enforced by the client's own type system.
 */
export function validateUniverseData(data: unknown): string | null {
  if (!isRecord(data)) {
    return 'data must be a JSON object';
  }
  if (typeof data.title !== 'string' || data.title.length > 200) {
    return 'data.title must be a string of at most 200 characters';
  }
  if (!Array.isArray(data.nexuses)) {
    return 'data.nexuses must be an array';
  }
  if (data.nexuses.length > 1000) {
    return 'data.nexuses exceeds 1000 entries';
  }
  if (!isRecord(data.nodes)) {
    return 'data.nodes must be an object';
  }
  const nodeCount = Object.keys(data.nodes).length;
  if (nodeCount > 100_000) {
    return 'data.nodes exceeds 100000 entries';
  }
  return null;
}

/**
 * Validate a parsed universe cloud payload. On success returns the normalized
 * payload (with optional fields defaulted to null/undefined).
 */
export function validateUniversePayload(body: unknown): UniverseValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const clientIdError = validateClientId(body.clientId);
  if (clientIdError) {
    return { ok: false, error: clientIdError };
  }

  const dataError = validateUniverseData(body.data);
  if (dataError) {
    return { ok: false, error: dataError };
  }

  const payload: UniversePayload = {
    clientId: body.clientId as string,
    data: body.data,
    videoUrl: typeof body.videoUrl === 'string' ? body.videoUrl : null,
    lastModified: typeof body.lastModified === 'number' ? body.lastModified : undefined,
    version: typeof body.version === 'number' ? body.version : undefined,
  };

  // If a version is supplied, it must be a non-negative integer. This keeps
  // the optimistic-concurrency token bounded and deterministic (no floats,
  // negatives, or NaN).
  if (payload.version !== undefined) {
    if (!Number.isInteger(payload.version) || payload.version < 0) {
      return { ok: false, error: 'version must be a non-negative integer' };
    }
  }

  return { ok: true, payload };
}

/**
 * Serialize-then-size check for a universe payload. Returns true when the
 * serialized payload stays within {@link UNIVERSE_MAX_BYTES}.
 */
export function isPayloadWithinLimit(body: unknown): boolean {
  try {
    return JSON.stringify(body).length <= UNIVERSE_MAX_BYTES;
  } catch {
    return false;
  }
}

/**
 * Optimistic-concurrency conflict decision.
 *
 * A write conflicts (true) only when the client submits a version STRICTLY
 * older than the server's recorded version. A missing submitted version
 * (legacy/fresh client) or a missing recorded version never conflicts, so a
 * clock-skew artifact cannot produce a false 409. Extracted as a pure helper
 * from the POST route so the BETA-10 security harness can test the decision.
 */
export function shouldRejectVersionConflict(
  submittedVersion: number | undefined,
  existingVersion: number | undefined
): boolean {
  if (submittedVersion === undefined || existingVersion === undefined) {
    return false;
  }
  return submittedVersion < existingVersion;
}
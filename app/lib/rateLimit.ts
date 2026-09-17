/**
 * Durable distributed rate limiter backed by Upstash Redis REST.
 *
 * DEC-03: Upstash Redis via REST (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN) is the selected durable limiter for the private
 * beta. REST is used (not TCP) because it is Vercel-compatible and needs no
 * TCP host; Express app/server is excluded from private-beta production and
 * does not run the limiter.
 *
 * Failure policy: DENY-CLOSED. On any limiter error or missing config the
 * guarded request is denied (not let through), so a failing limiter never
 * opens expensive or abuse-prone paths (public signup, AI, upload, parser).
 * See DEC-03 / BETA-09.
 *
 * Implementation: fixed-window counting is done atomically in Lua (EVAL):
 * INCR the namespace key, set a TTL on first increment, and return allowed +
 * current count + remaining TTL in a single round trip. Low volume by design
 * (small private beta); each guarded request issues at most one counter op.
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remainingWindowSeconds: number;
  /** True when the denial came from a limiter error / missing config. */
  denyClosed: boolean;
}

/**
 * Lua fixed-window counter script. Exported for request-body unit tests.
 *
 * Upstash REST command format (verified live): POST the base REST URL (no
 * `/eval` suffix) with a JSON array body `["EVAL", <script>, <numkeys>,
 * <key>, <arg1>, <arg2>]`. Response is `{ result: [allowed, count, ttl] }`.
 */
export const EVAL_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
end
local ttl = redis.call('TTL', key)
if ttl < 0 then ttl = window end
if current > limit then
  return {0, current, ttl}
end
return {1, current, ttl}
`;

/**
 * Build the Upstash REST POST body for the fixed-window counter.
 *
 * Upstash REST takes a JSON array command, not the `{script, keys, argv}`
 * object form. Exported for unit testing the request body shape.
 */
export function buildEvalBody(
  key: string,
  limit: number,
  windowSeconds: number
): string {
  return JSON.stringify([
    'EVAL',
    EVAL_SCRIPT,
    '1',
    key,
    String(limit),
    String(windowSeconds),
  ]);
}

/**
 * Atomically increment a fixed-window counter and decide allow/deny.
 *
 * Returns `denyClosed: true` (and `allowed: false`) on any limiter failure so
 * callers can respond denyl-closed per DEC-03.
 */
export async function evalRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Read the Upstash REST config at call time (not module load) so the
  // deny-closed behavior from missing config and from a limiter error can be
  // exercised in tests without a live token or network.
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !restToken) {
    return {
      allowed: false,
      count: 0,
      remainingWindowSeconds: windowSeconds,
      denyClosed: true,
    };
  }
  try {
    const res = await fetch(`${restUrl.replace(/\/$/, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restToken}`,
        'Content-Type': 'application/json',
      },
      body: buildEvalBody(key, limit, windowSeconds),
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        allowed: false,
        count: 0,
        remainingWindowSeconds: windowSeconds,
        denyClosed: true,
      };
    }
    const data = await res.json();
    const result = data?.result;
    if (!Array.isArray(result) || result.length < 3) {
      return {
        allowed: false,
        count: 0,
        remainingWindowSeconds: windowSeconds,
        denyClosed: true,
      };
    }
    // result = [allowed, count, ttl]
    return {
      allowed: Number(result[0]) === 1,
      count: Number(result[1]),
      remainingWindowSeconds: Number(result[2]),
      denyClosed: false,
    };
  } catch {
    return {
      allowed: false,
      count: 0,
      remainingWindowSeconds: windowSeconds,
      denyClosed: true,
    };
  }
}

/**
 * Best-effort client IP for rate-limit keying. Vercel populates
 * `x-forwarded-for` for serverless route handlers; falls back to the request's
 * `ip` where present. Returns 'unknown' when neither is available so the
 * limiter still keys (and counts) rather than opening an unkeyed path.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const maybeIp = (request as { ip?: string }).ip;
  if (maybeIp) return maybeIp;
  return 'unknown';
}
/**
 * Durable distributed rate limiter backed by Upstash Redis REST (web copy).
 *
 * DEC-03 / BETA-09: the marketing-site beta-signup endpoint shares the same
 * Upstash Redis REST limiter as the app. Restrictive by default: mission here
 * is only the public per-IP signup guard, so this module stays smaller than
 * the app's `lib/rateLimit.ts`.
 *
 * Failure policy: DENY-CLOSED. On any limiter error or missing config the
 * guarded request is denied (not let through) so a failing limiter never opens
 * the public signup path to abuse. See DEC-03 / BETA-09.
 *
 * Implementation: fixed-window counting atomically in Lua (EVAL): INCR the
 * namespace key, set a TTL on first increment, return allowed + current count
 * + remaining TTL in one round trip. Low volume by design (small private
 * beta); each guarded request issues at most one counter op.
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remainingWindowSeconds: number;
  /** True when the denial came from a limiter error / missing config. */
  denyClosed: boolean;
}

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
 * callers can respond deny-closed per DEC-03.
 */
export async function evalRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!REST_URL || !REST_TOKEN) {
    return {
      allowed: false,
      count: 0,
      remainingWindowSeconds: windowSeconds,
      denyClosed: true,
    };
  }
  try {
    const res = await fetch(`${REST_URL.replace(/\/$/, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
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
 * `x-forwarded-for` for the marketing site too; falls back to the request's
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
/**
 * Unit tests for the Upstash Redis REST rate limiter request body builder.
 *
 * BETA-09 P1 fix: the broken `{script, keys, argv}` object body to
 * `POST {REST_URL}/eval` returns 400 from Upstash. The verified-working
 * format is a JSON array command posted to the base REST URL (no `/eval`):
 *   ["EVAL", <script>, "1", <key>, <limit>, <windowSeconds>]
 * Response is `{ result: [allowed, count, ttl] }`.
 *
 * These tests assert the exact body shape and URL we ship, without needing a
 * live token (deny-closed path is unchanged and covered by the module).
 *
 * Run with: npx tsx lib/__tests__/rateLimit.test.ts
 */

import { buildEvalBody, EVAL_SCRIPT, evalRateLimit } from '../rateLimit';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

test('buildEvalBody emits Upstash array command shape', () => {
  const body = buildEvalBody('rl:signup:ip:1.2.3.4', 10, 3600);
  const parsed = JSON.parse(body) as unknown[];

  assertEqual(parsed.length, 6, 'array length');
  assertEqual(parsed[0], 'EVAL', 'command verb');
  assertEqual(parsed[1], EVAL_SCRIPT, 'script element matches EVAL_SCRIPT');
  assertEqual(parsed[2], '1', 'numkeys as string "1"');
  assertEqual(parsed[3], 'rl:signup:ip:1.2.3.4', 'key');
  assertEqual(parsed[4], '10', 'limit as string');
  assertEqual(parsed[5], '3600', 'window as string');
});

test('buildEvalBody casts numeric limit/window to strings', () => {
  const parsed = JSON.parse(buildEvalBody('rl:x', 3, 60)) as unknown[];
  assertEqual(parsed[4], '3', 'limit');
  assertEqual(parsed[5], '60', 'window');
});

test('EVAL_SCRIPT performs atomic INCR + EXPIRE-on-first + TTL', () => {
  assert(EVAL_SCRIPT.includes("redis.call('INCR'"), 'script uses INCR');
  assert(EVAL_SCRIPT.includes("redis.call('EXPIRE'"), 'script uses EXPIRE');
  assert(EVAL_SCRIPT.includes("redis.call('TTL'"), 'script uses TTL');
  assert(EVAL_SCRIPT.includes('return {0, current, ttl}'), 'deny return shape');
  assert(EVAL_SCRIPT.includes('return {1, current, ttl}'), 'allow return shape');
});

// ============================================
// Deny-closed behavior (BETA-10). Mock global.fetch; no network / token.
// evalfRateLimit reads UPSTASH_* at call time, so each case sets env inline.
// ============================================

const SAVED_FETCH = globalThis.fetch;
const SAVED_URL = process.env.UPSTASH_REDIS_REST_URL;
const SAVED_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function withEnv<R>(url: string | undefined, token: string | undefined, fn: () => Promise<R>): Promise<R> {
  if (url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = url;
  if (token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = token;
  try {
    return await fn();
  } finally {
    if (SAVED_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = SAVED_URL;
    if (SAVED_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = SAVED_TOKEN;
  }
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): void {
  globalThis.fetch = impl as typeof fetch;
}

async function testDenyClosedMissingConfig(): Promise<void> {
  await withEnv(undefined, undefined, async () => {
    const r = await evalRateLimit('rl:signup:ip:1.2.3.4', 10, 3600);
    assert(r.allowed === false, 'missing config denies');
    assert(r.denyClosed === true, 'missing config is deny-closed');
  });
  console.log('  ✓ Missing config -> deny-closed');
}

async function testDenyClosedFetchError(): Promise<void> {
  await withEnv('https://mock.upstash.io', 'token', async () => {
    mockFetch(async () => { throw new Error('network down'); });
    const r = await evalRateLimit('rl:chat:user:u1', 100, 86400);
    assert(r.allowed === false, 'fetch error denies');
    assert(r.denyClosed === true, 'fetch error is deny-closed');
  });
  console.log('  ✓ Fetch error -> deny-closed');
}

async function testDenyClosedHttpError(): Promise<void> {
  await withEnv('https://mock.upstash.io', 'token', async () => {
    mockFetch(async () => new Response('oops', { status: 500 }));
    const r = await evalRateLimit('rl:chat:user:u1', 100, 86400);
    assert(r.allowed === false, 'non-2xx denies');
    assert(r.denyClosed === true, 'non-2xx is deny-closed');
  });
  console.log('  ✓ HTTP error -> deny-closed');
}

async function testDenyClosedMalformedResult(): Promise<void> {
  await withEnv('https://mock.upstash.io', 'token', async () => {
    mockFetch(async () => new Response(JSON.stringify({ result: 'nope' }), { status: 200 }));
    const r = await evalRateLimit('rl:chat:user:u1', 100, 86400);
    assert(r.allowed === false, 'malformed result denies');
    assert(r.denyClosed === true, 'malformed result is deny-closed');
  });
  console.log('  ✓ Malformed result -> deny-closed');
}

async function testAllowPath(): Promise<void> {
  await withEnv('https://mock.upstash.io', 'token', async () => {
    mockFetch(async () => new Response(JSON.stringify({ result: [1, 3, 3600] }), { status: 200 }));
    const r = await evalRateLimit('rl:signup:ip:1.2.3.4', 10, 3600);
    assert(r.allowed === true, 'allow result allows');
    assert(r.denyClosed === false, 'allow result not deny-closed');
    assert(r.count === 3, 'count parsed');
    assert(r.remainingWindowSeconds === 3600, 'ttl parsed');
  });
  console.log('  ✓ Allow path returned');
}

async function testLimitExceeded(): Promise<void> {
  await withEnv('https://mock.upstash.io', 'token', async () => {
    mockFetch(async () => new Response(JSON.stringify({ result: [0, 11, 100] }), { status: 200 }));
    const r = await evalRateLimit('rl:extract:user:u1', 10, 86400);
    assert(r.allowed === false, 'count over limit denies');
    assert(r.denyClosed === false, 'over-limit is a normal 429, not deny-closed');
  });
  console.log('  ✓ Over-limit -> denied (429), not deny-closed');
}

async function main(): Promise<void> {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ['denyClosedMissingConfig', testDenyClosedMissingConfig],
    ['denyClosedFetchError', testDenyClosedFetchError],
    ['denyClosedHttpError', testDenyClosedHttpError],
    ['denyClosedMalformedResult', testDenyClosedMalformedResult],
    ['allowPath', testAllowPath],
    ['limitExceeded', testLimitExceeded],
  ];

  let failures = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${name}: ${(err as Error).message}`);
    }
  }

  // Restore the real fetch so we never leak the mock into CI.
  globalThis.fetch = SAVED_FETCH;

  if (failures > 0) {
    console.error(`${failures} rate-limit deny-closed test group(s) failed`);
    process.exit(1);
  }
  console.log(`All ${tests.length} rate-limit deny-closed test groups passed`);
}

void main();
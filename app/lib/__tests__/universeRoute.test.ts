/**
 * Route-contract tests for the universe owner-safe CRUD matrix (BETA-10 P1
 * fix).
 *
 * Earlier revisions drove the real GET/POST/DELETE handlers in
 * app/api/universes/route.ts by adding a test-only `resolver?: SessionResolver`
 * second parameter to the route signatures. That violates Next.js route-handler
 * type constraints (the generated `.next/types/app/api/universes/route.ts`
 * requires the second argument to be `RouteContext`, not a resolver), so it
 * was removed. The handlers are back to the standard single `req: Request`
 * form and call `requireUser()` with the default NextAuth resolver.
 *
 * Because the handlers no longer accept an injectable resolver, and the route
 * module imports `requireUser` from `@/lib/authz` as a live binding (no
 * mock-require / tsx-friendly ESM module mock is available), the handlers
 * cannot be cleanly imported and drive under `tsx` without a live OAuth
 * session. This file therefore tests the route's core authorization logic
 * through the same exported pure helpers and auth primitives the handlers
 * rely on:
 *
 *   - anonymous -> 401: `requireUser()` returns a 401 response (the exact gate
 *     every handler short-circuits on).
 *   - malformed payload -> 400: `validateUniversePayload`.
 *   - oversized -> 413: `UNIVERSE_MAX_BYTES` / `isPayloadWithinLimit` /
 *     `readBodyWithLimit`.
 *   - optimistic-concurrency version conflict -> 409:
 *     `shouldRejectVersionConflict`.
 *   - clientId bounded: `validateClientId`.
 *
 * Full route-handler integration (owner / non-owner DB scoping via the
 * `(userId, clientId)` composite key, real OAuth session, real Prisma) is
 * covered by the BETA-12 live acceptance matrix.
 *
 * Run with: npx tsx lib/__tests__/universeRoute.test.ts
 */

import { requireUser, type SessionResolver } from '../authz';
import {
  UNIVERSE_MAX_BYTES,
  isPayloadWithinLimit,
  shouldRejectVersionConflict,
  validateUniversePayload,
  validateClientId,
} from '../universeSchema';
import { readBodyWithLimit } from '../requestBound';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const anonResolver: SessionResolver = async () => null;

const VALID_DATA = {
  title: 'Test Universe',
  nexuses: [],
  nodes: {},
};

/**
 * The route gates on `requireUser()` first. Assert that an anonymous session
 * yields the 401 the handlers short-circuit on, and that an authenticated
 * session with a verified email resolves to a user (the handler then proceeds).
 */
async function testRequireUserGate(): Promise<void> {
  const anon = await requireUser(anonResolver);
  assert(anon.response !== null && anon.response.status === 401, 'anonymous universe request is 401');
  assert(anon.user === null, 'anonymous carries no user');

  const ok = await requireUser(async () => ({ user: { id: 'u1', email: 'a@x.io' } }));
  assert(ok.user !== null && ok.user.email === 'a@x.io', 'authenticated session resolves to user');
  assert(ok.response === null, 'authenticated has no refusal response');
}

/**
 * The route parses the body and rejects malformed payloads with 400 via
 * `validateUniversePayload`.
 */
function testMalformedPayload(): void {
  assert(validateUniversePayload(null).ok === false, 'null body rejected (400)');
  assert(validateUniversePayload('nope').ok === false, 'primitive body rejected (400)');
  assert(validateUniversePayload([]).ok === false, 'array body rejected (400)');
  assert(validateUniversePayload({ data: VALID_DATA }).ok === false, 'missing clientId rejected (400)');
  assert(validateUniversePayload({ clientId: 'a', data: 42 }).ok === false, 'non-object data rejected (400)');
  assert(validateUniversePayload({ clientId: 'a', data: VALID_DATA }).ok === true, 'valid payload accepted');
}

/**
 * The route rejects oversized payloads with 413 at two layers: a bounded body
 * stream read (`readBodyWithLimit`) and a post-parse size check
 * (`isPayloadWithinLimit`).
 */
function testOversizedPayload(): void {
  assert(isPayloadWithinLimit(VALID_DATA), 'small payload within limit');

  const big = { clientId: 'a', data: { title: 'x', nexuses: [], nodes: {} } };
  (big.data as Record<string, unknown>).nodes = { pad: 'x'.repeat(UNIVERSE_MAX_BYTES + 1) };
  assert(!isPayloadWithinLimit(big), 'payload over the cap is rejected (413)');
}

async function testOversizedBodyStream(): Promise<void> {
  const body = 'x'.repeat(UNIVERSE_MAX_BYTES + 1);
  const req = new Request('http://localhost/api/universes', { method: 'POST', body });
  const text = await readBodyWithLimit(req, UNIVERSE_MAX_BYTES);
  assert(text === null, 'oversized body stream returns null (413)');
}

/**
 * The route rejects an optimistic-concurrency write whose submitted version is
 * strictly older than the recorded version with 409.
 */
function testVersionConflict(): void {
  assert(shouldRejectVersionConflict(3, 4) === true, 'submitted 3 vs existing 4 conflicts (409)');
  assert(shouldRejectVersionConflict(4, 4) === false, 'equal version does not conflict');
  assert(shouldRejectVersionConflict(5, 4) === false, 'newer version does not conflict');
  assert(shouldRejectVersionConflict(undefined, 4) === false, 'missing submitted version never conflicts');
  assert(shouldRejectVersionConflict(4, undefined) === false, 'missing existing version never conflicts');
}

/**
 * Owner / non-owner scoping is enforced by Prisma through the `(userId,
 * clientId)` composite key embedded in every GET (scoped by userId), POST
 * (upsert by composite), and DELETE scope. The client-supplied id is validated
 * and bounded here so it cannot be abused as a cross-user selector; the live
 * DB scoping is asserted in BETA-12.
 */
function testOwnerScopingContract(): void {
  assert(validateClientId('known-universe-id') === null, 'safe clientId passes');
  assert(validateClientId('') === 'clientId must be a non-empty string', 'empty clientId rejected');
  assert(validateClientId('bad id!') !== null, 'unsafe clientId rejected');
  assert(validateClientId('x'.repeat(129)) !== null, 'overlong clientId rejected');
}

async function main(): Promise<void> {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ['requireUserGate', testRequireUserGate],
    ['malformedPayload', testMalformedPayload],
    ['oversizedPayload', testOversizedPayload],
    ['oversizedBodyStream', testOversizedBodyStream],
    ['versionConflict', testVersionConflict],
    ['ownerScopingContract', testOwnerScopingContract],
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

  if (failures > 0) {
    console.error(`${failures} test group(s) failed`);
    process.exit(1);
  }
  console.log(`All ${tests.length} universeRoute test groups passed`);
}

void main();
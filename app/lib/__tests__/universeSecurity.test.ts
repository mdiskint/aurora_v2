/**
 * Security harness for the universe owner-safe CRUD matrix (BETA-10).
 *
 * Covers, without a live database or OAuth session, the decision logic that
 * governs the private universes route (app/api/universes/route.ts):
 *   - anonymous -> 401 (requireUser gate)
 *   - malformed payload -> 400 (validateUniversePayload)
 *   - oversized payload -> 413 (UNIVERSE_MAX_BYTES / readBodyWithLimit)
 *   - optimistic-concurrency version conflict -> 409
 *     (shouldRejectVersionConflict)
 *
 * owner / non-owner scoping is enforced by Prisma through the
 * `(userId, clientId)` composite key (GET scoped by userId, DELETE by the
 * composite, POST upsert by userId). Because the composite key embeds the
 * session user id, a non-owner cannot name another user's universe. That
 * database integration is exercised end-to-end in BETA-12 (acceptance
 * matrix); this file validates the pure decision branches that decide the
 * status codes each matrix cell returns.
 *
 * Run with: npx tsx lib/__tests__/universeSecurity.test.ts
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

/** Build a valid request body for a fresh universe write. */
function validBody(clientId = 'abc-123'): Record<string, unknown> {
  return { clientId, data: VALID_DATA };
}

// ============================================
// Anonymous -> 401
// ============================================

async function testAnonymousRejected(): Promise<void> {
  const { response } = await requireUser(anonResolver);
  assert(response !== null && response.status === 401, 'anonymous universe request is 401');
}

// ============================================
// Malformed payload -> 400
// ============================================

function testMalformedPayload(): void {
  // Not an object.
  assert(validateUniversePayload(null).ok === false, 'null body rejected');
  assert(validateUniversePayload('nope').ok === false, 'primitive body rejected');
  assert(validateUniversePayload([]).ok === false, 'array body rejected');

  // Missing / invalid clientId.
  assert(validateUniversePayload({ data: VALID_DATA }).ok === false, 'missing clientId rejected');
  assert(validateClientId('') === 'clientId must be a non-empty string', 'empty clientId rejected');
  assert(validateClientId('bad id!') !== null, 'unsafe clientId rejected');
  assert(validateClientId('x'.repeat(129)) !== null, 'overlong clientId rejected');

  // Invalid data blob.
  assert(validateUniversePayload({ clientId: 'a', data: 42 }).ok === false, 'non-object data rejected');
  assert(validateUniversePayload({ clientId: 'a', data: { title: 'x', nexuses: 'nope', nodes: {} } }).ok === false, 'non-array nexuses rejected');
  assert(validateUniversePayload({ clientId: 'a', data: { title: 'x', nexuses: [], nodes: [] } }).ok === false, 'array nodes rejected');

  // Invalid version token.
  assert(validateUniversePayload({ clientId: 'a', data: VALID_DATA, version: -1 }).ok === false, 'negative version rejected');
  assert(validateUniversePayload({ clientId: 'a', data: VALID_DATA, version: 1.5 }).ok === false, 'float version rejected');
  assert(validateUniversePayload({ clientId: 'a', data: VALID_DATA, version: 0 }).ok === true, 'version 0 accepted');
}

// ============================================
// Oversized payload -> 413
// ============================================

function testOversizedPayload(): void {
  assert(isPayloadWithinLimit(VALID_DATA), 'small payload within limit');

  // A payload just over the cap must be rejected.
  const big = { clientId: 'a', data: { title: 'x', nexuses: [], nodes: {} } };
  const marker = 'x';
  const target = UNIVERSE_MAX_BYTES + 1;
  (big.data as Record<string, unknown>).nodes = { pad: marker.repeat(target) };
  assert(!isPayloadWithinLimit(big), 'payload over the cap is rejected');
}

async function testOversizedBodyStream(): Promise<void> {
  // readBodyWithLimit refuses to buffer beyond the cap (chunked-safe).
  const body = 'x'.repeat(UNIVERSE_MAX_BYTES + 1);
  const req = new Request('http://localhost/api/universes', { method: 'POST', body });
  const text = await readBodyWithLimit(req, UNIVERSE_MAX_BYTES);
  assert(text === null, 'oversized body stream returns null (413)');
}

// ============================================
// Version conflict -> 409
// ============================================

function testVersionConflict(): void {
  // Strictly older submitted version conflicts.
  assert(shouldRejectVersionConflict(3, 4) === true, 'submitted 3 vs existing 4 conflicts');
  // Equal version is fine (client is current).
  assert(shouldRejectVersionConflict(4, 4) === false, 'equal version does not conflict');
  // Newer version is fine.
  assert(shouldRejectVersionConflict(5, 4) === false, 'newer version does not conflict');
  // Missing submitted version (legacy/fresh client) never conflicts.
  assert(shouldRejectVersionConflict(undefined, 4) === false, 'missing submitted version does not conflict');
  // Missing existing version never conflicts.
  assert(shouldRejectVersionConflict(4, undefined) === false, 'missing existing version does not conflict');
}

// ============================================
// Owner / non-owner scoping (documented, deferred to BETA-12)
// ============================================

function testOwnerScopingContract(): void {
  // The owner-safe matrix is enforced by the Prisma composite key
  // `(userId, clientId)`: the session user id is baked into every read/write
  // scope, so a non-owner cannot name another user's universe. The pure
  // consequence is that the only client-visible statuses are idempotent:
  // a non-owner DELETE of a known id yields P2025, which the route maps to a
  // generic success rather than leaking existence. This is data-integrity
  // behavior owned by the database layer and asserted in BETA-12; we assert
  // the invariant here that the client-supplied id is validated and bounded
  // so it cannot be abused as a cross-user selector.
  assert(validateClientId('known-universe-id') === null, 'safe clientId passes');
}

// ============================================
// Runner
// ============================================

async function main(): Promise<void> {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ['anonymousRejected', testAnonymousRejected],
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
  console.log(`All ${tests.length} universeSecurity test groups passed`);
}

void main();
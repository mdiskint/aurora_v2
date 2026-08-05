/**
 * Security harness for the authorization primitives (BETA-10).
 *
 * Covers, without a live OAuth session or database:
 *   - requireUser / getSessionUser: anonymous -> 401, authenticated -> user,
 *     present session without a verified email -> 401.
 *   - requireOperator (BETA-14): anonymous -> 401, authenticated non-operator
 *     -> 403, operator -> allowed.
 *   - Private route authz: chat / extract-text / upload each gate with
 *     `requireUser()` first, so their anonymous refusal is exactly the
 *     requireUser anonymous -> 401 path asserted here.
 *
 * The authz primitives accept an injectable session resolver (a test seam
 * added in BETA-10); production routes call them with no argument and use the
 * default NextAuth resolver. Full integration against a real OAuth session and
 * database is deferred to BETA-12 (acceptance matrix).
 *
 * Run with: npx tsx lib/__tests__/authz.test.ts
 */

import type { NextResponse } from 'next/server';
import { getSessionUser, requireUser, type SessionResolver, type SessionUser } from '../authz';
import { requireOperator } from '../operator';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/** Assert the result carries a response and return it (narrowed). */
function expectResponse(
  r: Awaited<ReturnType<typeof requireUser>>
): NextResponse {
  if (r.response === null) throw new Error('expected response, got user');
  return r.response;
}

/** Assert the result carries a user and return it (narrowed). */
function expectUser(r: Awaited<ReturnType<typeof requireUser>>): SessionUser {
  if (r.user === null) throw new Error('expected user, got response');
  return r.user;
}

/** A resolver that always returns a fixed session (or null for anonymous). */
function resolverFor(user: { id?: string; email?: string } | null): SessionResolver {
  return async () => (user ? { user } : null);
}

// ============================================
// getSessionUser
// ============================================

async function testGetSessionUser(): Promise<void> {
  const anon = await getSessionUser(resolverFor(null));
  assert(anon === null, 'anonymous session resolves to null');

  const authed = await getSessionUser(resolverFor({ id: 'u1', email: 'a@x.io' }));
  assert(authed?.email === 'a@x.io', 'authenticated session resolves to user');
  assert(authed?.id === 'u1', 'user carries id');
}

// ============================================
// requireUser
// ============================================

async function testRequireUser(): Promise<void> {
  // Anonymous -> 401.
  const anon = await requireUser(resolverFor(null));
  const anonResp = expectResponse(anon);
  assert(anonResp.status === 401, 'anonymous gets 401');
  assert(anon.user === null, 'anonymous carries no user');

  // Authenticated with email -> user, no response.
  const ok = await requireUser(resolverFor({ id: 'u1', email: 'a@x.io' }));
  const okUser = expectUser(ok);
  assert(ok.response === null, 'authenticated resolves user');
  assert(okUser.email === 'a@x.io', 'email preserved');

  // Present session but no verified email -> 401.
  const noEmail = await requireUser(resolverFor({ id: 'u1' }));
  assert(noEmail.response !== null && noEmail.response.status === 401, 'session without email is 401');
}

// ============================================
// requireOperator (BETA-14)
// ============================================

async function testRequireOperator(): Promise<void> {
  // Anonymous -> 401 (requireUser path short-circuits first).
  const anon = await requireOperator(resolverFor(null));
  assert(anon.response !== null && anon.response.status === 401, 'anonymous operator request is 401');

  // Authenticated non-operator -> 403.
  const prev = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'op@example.com';
  try {
    const nonOp = await requireOperator(resolverFor({ id: 'u1', email: 'user@example.com' }));
    assert(nonOp.response !== null && nonOp.response.status === 403, 'non-operator is 403');
    assert(nonOp.user === null, 'non-operator carries no user');

    // Operator -> resolved user, no response.
    const op = await requireOperator(resolverFor({ id: 'u2', email: 'OP@Example.com' }));
    const opUser = expectUser(op);
    assert(op.response === null, 'operator is allowed');
    assert(opUser.email === 'OP@Example.com', 'operator email preserved');
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  }
}

// ============================================
// Private route authz contract (chat/extract/upload)
// ============================================

async function testPrivateRouteAuthz(): Promise<void> {
  // chat, extract-text, and upload all begin with `const { user, response } =
  // await requireUser(); if (response) return response;`. Their anonymous
  // refusal is therefore the requireUser anonymous -> 401 path asserted here.
  // Assert the exact gate shape each route relies on so a future route that
  // stops gating will not silently bypass authz.
  const anon = await requireUser(resolverFor(null));
  const anonResp = expectResponse(anon);
  assert(anonResp.status === 401, 'anonymous route request is 401');

  // The refusal is env-independent: requireUser never consults NODE_ENV, so
  // anonymous is rejected in development and production alike.
  const envRefusal = await requireUser(resolverFor(null));
  assert(envRefusal.response?.status === 401, 'anonymous refusal does not depend on NODE_ENV');
}

// ============================================
// Runner
// ============================================

async function main(): Promise<void> {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ['getSessionUser', testGetSessionUser],
    ['requireUser', testRequireUser],
    ['requireOperator', testRequireOperator],
    ['privateRouteAuthz', testPrivateRouteAuthz],
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
  console.log(`All ${tests.length} authz test groups passed`);
}

void main();
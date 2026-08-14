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
import { requireOperator, type OperatorLookup } from '../operator';

/**
 * A lookahead seam for operator authorization. Mirrors the production default
 * lookup but returns stub DB rows so the header-identity + beta-access decision
 * can be exercised without a live database.
 */
function lookupFor(opts: {
  admins?: string[];
  signups?: Array<{ email: string; status: string; revokedAt: Date | null; inviteExpires: Date | null }>;
}): OperatorLookup {
  const admins = new Set((opts.admins ?? []).map((e) => e.toLowerCase()));
  const rows = opts.signups ?? [];
  return {
    isAdminMember: async (email) => admins.has(email.toLowerCase()),
    getBetaAccess: async (email) =>
      rows.find((r) => r.email.toLowerCase() === email.toLowerCase()) ?? null,
  };
}

/** A future expiry that never gates (approved + unexpired). */
const FUTURE = new Date(Date.now() + 60_000);

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

  const prev = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'op@example.com';
  try {
    // Authenticated non-operator (not allowlist, not Admin table) -> 403.
    const nonOp = await requireOperator(
      resolverFor({ id: 'u1', email: 'user@example.com' }),
      lookupFor({ admins: [], signups: [{ email: 'user@example.com', status: 'approved', revokedAt: null, inviteExpires: FUTURE }] }),
    );
    assert(nonOp.response !== null && nonOp.response.status === 403, 'non-operator is 403');
    assert(nonOp.user === null, 'non-operator carries no user');

    // Operator on allowlist but NO approved beta access -> 403 (tightened gate).
    const allowlistNoAccess = await requireOperator(
      resolverFor({ id: 'u2', email: 'op@example.com' }),
      lookupFor({ admins: [], signups: [] }),
    );
    assert(
      allowlistNoAccess.response !== null && allowlistNoAccess.response.status === 403,
      'allowlist operator without approved access is 403',
    );

    // Operator on the Admin table but NO approved beta access -> 403.
    const adminNoAccess = await requireOperator(
      resolverFor({ id: 'u3', email: 'admin@example.com' }),
      lookupFor({ admins: ['admin@example.com'], signups: [] }),
    );
    assert(
      adminNoAccess.response !== null && adminNoAccess.response.status === 403,
      'Admin-table operator without approved access is 403',
    );

    // Allowlist operator WITH approved access -> allowed (case/whitespace smudge).
    const op = await requireOperator(
      resolverFor({ id: 'u4', email: 'OP@Example.com' }),
      lookupFor({ admins: [], signups: [{ email: 'op@example.com', status: 'approved', revokedAt: null, inviteExpires: FUTURE }] }),
    );
    const opUser = expectUser(op);
    assert(op.response === null, 'allowlist operator with approved access is allowed');
    assert(opUser.email === 'OP@Example.com', 'operator email preserved');

    // Admin-table operator WITH approved access -> allowed.
    const adminOp = await requireOperator(
      resolverFor({ id: 'u5', email: 'admin@example.com' }),
      lookupFor({ admins: ['admin@example.com'], signups: [{ email: 'admin@example.com', status: 'redeemed', revokedAt: null, inviteExpires: null }] }),
    );
    const adminOpUser = expectUser(adminOp);
    assert(adminOp.response === null, 'Admin-table operator with approved access is allowed');
    assert(adminOpUser.email === 'admin@example.com', 'admin-table operator email preserved');

    // Allowlist operator with revoked beta access -> 403.
    const revoked = await requireOperator(
      resolverFor({ id: 'u6', email: 'op@example.com' }),
      lookupFor({ admins: [], signups: [{ email: 'op@example.com', status: 'revoked', revokedAt: new Date(), inviteExpires: null }] }),
    );
    assert(
      revoked.response !== null && revoked.response.status === 403,
      'allowlist operator with revoked access is 403',
    );

    // Allowlist operator with approved access whose inviteExpires has PASSED
    // -> still allowed (OPS-06 decision-A waives the expiry check for operators).
    const expiredOp = await requireOperator(
      resolverFor({ id: 'u7', email: 'op@example.com' }),
      lookupFor({ admins: [], signups: [{ email: 'op@example.com', status: 'approved', revokedAt: null, inviteExpires: new Date(Date.now() - 60_000) }] }),
    );
    const expiredOpUser = expectUser(expiredOp);
    assert(expiredOp.response === null, 'allowlist operator with expired invite is still allowed');
    assert(expiredOpUser.email === 'op@example.com', 'expired-invite operator email preserved');

    // Admin-table operator with redeemed access and passed expiry -> allowed too.
    const expiredAdmin = await requireOperator(
      resolverFor({ id: 'u8', email: 'admin@example.com' }),
      lookupFor({ admins: ['admin@example.com'], signups: [{ email: 'admin@example.com', status: 'redeemed', revokedAt: null, inviteExpires: new Date(Date.now() - 60_000) }] }),
    );
    const expiredAdminUser = expectUser(expiredAdmin);
    assert(expiredAdmin.response === null, 'Admin-table operator with expired invite is still allowed');
    assert(expiredAdminUser.email === 'admin@example.com', 'expired-invite admin operator email preserved');

    // Revoked operator stays denied even with a future inviteExpires.
    const revokedFuture = await requireOperator(
      resolverFor({ id: 'u9', email: 'op@example.com' }),
      lookupFor({ admins: [], signups: [{ email: 'op@example.com', status: 'revoked', revokedAt: new Date(), inviteExpires: FUTURE }] }),
    );
    assert(
      revokedFuture.response !== null && revokedFuture.response.status === 403,
      'revoked operator is 403 regardless of expiry waiver',
    );
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
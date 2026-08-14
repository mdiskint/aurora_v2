/**
 * Unit tests for BETA-14 beta operator lifecycle logic (lib/betaAdmin.ts) and
 * operator authorization (lib/operator.ts).
 *
 * Covers the security-critical pure logic without a database or email provider:
 *   - approve pending -> approved (only hash of the invite token is stored)
 *   - revoke strips access immediately (isBetaAccessGranted returns false)
 *   - re-invite invalidates the prior invitation and re-grants a revoked user
 *   - operator allowlist membership
 *
 * Run with: npx tsx lib/__tests__/betaAdmin.test.ts
 */

import { isBetaAccessGranted, BETA_SIGNUP_STATUS } from "../betaAccess";
import { isOperatorEmail } from "../operator";
import {
  BetaAdminTransitionError,
  buildInviteLink,
  computeInviteExpiry,
  computeTransitionDeltas,
  generateInviteToken,
  INVITE_TTL_MS,
} from "../betaAdmin";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

type SignupShape = {
  status: string;
  email: string;
  invitedEmail: string | null;
};

const NOW = new Date("2026-08-04T00:00:00Z");

const row = (over: Partial<SignupShape>): SignupShape => ({
  status: BETA_SIGNUP_STATUS.PENDING,
  email: "applicant@example.com",
  invitedEmail: "applicant@example.com",
  ...over,
});

// ============================================
// Invite token helpers
// ============================================

function testInviteHelpers(): void {
  const token = generateInviteToken();
  assert(token.length === 64 && /^[a-f0-9]{64}$/.test(token), 'token is 32 random bytes hex');
  assert(generateInviteToken() !== token, 'tokens are unique');

  const expiry = computeInviteExpiry(NOW);
  assert(expiry.getTime() === NOW.getTime() + INVITE_TTL_MS, 'expiry is now + 72h');

  const link = buildInviteLink(token);
  assert(link.endsWith(`/join?token=${token}`), 'invite link embeds raw token for the invitee');
}

// ============================================
// Approve: pending -> approved
// ============================================

function testApprove(): void {
  const deltas = computeTransitionDeltas("approve", row({}), NOW);
  assert(deltas.emailToken !== null, 'approve issues a token to email');
  assert(deltas.data.status === "approved", 'status becomes approved');
  assert((deltas.data.approvedAt as Date).getTime() === NOW.getTime(), 'approvedAt set to now');
  assert(deltas.data.inviteExpires instanceof Date, 'inviteExpires set');
  assert(deltas.data.invitedEmail === "applicant@example.com", 'invite bound to applicant email');
  // Only the hash is stored, never the raw token.
  const raw = deltas.emailToken as string;
  const hashField = deltas.data.inviteTokenHash as string;
  assert(/^[a-f0-9]{64}$/.test(hashField), 'stored field is a sha256 hex hash');
  assert(hashField !== raw, 'raw token is not stored in the row');
  assert(!JSON.stringify(deltas.data).includes(raw), 'raw token never appears in row data');

  // approve from non-pending is rejected
  for (const status of [BETA_SIGNUP_STATUS.APPROVED, BETA_SIGNUP_STATUS.REVOKED, BETA_SIGNUP_STATUS.REDEEMED]) {
    let threw = false;
    try {
      computeTransitionDeltas("approve", row({ status }), NOW);
    } catch (err) {
      threw = err instanceof BetaAdminTransitionError;
    }
    assert(threw, `approve from ${status} is rejected`);
  }

  // invitedEmail falls back to email when not set
  const fb = computeTransitionDeltas("approve", row({ invitedEmail: null }), NOW);
  assert(fb.data.invitedEmail === "applicant@example.com", 'invitedEmail falls back to email');
}

// ============================================
// Revoke: strips access immediately
// ============================================

function testRevoke(): void {
  const approved = row({ status: BETA_SIGNUP_STATUS.APPROVED });
  const deltas = computeTransitionDeltas("revoke", approved, NOW);
  assert(deltas.data.status === "revoked", 'status becomes revoked');
  assert((deltas.data.revokedAt as Date).getTime() === NOW.getTime(), 'revokedAt set to now');
  assert(deltas.data.inviteTokenHash === null, 'invite hash nulled on revoke');
  assert(deltas.data.inviteExpires === null, 'invite expiry nulled on revoke');
  assert(deltas.emailToken === null, 'revoke sends no invite email');

  // Revocation must take effect in the sign-in gate immediately.
  const revokedRow = {
    status: deltas.data.status as string,
    revokedAt: deltas.data.revokedAt as Date,
    inviteExpires: deltas.data.inviteExpires as Date | null,
  };
  assert(!isBetaAccessGranted(revokedRow, NOW), 'revoked row is denied at the sign-in gate');

  // revoke from revoked is rejected
  let threw = false;
  try {
    computeTransitionDeltas("revoke", row({ status: BETA_SIGNUP_STATUS.REVOKED }), NOW);
  } catch (err) {
    threw = err instanceof BetaAdminTransitionError;
  }
  assert(threw, 'revoke from revoked is rejected');
}

// ============================================
// Re-invite: invalidates prior invitation, re-grants revoked
// ============================================

function testReinvite(): void {
  // Re-invite from approved replaces the prior invitation.
  const first = computeTransitionDeltas("approve", row({}), NOW);
  const second = computeTransitionDeltas("reinvite", row({ status: BETA_SIGNUP_STATUS.APPROVED }), NOW);
  assert(second.data.status === "approved", 're-invite keeps approved');
  assert(second.data.inviteTokenHash !== first.data.inviteTokenHash, 're-invite replaces the invite hash');
  assert(second.data.inviteExpires instanceof Date, 're-invite resets invite expiry');
  assert(second.data.revokedAt === null, 're-invite clears revokedAt');
  assert(second.emailToken !== null, 're-invite emails a fresh token');

  // Re-invite from revoked re-grants access with a fresh invitation.
  const revoked = row({ status: BETA_SIGNUP_STATUS.REVOKED });
  const regrant = computeTransitionDeltas("reinvite", revoked, NOW);
  assert(regrant.data.status === "approved", 're-invite re-grants a revoked signup');
  assert(regrant.data.inviteTokenHash !== null, 're-invite issues a fresh hash');

  const grantedRow = {
    status: regrant.data.status as string,
    revokedAt: regrant.data.revokedAt as Date | null,
    inviteExpires: regrant.data.inviteExpires as Date | null,
  };
  assert(isBetaAccessGranted(grantedRow, NOW), 're-invited signup is granted at the gate');

  // re-invite from pending / redeemed is rejected
  for (const status of [BETA_SIGNUP_STATUS.PENDING, BETA_SIGNUP_STATUS.REDEEMED]) {
    let threw = false;
    try {
      computeTransitionDeltas("reinvite", row({ status }), NOW);
    } catch (err) {
      threw = err instanceof BetaAdminTransitionError;
    }
    assert(threw, `re-invite from ${status} is rejected`);
  }
}

// ============================================
// Operator allowlist
// ============================================

function testOperatorAllowlist(): void {
  const prev = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "  Alice@Example.COM , bob@x.io ";
  try {
    assert(isOperatorEmail("alice@example.com"), 'operator normalized/lowercased match');
    assert(isOperatorEmail("BOB@X.IO"), 'operator case-insensitive match');
    assert(!isOperatorEmail("mallory@x.io"), 'non-operator rejected');
    assert(!isOperatorEmail("alice@example.com.evil"), 'similar-but-not-equal rejected');
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  }

  process.env.ADMIN_EMAILS = "";
  try {
    assert(!isOperatorEmail("alice@example.com"), 'empty allowlist rejects everyone');
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  }
}

// ============================================
// Runner
// ============================================

const tests: Array<[string, () => void]> = [
  ["invite helpers", testInviteHelpers],
  ["approve", testApprove],
  ["revoke", testRevoke],
  ["re-invite", testReinvite],
  ["operator allowlist", testOperatorAllowlist],
];

let failures = 0;
for (const [name, fn] of tests) {
  try {
    fn();
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
console.log(`All ${tests.length} betaAdmin test groups passed`);
/**
 * Unit tests for BETA-03 beta-access lifecycle helpers (lib/betaAccess.ts).
 *
 * Covers the security-critical pure logic: email normalization, invite-token
 * hashing, the approved/not-revoked/not-expired access gate, and invited-email
 * binding.
 *
 * Run with: npx tsx lib/__tests__/betaAccess.test.ts
 */

import {
  BETA_SIGNUP_STATUS,
  emailMatchesInvite,
  hashInviteToken,
  isBetaAccessGranted,
  isBetaSignupStatus,
  normalizeEmail,
} from '../betaAccess';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

type SignupShape = {
  status: string;
  revokedAt: Date | null;
  inviteExpires: Date | null;
};

// ============================================
// Email normalization (unique-safe lookup key)
// ============================================

function testNormalizeEmail(): void {
  assert(normalizeEmail('  Alice@Example.COM ') === 'alice@example.com', 'trims and lowercases');
  assert(normalizeEmail('BOB@X.io') === 'bob@x.io', 'lowercases');
}

// ============================================
// Invite token hashing (never store raw token)
// ============================================

function testHashInviteToken(): void {
  const token = 'some-raw-invite-token';
  const digest = hashInviteToken(token);
  assert(/^[a-f0-9]{64}$/.test(digest), 'returns 64-char sha256 hex');
  assert(hashInviteToken(token) === digest, 'deterministic for same token');
  assert(hashInviteToken(token) !== token, 'digest differs from raw token');
  assert(hashInviteToken('other') !== digest, 'different token yields different digest');
}

// ============================================
// Lifecycle status guard
// ============================================

function testIsBetaSignupStatus(): void {
  for (const s of Object.values(BETA_SIGNUP_STATUS)) {
    assert(isBetaSignupStatus(s), `valid status ${s}`);
  }
  assert(!isBetaSignupStatus('foo'), 'invalid status rejected');
}

// ============================================
// Access gate: approved, not revoked, not expired
// ============================================

function testIsBetaAccessGranted(): void {
  const now = new Date('2026-08-04T00:00:00Z');
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 60_000);

  const row = (over: Partial<SignupShape>): SignupShape => ({
    status: BETA_SIGNUP_STATUS.APPROVED,
    revokedAt: null,
    inviteExpires: future,
    ...over,
  });

  assert(isBetaAccessGranted(row({}), now), 'approved + unexpired + not revoked grants access');
  assert(!isBetaAccessGranted(row({ status: BETA_SIGNUP_STATUS.PENDING }), now), 'pending denied');
  assert(!isBetaAccessGranted(row({ status: BETA_SIGNUP_STATUS.REVOKED }), now), 'revoked denied');
  assert(!isBetaAccessGranted(row({ revokedAt: past }), now), 'revokedAt denies even if approved');
  assert(!isBetaAccessGranted(row({ inviteExpires: past }), now), 'expired invite denied');
  assert(isBetaAccessGranted(row({ inviteExpires: null }), now), 'null expiry grants access');
  assert(isBetaAccessGranted(row({ status: BETA_SIGNUP_STATUS.REDEEMED }), now), 'redeemed still granted');
}

// ============================================
// Invited-email binding
// ============================================

function testEmailMatchesInvite(): void {
  assert(emailMatchesInvite({ email: 'a@x.io', invitedEmail: null }, 'A@X.IO'), 'matches own email, case-insensitive');
  assert(emailMatchesInvite({ email: 'a@x.io', invitedEmail: 'invite@x.io' }, 'invite@x.io'), 'matches invitedEmail when set');
  assert(!emailMatchesInvite({ email: 'a@x.io', invitedEmail: 'invite@x.io' }, 'other@x.io'), 'rejects mismatched invitedEmail');
}

// ============================================
// Runner
// ============================================

const tests: Array<[string, () => void]> = [
  ['normalizeEmail', testNormalizeEmail],
  ['hashInviteToken', testHashInviteToken],
  ['isBetaSignupStatus', testIsBetaSignupStatus],
  ['isBetaAccessGranted', testIsBetaAccessGranted],
  ['emailMatchesInvite', testEmailMatchesInvite],
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
console.log(`All ${tests.length} betaAccess test groups passed`);
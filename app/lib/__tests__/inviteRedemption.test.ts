/**
 * Unit tests for BETA-04 invite-through-OAuth redemption logic
 * (lib/inviteRedemption.ts).
 *
 * Covers the security-critical pure logic without a database:
 *   - invite ticket signing/verification (short-lived, tamper-proof)
 *   - redemption validation (approved, unrevoked, unexpired, unredeemed, matching email)
 *   - atomic single-use redemption (via a mocked Prisma updateMany)
 *
 * Run with: npx tsx lib/__tests__/inviteRedemption.test.ts
 */

import {
  BETA_SIGNUP_STATUS,
} from "../betaAccess";
import {
  INVITE_TICKET_TTL_MS,
  redeemInvite,
  signInviteTicket,
  validateInviteForRedemption,
  verifyInviteTicket,
  type InviteTicketPayload,
} from "../inviteRedemption";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const SECRET = "test-secret-for-invite-tickets";
const NOW = new Date("2026-08-04T00:00:00Z");
const FUTURE = new Date(NOW.getTime() + 60_000);
const PAST = new Date(NOW.getTime() - 60_000);

const payload = (over: Partial<InviteTicketPayload> = {}): InviteTicketPayload => ({
  tokenHash: "a".repeat(64),
  invitedEmail: "invitee@example.com",
  ...over,
});

type SignupShape = {
  status: string;
  revokedAt: Date | null;
  inviteExpires: Date | null;
  redeemedAt: Date | null;
  invitedEmail: string | null;
  email: string;
};

const signup = (over: Partial<SignupShape> = {}): SignupShape => ({
  status: BETA_SIGNUP_STATUS.APPROVED,
  revokedAt: null,
  inviteExpires: FUTURE,
  redeemedAt: null,
  invitedEmail: "invitee@example.com",
  email: "invitee@example.com",
  ...over,
});

// ============================================
// Ticket signing + verification
// ============================================

function testSignVerify(): void {
  const ticket = signInviteTicket(payload(), SECRET, NOW);
  assert(typeof ticket === "string" && ticket.includes("."), "ticket is signed dot-separated value");

  const decoded = verifyInviteTicket(ticket, SECRET, NOW);
  assert(decoded !== null, "valid ticket verifies");
  assert(decoded!.tokenHash === "a".repeat(64), "ticket carries token hash");
  assert(decoded!.invitedEmail === "invitee@example.com", "ticket carries bound email");
}

function testTamperRejected(): void {
  const ticket = signInviteTicket(payload(), SECRET, NOW);
  const [, sigArg] = ticket.split(".");

  // Tamper with the payload (keep signature) -> must fail.
  const evil = payload({ invitedEmail: "evil@example.com" });
  const tamperedBody = Buffer.from(
    JSON.stringify({ tokenHash: evil.tokenHash, invitedEmail: evil.invitedEmail, exp: NOW.getTime() + INVITE_TICKET_TTL_MS }),
  ).toString("base64url");
  assert(verifyInviteTicket(`${tamperedBody}.${sigArg}`, SECRET, NOW) === null, "payload tamper rejected");

  // Wrong secret -> must fail.
  assert(verifyInviteTicket(ticket, "different-secret", NOW) === null, "wrong secret rejected");

  // Garbage / empty tickets -> must fail.
  assert(verifyInviteTicket("not-a-ticket", SECRET, NOW) === null, "garbage rejected");
  assert(verifyInviteTicket("", SECRET, NOW) === null, "empty rejected");
}

function testTicketExpiry(): void {
  const ticket = signInviteTicket(payload(), SECRET, NOW);
  // After the ticket TTL, verification must fail.
  const after = new Date(NOW.getTime() + INVITE_TICKET_TTL_MS + 1);
  assert(verifyInviteTicket(ticket, SECRET, after) === null, "expired ticket rejected");
  // Just before expiry, still valid.
  const before = new Date(NOW.getTime() + INVITE_TICKET_TTL_MS - 1);
  assert(verifyInviteTicket(ticket, SECRET, before) !== null, "ticket valid before expiry");
}

// ============================================
// Redemption validation (pure)
// ============================================

function testValidateApproved(): void {
  const v = validateInviteForRedemption(signup(), "invitee@example.com", NOW);
  assert(v.ok === true, "approved + unexpired + unredeemed + matching email is valid");
  if (v.ok) assert(v.invitedEmail === "invitee@example.com", "verdict returns bound email");
}

function testValidateRejections(): void {
  const cases: Array<[SignupShape | null, string, string]> = [
    [signup({ status: BETA_SIGNUP_STATUS.PENDING }), "invitee@example.com", "pending denied"],
    [signup({ status: BETA_SIGNUP_STATUS.REVOKED }), "invitee@example.com", "revoked denied"],
    [signup({ status: BETA_SIGNUP_STATUS.REDEEMED }), "invitee@example.com", "already-redeemed denied"],
    [signup({ revokedAt: PAST }), "invitee@example.com", "revokedAt denies"],
    [signup({ redeemedAt: PAST }), "invitee@example.com", "redeemedAt denies"],
    [signup({ inviteExpires: PAST }), "invitee@example.com", "expired invite denied"],
    [signup({ invitedEmail: "other@example.com", email: "other@example.com" }), "invitee@example.com", "mismatched invited email denied"],
    [null, "invitee@example.com", "missing signup denied"],
  ];
  for (const [row, email, msg] of cases) {
    const v = validateInviteForRedemption(row, email, NOW);
    assert(v.ok === false, msg);
  }
}

function testValidateEmailFallback(): void {
  // When invitedEmail is null, binding falls back to the signup's own email.
  const v = validateInviteForRedemption(
    signup({ invitedEmail: null, email: "applicant@example.com" }),
    "APPLICANT@Example.COM",
    NOW,
  );
  assert(v.ok === true, "falls back to applicant email (case-insensitive)");
}

// ============================================
// Atomic single-use redemption (mocked Prisma)
// ============================================

type MockUpdateMany = {
  where: unknown;
  data: unknown;
};

async function testRedeemOnce(): Promise<void> {
  let calls = 0;
  const prismaMock = {
    betaSignup: {
      updateMany: async (_args: MockUpdateMany) => {
        calls += 1;
        // First call redeems (1 row); reuse matches 0.
        return { count: calls === 1 ? 1 : 0 };
      },
    },
  };

  const first = await redeemInvite(prismaMock as never, {
    tokenHash: payload().tokenHash,
    oauthEmail: "invitee@example.com",
    now: NOW,
  });
  assert(first === true, "first redemption succeeds");

  // Reuse of the same token must not redeem again.
  const second = await redeemInvite(prismaMock as never, {
    tokenHash: payload().tokenHash,
    oauthEmail: "invitee@example.com",
    now: NOW,
  });
  assert(second === false, "reuse of spent token fails");
  assert(calls === 2, "two attempts recorded");
}

async function testRedeemWhereGuard(): Promise<void> {
  const captured: { where: any; data: any } = { where: null, data: null };
  const prismaMock = {
    betaSignup: {
      updateMany: async (args: MockUpdateMany) => {
        captured.where = args.where;
        captured.data = args.data;
        return { count: 1 };
      },
    },
  };
  await redeemInvite(prismaMock as never, {
    tokenHash: payload().tokenHash,
    oauthEmail: "invitee@example.com",
    now: NOW,
  });
  const where: any = captured.where;
  assert(where.inviteTokenHash === payload().tokenHash, "redeem scopes by token hash");
  assert(where.status === BETA_SIGNUP_STATUS.APPROVED, "redeem only flips approved rows");
  assert(where.redeemedAt === null, "redeem guards on unredeemed");
  assert(where.revokedAt === null, "redeem guards on unrevoked");
  assert(Array.isArray(where.OR), "redeem has expiry OR guard");
  assert(captured.data.status === BETA_SIGNUP_STATUS.REDEEMED, "redeem sets status to redeemed");
  assert(captured.data.redeemedAt === NOW, "redeem stamps redeemedAt");
}

// ============================================
// Runner
// ============================================

async function main(): Promise<void> {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ["signVerify", testSignVerify],
    ["tamperRejected", testTamperRejected],
    ["ticketExpiry", testTicketExpiry],
    ["validateApproved", testValidateApproved],
    ["validateRejections", testValidateRejections],
    ["validateEmailFallback", testValidateEmailFallback],
    ["redeemOnce", testRedeemOnce],
    ["redeemWhereGuard", testRedeemWhereGuard],
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
  console.log(`All ${tests.length} inviteRedemption test groups passed`);
}

void main();
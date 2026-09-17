import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import {
  BETA_SIGNUP_STATUS,
  normalizeEmail,
} from "./betaAccess";

/**
 * BETA-04 invite-through-OAuth redemption helpers.
 *
 * These helpers carry a validated, short-lived invite ticket through Google
 * OAuth and redeem the underlying BetaSignup exactly once. The pure signing,
 * verification, and validation logic lives here (no network, no DB) so it can
 * be unit tested without a database. The atomic single-use redemption is a thin
 * Prisma `updateMany` on the unique `inviteTokenHash` column.
 *
 * Security model (matches board scope): access is admitted only for a matching
 * invited email with an approved, unexpired, unrevoked, UNREDEEMED invite. Once
 * redeemed, the token is spent and cannot be reused; a returning user must be
 * re-invited by the operator (BETA-14) to regain sign-in.
 */

/** Invite ticket lifetime: brief window to complete the OAuth round-trip. */
export const INVITE_TICKET_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** The invite-bound context carried through the OAuth callback. */
export type InviteTicketPayload = {
  /** SHA-256 hex hash of the raw invite token (never the raw token). */
  tokenHash: string;
  /** Normalized email the invite is bound to. */
  invitedEmail: string;
};

/**
 * Sign a short-lived invite ticket.
 *
 * Format: `base64url(payloadJson).base64url(hmacSha256(secret, payloadJson))`.
 * The payload embeds an absolute expiry; the HMAC binds the payload to the
 * server secret so an attacker cannot forge or tamper with a ticket. The raw
 * invite token is never placed in the ticket or the cookie – only its hash.
 */
export function signInviteTicket(
  payload: InviteTicketPayload,
  secret: string,
  now: Date = new Date(),
): string {
  const body = Buffer.from(
    JSON.stringify({
      tokenHash: payload.tokenHash,
      invitedEmail: payload.invitedEmail,
      exp: now.getTime() + INVITE_TICKET_TTL_MS,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

/**
 * Verify a signed invite ticket and return its payload, or null when the
 * signature is invalid, the payload is malformed, or the ticket has expired.
 */
export function verifyInviteTicket(
  ticket: string,
  secret: string,
  now: Date = new Date(),
): InviteTicketPayload | null {
  try {
    const [body, signature] = ticket.split(".");
    if (!body || !signature) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64url");
    const received = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (received.length !== wanted.length) return null;
    if (!crypto.timingSafeEqual(received, wanted)) return null;

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      typeof parsed.tokenHash !== "string" ||
      typeof parsed.invitedEmail !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp <= now.getTime()) return null;
    return {
      tokenHash: parsed.tokenHash,
      invitedEmail: normalizeEmail(parsed.invitedEmail),
    };
  } catch {
    return null;
  }
}

/** Redemption verdict: allow or deny with a machine-readable reason. */
export type RedemptionVerdict =
  | { ok: true; invitedEmail: string }
  | { ok: false; reason: string };

/**
 * Pure validation of an invite against the OAuth user's email and current time.
 *
 * Access is admitted only when the signup is approved (not pending), not
 * revoked, not expired, not already redeemed, and bound to the OAuth email.
 */
export function validateInviteForRedemption(
  signup: {
    status: string;
    revokedAt: Date | null;
    inviteExpires: Date | null;
    redeemedAt: Date | null;
    invitedEmail: string | null;
    email: string;
  } | null,
  oauthEmail: string,
  now: Date = new Date(),
): RedemptionVerdict {
  if (!signup) return { ok: false, reason: "signup-not-found" };
  if (signup.status === BETA_SIGNUP_STATUS.REVOKED) {
    return { ok: false, reason: "revoked" };
  }
  if (signup.status === BETA_SIGNUP_STATUS.REDEEMED) {
    return { ok: false, reason: "already-redeemed" };
  }
  if (signup.status !== BETA_SIGNUP_STATUS.APPROVED) {
    return { ok: false, reason: "not-approved" };
  }
  if (signup.revokedAt) return { ok: false, reason: "revoked" };
  if (signup.redeemedAt) return { ok: false, reason: "already-redeemed" };
  if (signup.inviteExpires && signup.inviteExpires <= now) {
    return { ok: false, reason: "expired" };
  }
  const boundEmail = signup.invitedEmail ?? signup.email;
  if (normalizeEmail(boundEmail) !== normalizeEmail(oauthEmail)) {
    return { ok: false, reason: "email-mismatch" };
  }
  return { ok: true, invitedEmail: normalizeEmail(boundEmail) };
}

/**
 * Atomically redeem an invite exactly once.
 *
 * The `inviteTokenHash` is unique, and the `updateMany` where-clause only
 * matches a row that is still approved, unrevoked, unexpired, and unredeemed,
 * and whose bound email matches the OAuth user. Because the column is unique,
 * at most one row can match; because redemption sets `status = redeemed`, a
 * concurrent or subsequent call matches zero rows. Returns true only when
 * exactly one row transitioned approved -> redeemed.
 *
 * The invited-email binding is enforced here (not just in the read path) so a
 * stale or concurrent callback cannot race a mismatched email to a redeem.
 */
export async function redeemInvite(
  prisma: PrismaClient,
  opts: {
    tokenHash: string;
    oauthEmail: string;
    now?: Date;
  },
): Promise<boolean> {
  const now = opts.now ?? new Date();
  const normalized = normalizeEmail(opts.oauthEmail);
  // Bound email is either the explicit invitedEmail or falls back to the
  // signup's own email when no separate invite was addressed.
  const result = await prisma.betaSignup.updateMany({
    where: {
      inviteTokenHash: opts.tokenHash,
      status: BETA_SIGNUP_STATUS.APPROVED,
      revokedAt: null,
      redeemedAt: null,
      OR: [{ inviteExpires: null }, { inviteExpires: { gt: now } }],
      AND: [
        {
          OR: [
            { invitedEmail: normalized },
            { invitedEmail: null, email: normalized },
          ],
        },
      ],
    },
    data: {
      status: BETA_SIGNUP_STATUS.REDEEMED,
      redeemedAt: now,
    },
  });
  return result.count === 1;
}
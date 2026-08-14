import crypto from "crypto";

/**
 * BETA-03 beta-access lifecycle helpers.
 *
 * These helpers model the schema and access state only. Full OAuth redemption
 * binding (resolving the redeemed account and flipping status approved ->
 * redeemed) is wired in BETA-04.
 */

// Lifecycle states on BetaSignup.status.
export const BETA_SIGNUP_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REVOKED: "revoked",
  REDEEMED: "redeemed",
} as const;
export type BetaSignupStatus =
  (typeof BETA_SIGNUP_STATUS)[keyof typeof BETA_SIGNUP_STATUS];

export function isBetaSignupStatus(value: string): value is BetaSignupStatus {
  return Object.values(BETA_SIGNUP_STATUS).includes(value as BetaSignupStatus);
}

/**
 * Normalize an email for storage and lookup: lowercase + trim. Keeps the
 * `email` column unique over normalized values so the same account cannot
 * create duplicate signups via case/whitespace variants.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * SHA-256 hex digest of a raw invite token. Only the hash is ever persisted;
 * the raw token is sent to the invitee and never stored, so a database leak
 * cannot mint usable invite links.
 */
export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Access verdict for a BetaSignup row at a given instant.
 *
 * Access is granted only when the row is approved (not pending), not revoked,
 * and not past its invite expiry. A "redeemed" row is still granted access
 * (the account has already claimed it); revocation is the only way to strip it.
 */
export type BetaSignupAccessRow = {
  status: string;
  revokedAt: Date | null;
  inviteExpires: Date | null;
};

export function isBetaAccessGranted(
  signup: BetaSignupAccessRow,
  now: Date = new Date(),
): boolean {
  if (signup.status === BETA_SIGNUP_STATUS.REVOKED) return false;
  if (signup.status !== BETA_SIGNUP_STATUS.APPROVED &&
      signup.status !== BETA_SIGNUP_STATUS.REDEEMED) {
    return false;
  }
  if (signup.revokedAt) return false;
  if (signup.inviteExpires && signup.inviteExpires <= now) return false;
  return true;
}

/**
 * Operator access verdict for a BetaSignup row (OPS-06 decision-A).
 *
 * Operators are exempt from the invite-expiry check so they can never lock
 * themselves out of /admin; they still require the row to be approved (or
 * redeemed) and non-revoked. The expiry condition is the only distinction
 * from `isBetaAccessGranted`. The guessed-email protection is preserved: the
 * caller must still be a real operator identity (env allowlist / Admin table)
 * with an approved, non-revoked BetaSignup — only expiry is waived here.
 */
export function isBetaAccessGrantedForOperator(signup: BetaSignupAccessRow): boolean {
  if (signup.status === BETA_SIGNUP_STATUS.REVOKED) return false;
  if (signup.status !== BETA_SIGNUP_STATUS.APPROVED &&
      signup.status !== BETA_SIGNUP_STATUS.REDEEMED) {
    return false;
  }
  if (signup.revokedAt) return false;
  return true;
}

/**
 * Whether the authenticated user's email matches the email this signup is
 * bound to. When `invitedEmail` is set, redemption/sign-in must match it;
 * otherwise falls back to the signup's own `email` (applicant == invitee).
 */
export function emailMatchesInvite(
  signup: { email: string; invitedEmail: string | null },
  userEmail: string,
): boolean {
  const normalized = normalizeEmail(userEmail);
  if (signup.invitedEmail) {
    return normalizeEmail(signup.invitedEmail) === normalized;
  }
  return normalizeEmail(signup.email) === normalized;
}
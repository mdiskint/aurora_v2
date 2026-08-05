import crypto from "crypto";
import { Resend } from "resend";
import { hashInviteToken, normalizeEmail } from "@/lib/betaAccess";

/**
 * BETA-14 beta operator lifecycle operations.
 *
 * The pure transition logic lives here (no DB, no network) so it can be unit
 * tested without a database or an email provider. Route handlers apply the
 * computed deltas to the BetaSignup row and issue the invite email.
 *
 * Access state is always derived server-side. The raw invite token is sent to
 * the invitee only inside the invite email (and, for redemption, BETA-04); it
 * is never stored, logged, or written to board evidence. Only its SHA-256 hash
 * is persisted.
 */

/** Invite lifetime: 72 hours, matching the beta-signup application flow. */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type BetaAdminAction = "approve" | "revoke" | "reinvite";

/** Thrown when an operator action is not valid for the signup's current state. */
export class BetaAdminTransitionError extends Error {
  constructor(
    message: string,
    public readonly status: number = 409,
  ) {
    super(message);
    this.name = "BetaAdminTransitionError";
  }
}

/** Generate a fresh raw invite token (random 256-bit, hex). */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Compute the invite expiry for a `now` instant. */
export function computeInviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/**
 * Build the invite link the invitee is emailed. The raw token is embedded in
 * the URL (the invitee needs it to redeem); only its hash is ever persisted.
 * The `/join` page validates the token by hash already; BETA-04 wires the
 * full OAuth redemption binding against this token.
 */
export function buildInviteLink(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/join?token=${encodeURIComponent(token)}`;
}

/** The minimal BetaSignup shape the transition logic needs. */
export type BetaSignupForTransition = {
  status: string;
  email: string;
  invitedEmail: string | null;
};

/** Fields to write to the BetaSignup row, plus the raw token to email (if any). */
export type BetaTransitionResult = {
  data: Record<string, unknown>;
  emailToken: string | null;
};

/**
 * Compute the row deltas for an operator action against a signup's current
 * state. Throws `BetaAdminTransitionError` when the transition is invalid.
 *
 * Transitions:
 *   approve  : pending -> approved  (fresh invite bound to the applicant email)
 *   revoke   : pending|approved|redeemed -> revoked (access stripped immediately)
 *   reinvite : approved|revoked -> approved (fresh invite; re-grants a revoked user)
 */
export function computeTransitionDeltas(
  action: BetaAdminAction,
  signup: BetaSignupForTransition,
  now: Date = new Date(),
): BetaTransitionResult {
  const invitedEmail = signup.invitedEmail ?? normalizeEmail(signup.email);

  switch (action) {
    case "approve": {
      if (signup.status !== "pending") {
        throw new BetaAdminTransitionError("Signup is not pending approval");
      }
      const token = generateInviteToken();
      return {
        data: {
          status: "approved",
          approvedAt: now,
          revokedAt: null,
          redeemedAt: null,
          invitedEmail,
          inviteTokenHash: hashInviteToken(token),
          inviteExpires: computeInviteExpiry(now),
        },
        emailToken: token,
      };
    }
    case "revoke": {
      if (signup.status === "revoked") {
        throw new BetaAdminTransitionError("Signup is already revoked");
      }
      // Null the invite hash + expiry so a stale invite link can never be
      // redeemed even if it leaks; the sign-in gate also rejects revoked rows.
      return {
        data: {
          status: "revoked",
          revokedAt: now,
          inviteTokenHash: null,
          inviteExpires: null,
        },
        emailToken: null,
      };
    }
    case "reinvite": {
      if (signup.status === "pending") {
        throw new BetaAdminTransitionError("Signup has not been approved yet");
      }
      if (signup.status === "redeemed") {
        throw new BetaAdminTransitionError("Signup is already redeemed");
      }
      // Re-invite replaces the prior invitation (new hash + reset expiry) so a
      // previous invite link is invalidated. A revoked signup is re-granted
      // access with a fresh invitation.
      const token = generateInviteToken();
      return {
        data: {
          status: "approved",
          approvedAt: now,
          revokedAt: null,
          redeemedAt: null,
          invitedEmail,
          inviteTokenHash: hashInviteToken(token),
          inviteExpires: computeInviteExpiry(now),
        },
        emailToken: token,
      };
    }
  }
}

const resend = () => new Resend(process.env.RESEND_API_KEY);

/**
 * Send the invite email. Returns whether the send was attempted and accepted.
 * Failures are caught and logged with only a generic message (never the token
 * or the invite link), so a transient email error does not corrupt the
 * already-committed DB state; the operator can re-invite.
 */
export async function sendInviteEmail(opts: {
  to: string;
  inviteLink: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    await resend().emails.send({
      from: "Astryon <noreply@astryon.com>",
      to: opts.to,
      subject: "You're invited to the Astryon beta",
      html:
        `<p>Your application to the Astryon beta has been approved.</p>` +
        `<p>Click the link below to continue:</p>` +
        `<p><a href="${opts.inviteLink}">${opts.inviteLink}</a></p>` +
        `<p>The invite link expires in 72 hours.</p>`,
    });
    return true;
  } catch (err) {
    console.error(
      "[beta-admin] invite email send failed:",
      (err as Error)?.constructor?.name,
    );
    return false;
  }
}
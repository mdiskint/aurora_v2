import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, type SessionResolver } from "@/lib/authz";
import { isBetaAccessGrantedForOperator, normalizeEmail } from "@/lib/betaAccess";

/**
 * OPS-06 beta operator authorization.
 *
 * Operator identity has two sources: the env-based `ADMIN_EMAILS` allowlist
 * (comma-separated emails, checked server-side) and the `Admin` table managed
 * from the /admin UI. Every operator route short-circuits with a 403 before any
 * work when the caller is an authenticated non-operator.
 *
 * OPS-06 round-2 hardened the operator gate (option C): mere membership in the
 * allowlist or Admin table is NOT enough. Access additionally requires an
 * approved, non-revoked, non-expired BetaSignup access record for the operator
 * email (see `isBetaAccessGranted`). This closes the guessed-email-string
 * bootstrap hole: an operator identity that has never been beta-approved cannot
 * reach /admin.
 */

/** The minimal BetaSignup shape the operator gate needs to evaluate access. */
export type OperatorBetaAccessRow = {
  status: string;
  revokedAt: Date | null;
  inviteExpires: Date | null;
};

/**
 * Injectable DB seam for operator authorization. Production uses the default
 * Prisma-backed implementation; security unit tests inject stubs so the
 * decision logic is exercised without a live database or session.
 */
export type OperatorLookup = {
  /** Whether the email has an Admin-table row (operator identity source #2). */
  isAdminMember: (email: string) => Promise<boolean>;
  /** The BetaSignup access record for the email, or null when none. */
  getBetaAccess: (email: string) => Promise<OperatorBetaAccessRow | null>;
};

const defaultLookup: OperatorLookup = {
  async isAdminMember(email) {
    const row = await prisma.admin.findUnique({ where: { email } });
    return Boolean(row);
  },
  async getBetaAccess(email) {
    return prisma.betaSignup.findFirst({
      where: { OR: [{ email }, { invitedEmail: email }] },
      select: { status: true, revokedAt: true, inviteExpires: true },
    });
  },
};

/**
 * Parse the `ADMIN_EMAILS` allowlist into a normalized set for O(1) lookup.
 * Emails are normalized (lowercased/trimmed) so the check is case/whitespace
 * insensitive, matching the BetaSignup `email` lookup key.
 */
export function parseOperatorEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

/**
 * Whether an email is on the ADMIN_EMAILS env allowlist. This is operator
 * identity source #1 only; it does NOT alone grant /admin access (see
 * `requireOperator` for the combined identity + beta-access gate).
 */
export function isOperatorEmail(email: string): boolean {
  return parseOperatorEmails().has(normalizeEmail(email));
}

/**
 * Pure operator-authorization decision shared by tests and the route gate.
 *
 * An email is an operator iff it is on the env allowlist OR has an Admin-table
 * row. Access is granted only when the caller is an operator AND holds an
 * approved, non-revoked beta-access record (OPS-06 option C, decision-A).
 * Operators are exempt from the invite-expiry check (they can bootstrap
 * repeatedly without self-locking out); the approved + non-revoked requirement
 * still holds, preserving the guessed-email protection.
 */
export function isOperatorGranted(
  lookup: {
    isAllowlisted: boolean;
    isAdminMember: boolean;
  },
  signup: OperatorBetaAccessRow | null,
): boolean {
  const isOperator = lookup.isAllowlisted || lookup.isAdminMember;
  if (!isOperator) return false;
  return signup !== null && isBetaAccessGrantedForOperator(signup);
}

/**
 * Require an authenticated beta operator on a server route.
 *
 * Returns a 401 JSON response when anonymous (no session), and a 403 when the
 * authenticated user is not an operator under the tightened gate (identity
 * allowlist/Admin-table AND approved beta access). `response` is null exactly
 * when an operator `user` is resolved, so operator routes can gate before any
 * work. The optional `resolver` (session) and `lookup` (DB) args are test seams.
 */
export async function requireOperator(
  resolver?: SessionResolver,
  lookup: OperatorLookup = defaultLookup,
): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof requireUser>>["user"]>; response: null }
  | { user: null; response: NextResponse }
> {
  const { user, response } = await requireUser(resolver);
  if (response) return { user: null, response };
  const email = normalizeEmail(user.email as string);

  const [isAdminMember, signup] = await Promise.all([
    lookup.isAdminMember(email),
    lookup.getBetaAccess(email),
  ]);

  if (!isOperatorGranted({ isAllowlisted: isOperatorEmail(email), isAdminMember }, signup)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, response: null };
}
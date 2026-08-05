import { NextResponse } from "next/server";
import { requireUser, type SessionResolver } from "@/lib/authz";
import { normalizeEmail } from "@/lib/betaAccess";

/**
 * BETA-14 beta operator authorization.
 *
 * Single-operator beta: operator identity comes from an env-based allowlist
 * (`ADMIN_EMAILS`, comma-separated invalidated emails) checked server-side.
 * No admin UI is exposed to non-operators; every operator route short-circuits
 * with a 403 before any work when the caller is an authenticated non-operator.
 */

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
 * Whether an email belongs to the beta operator allowlist.
 */
export function isOperatorEmail(email: string): boolean {
  return parseOperatorEmails().has(normalizeEmail(email));
}

/**
 * Require an authenticated beta operator on a server route.
 *
 * Returns a 401 JSON response when anonymous (no session), and a 403 when the
 * authenticated user is not an operator. `response` is null exactly when an
 * operator `user` is resolved, so operator routes can gate before any work.
 */
export async function requireOperator(
  resolver?: SessionResolver
): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof requireUser>>["user"]>; response: null }
  | { user: null; response: NextResponse }
> {
  const { user, response } = await requireUser(resolver);
  if (response) return { user: null, response };
  if (!isOperatorEmail(user.email as string)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user, response: null };
}
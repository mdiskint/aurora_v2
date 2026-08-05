import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Session user type surfaced by the auth helpers.
 */
export interface SessionUser {
  /** Present only when the JWT subject (user id) is available. */
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Resolver for the current session's user. Defaults to the NextAuth session
 * helper; tests inject a stub so the authz decision logic can be exercised
 * without a live OAuth session or database.
 */
export type SessionResolver = () => Promise<{ user?: SessionUser } | null>;

const defaultSessionResolver: SessionResolver = () =>
  getServerSession(authOptions);

/**
 * Resolve the authenticated session user, or null when anonymous.
 *
 * The optional `resolver` is a test seam: production callers omit it and the
 * default NextAuth resolver is used, while the security harness injects a
 * stub to exercise the anonymous/authenticated/no-email decision logic.
 */
export async function getSessionUser(
  resolver: SessionResolver = defaultSessionResolver
): Promise<SessionUser | null> {
  const session = await resolver();
  return session?.user ?? null;
}

/**
 * Require an authenticated session user on a server route.
 *
 * Returns a 401 JSON response when no session (or no verified email) is
 * present, so protected API routes can short-circuit without duplicating the
 * session check. `response` is null exactly when `user` is resolved.
 */
export async function requireUser(
  resolver?: SessionResolver
): Promise<
  { user: SessionUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getSessionUser(resolver);
  if (!user?.email) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, response: null };
}
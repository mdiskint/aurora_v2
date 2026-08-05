import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "@/lib/betaAccess";
import {
  redeemInvite,
  validateInviteForRedemption,
  verifyInviteTicket,
} from "@/lib/inviteRedemption";

/**
 * Name of the short-lived signed HttpOnly cookie set by POST /api/auth/invite
 * (see app/api/auth/invite/route.ts) that carries the validated invite through
 * the Google OAuth round-trip. Never contains the raw token.
 */
const INVITE_TICKET_COOKIE = "astryon_invite";

/**
 * Environment names required for NextAuth in production.
 *
 * Only names are validated and reported; secret values are never logged.
 * The set is intentionally limited to the non-secret names that the Auth
 * provider (OAuth + JWT session) and the Prisma adapter require at startup.
 */
const REQUIRED_PRODUCTION_ENV = [
  // OAuth provider credentials
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  // JWT session signing + jwt() verification in middleware
  "NEXTAUTH_SECRET",
  // Prisma adapter database
  "DATABASE_URL",
  // Absolute app URL used by NextAuth and OAuth callbacks
  "NEXTAUTH_URL",
  // Beta operator allowlist (comma-separated emails). Required so the beta
  // operator control surface (BETA-14) can never lock itself out silently.
  "ADMIN_EMAILS",
] as const;

/**
 * Fail-closed production startup validation.
 *
 * Throws with a redacted, name-only message (no secret values) when any
 * required environment variable is missing. In development, missing values
 * are tolerated so local auth can be exercised without a full secret set.
 */
export function assertAuthEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const missing = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(", ")}`,
    );
  }
}

/**
 * Central, typed NextAuth configuration.
 *
 * Single source of truth for the auth boundary. API routes and the App Router
 * session helper both consume this object so session, callback, and provider
 * behavior stays consistent across the codebase.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async signIn({ user }: any) {
      if (!user.email) return false;
      // Skip the beta-signup gate in dev so local testing does not require a
      // beta signup record or a full OAuth invite round-trip.
      if (process.env.NODE_ENV === "development") return true;

      // Production gate: sign-in succeeds ONLY when the OAuth user's email is
      // bound to a valid, approved, unrevoked, unexpired, unredeemed invite
      // carried through the OAuth round-trip, and the invite redeems exactly
      // once. Direct sign-in without a valid invite ticket is denied.
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) return false;

      const cookieStore = await cookies();
      const ticket = cookieStore.get(INVITE_TICKET_COOKIE)?.value;
      if (!ticket) return false;

      const payload = verifyInviteTicket(ticket, secret);
      if (!payload) return false;

      // The ticket binds the OAuth email; verify it matches the invited email
      // before any redemption attempt.
      if (normalizeEmail(payload.invitedEmail) !== normalizeEmail(user.email)) {
        return false;
      }

      const signup = await prisma.betaSignup.findUnique({
        where: { inviteTokenHash: payload.tokenHash },
      });
      const verdict = validateInviteForRedemption(signup ?? null, user.email);
      if (!verdict.ok) return false;

      // Atomically flip approved -> redeemed exactly once. The unique
      // inviteTokenHash + redeem-guard where-clause makes reuse impossible.
      const redeemed = await redeemInvite(prisma, {
        tokenHash: payload.tokenHash,
        oauthEmail: user.email,
      });
      if (!redeemed) return false;

      // Invite spent; drop the ticket so it cannot be reused this session.
      cookieStore.delete(INVITE_TICKET_COOKIE);
      return true;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
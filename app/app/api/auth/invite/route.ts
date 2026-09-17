import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashInviteToken } from "@/lib/betaAccess";
import {
  INVITE_TICKET_TTL_MS,
  signInviteTicket,
  validateInviteForRedemption,
} from "@/lib/inviteRedemption";

/**
 * BETA-04 invite ticket issuance.
 *
 * POST /api/auth/invite with `{ token }`. Validates the presented raw invite
 * token (lookup by hash, approved, not revoked, not expired, not already
 * redeemed) and, only when valid, sets a short-lived signed HttpOnly cookie
 * carrying the invite bound-email through the subsequent Google OAuth flow.
 *
 * An invalid, expired, revoked, or already-redeemed invite is rejected here –
 * before any OAuth redirect – so the signIn callback is never reached with a
 * stale ticket. The raw token is never placed in the cookie, response, or logs;
 * only its hash is carried.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;
  if (!token || token.length === 0) {
    return NextResponse.json({ error: "Invite token required" }, { status: 400 });
  }

  const tokenHash = hashInviteToken(token);
  const signup = await prisma.betaSignup.findUnique({
    where: { inviteTokenHash: tokenHash },
  });

  const verdict = validateInviteForRedemption(signup ?? null, signup?.invitedEmail ?? signup?.email ?? "");
  if (!verdict.ok) {
    // Keep the reason generic in the response; detailed reasons are not exposed
    // to the client beyond "invalid invite".
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 403 });
  }

  const ticket = signInviteTicket(
    { tokenHash, invitedEmail: verdict.invitedEmail },
    // The ticket is HMAC-bound to the same secret that signs the JWT session.
    process.env.NEXTAUTH_SECRET!,
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set("astryon_invite", ticket, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_TICKET_TTL_MS / 1000,
  });
  return response;
}

/** GET is not supported; the invite must be POSTed with a body token. */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
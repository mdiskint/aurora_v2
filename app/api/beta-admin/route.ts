import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { requireOperator } from "@/lib/operator";
import { parseBoundedJson } from "@/lib/requestBound";
import {
  BetaAdminTransitionError,
  buildInviteLink,
  computeTransitionDeltas,
  sendInviteEmail,
  type BetaAdminAction,
} from "@/lib/betaAdmin";

const ACTIONS: BetaAdminAction[] = ["approve", "revoke", "reinvite"];

const SIGNUP_LIST_SELECT = {
  id: true,
  email: true,
  status: true,
  invitedEmail: true,
  approvedAt: true,
  revokedAt: true,
  redeemedAt: true,
  inviteExpires: true,
  createdAt: true,
} as const;

/** Force dynamic so operator responses (PII emails) are never statically cached. */
export const dynamic = "force-dynamic";

/**
 * Reject cross-origin POSTs. The panel is same-origin only; because the admin
 * surface is operator-gated, any successful operator request originates from
 * our own site. Checking the Origin header against the request's own host (and
 * any configured NEXTAUTH_URL) provides a SameSite-style CSRF guard for the
 * state-changing endpoint.
 */
/**
 * Resolve the operator's source IP for the audit log. Prefers the first
 * `x-forwarded-for` hop (set by the reverse proxy / Vercel Edge), falling back
 * to `x-real-ip`, then null. Best-effort; a missing value is recorded as null.
 * Returns only the first address and strips any port. Never an enum/enumerable.
 */
function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]!.trim();
    return first.split(":")[0] || null;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.split(":")[0] || null;
  }
  return null;
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>([request.nextUrl.origin]);
  if (process.env.NEXTAUTH_URL) {
    try {
      allowed.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {
      // ignore malformed NEXTAUTH_URL
    }
  }
  return allowed.has(origin);
}

/**
 * OPS-06 beta operator control surface.
 *
 * Every handler is gated by `requireOperator` (401 anonymous, 403
 * authenticated non-operator) before any work. Responses expose only ids,
 * statuses, and timestamps to the operator; raw invite tokens and user content
 * never appear in responses, logs, or evidence. GET is force-dynamic with a
 * no-store Cache-Control. POST rejects cross-origin requests and writes an
 * `AdminActionLog` audit row for every approve/revoke/reinvite.
 */
export async function GET() {
  const { response } = await requireOperator();
  if (response) return response;

  const signups = await prisma.betaSignup.findMany({
    orderBy: { createdAt: "desc" },
    select: SIGNUP_LIST_SELECT,
  });

  return new NextResponse(JSON.stringify({ signups }), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await requireOperator();
  if (auth.response) return auth.response;
  const user = auth.user;

  const parsed = await parseBoundedJson(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const { action, id } = parsed.body ?? {};
  if (typeof action !== "string" || !ACTIONS.includes(action as BetaAdminAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "Signup id required" }, { status: 400 });
  }

  const signup = await prisma.betaSignup.findUnique({ where: { id } });
  if (!signup) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }

  let deltas;
  try {
    deltas = computeTransitionDeltas(action as BetaAdminAction, signup);
  } catch (err) {
    if (err instanceof BetaAdminTransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const updated = await prisma.betaSignup.update({
    where: { id },
    data: deltas.data,
  });

  // OPS-06 audit trail: log every operator state change. Best-effort; a failure
  // here must not roll back the already-committed transition (the operator can
  // rely on the transition itself). Only the operator's normalized email,
  // action, signup id, target email, and request source IP are recorded.
  await writeAuditLog({
    operatorEmail: user.email as string,
    action: action as BetaAdminAction,
    signupId: id,
    targetEmail: signup.email,
    ip: clientIp(request as NextRequest),
  });

  let inviteEmailSent = false;
  if (deltas.emailToken) {
    inviteEmailSent = await sendInviteEmail({
      to: (updated.invitedEmail ?? updated.email) as string,
      inviteLink: buildInviteLink(deltas.emailToken),
    });
  }

  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    inviteEmailSent,
  });
}

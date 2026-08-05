import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

/**
 * BETA-14 beta operator control surface.
 *
 * Every handler is gated by `requireOperator` (401 anonymous, 403
 * authenticated non-operator) before any work. Responses expose only ids,
 * statuses, and timestamps to the operator; raw invite tokens and user content
 * never appear in responses, logs, or evidence.
 */
export async function GET() {
  const { response } = await requireOperator();
  if (response) return response;

  const signups = await prisma.betaSignup.findMany({
    orderBy: { createdAt: "desc" },
    select: SIGNUP_LIST_SELECT,
  });

  return NextResponse.json({ signups });
}

export async function POST(request: NextRequest) {
  const { response } = await requireOperator();
  if (response) return response;

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
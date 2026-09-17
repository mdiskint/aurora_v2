import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { requireOperator } from "@/lib/operator";
import { normalizeEmail } from "@/lib/betaAccess";
import { parseBoundedJson } from "@/lib/requestBound";

const ADMIN_MANAGE_ACTIONS = ["add", "remove"] as const;

const ADMIN_LIST_SELECT = {
  id: true,
  email: true,
  addedBy: true,
  createdAt: true,
} as const;

const AUDIT_SELECT = {
  id: true,
  operatorEmail: true,
  action: true,
  signupId: true,
  targetEmail: true,
  ip: true,
  createdAt: true,
} as const;

/** Force dynamic so operator responses (PII emails) are never statically cached. */
export const dynamic = "force-dynamic";

/**
 * Reject cross-origin POSTs (SameSite-style CSRF guard), mirroring beta-admin.
 */
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

/** Resolve the operator's source IP for audit (x-forwarded-for → x-real-ip → null). */
function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]!.trim();
    return first.split(":")[0] || null;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.split(":")[0] || null;
  return null;
}

/**
 * OPS-06 round-2 admin-management surface.
 *
 * GET returns the current operator list (`admins`, from env allowlist + Admin
 * table) and a read-only audit trail (recent AdminActionLog rows). POST manages
 * the Admin table (add/remove) and writes an audit entry for every change. All
 * handlers are gated by the tightened `requireOperator` (identity allowlist OR
 * Admin table AND approved beta access).
 */
export async function GET() {
  const { response } = await requireOperator();
  if (response) return response;

  const adminRows = await prisma.admin.findMany({
    orderBy: { createdAt: "desc" },
    select: ADMIN_LIST_SELECT,
  });

  const audit = await prisma.adminActionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: AUDIT_SELECT,
  });

  // Serialize Dates for the client boundary.
  const admins = adminRows.map((r) => ({
    id: r.id,
    email: r.email,
    addedBy: r.addedBy,
    createdAt: r.createdAt.toISOString(),
  }));
  const auditRows = audit.map((a) => ({
    id: a.id,
    operatorEmail: a.operatorEmail,
    action: a.action,
    signupId: a.signupId,
    targetEmail: a.targetEmail,
    ip: a.ip,
    createdAt: a.createdAt.toISOString(),
  }));

  return new NextResponse(JSON.stringify({ admins, audit: auditRows }), {
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
  const { action, email } = parsed.body ?? {};
  if (typeof action !== "string" || !ADMIN_MANAGE_ACTIONS.includes(action as (typeof ADMIN_MANAGE_ACTIONS)[number])) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (typeof email !== "string" || normalizeEmail(email).length === 0) {
    return NextResponse.json({ error: "Admin email required" }, { status: 400 });
  }
  const normalized = normalizeEmail(email);

  if (action === "add") {
    const existing = await prisma.admin.findUnique({ where: { email: normalized } });
    if (existing) {
      return NextResponse.json({ error: "Email is already an admin" }, { status: 409 });
    }
    await prisma.admin.create({
      data: { email: normalized, addedBy: user.email as string },
    });
    await writeAuditLog({
      operatorEmail: user.email as string,
      action: "admin-add",
      targetEmail: normalized,
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, email: normalized });
  }

  // remove
  const removed = await prisma.admin.deleteMany({ where: { email: normalized } });
  if (removed.count === 0) {
    return NextResponse.json({ error: "Email is not a managed admin" }, { status: 404 });
  }
  await writeAuditLog({
    operatorEmail: user.email as string,
    action: "admin-remove",
    targetEmail: normalized,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true, email: normalized });
}

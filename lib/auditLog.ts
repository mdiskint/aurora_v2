import prisma from "@/lib/prisma";

/**
 * OPS-06 audit-log helper.
 *
 * Writes a single `AdminActionLog` row best-effort. Used by the beta-admin
 * (signup transitions) and admin-management (Admin add/remove) routes so every
 * operator state change is recorded. A failure here must never roll back an
 * already-committed transition, so errors are caught and returned as refused
 * rather than thrown to the caller.
 */

export type AuditAction =
  | "approve"
  | "revoke"
  | "reinvite"
  | "admin-add"
  | "admin-remove";

export async function writeAuditLog(opts: {
  operatorEmail: string;
  action: AuditAction;
  signupId?: string | null;
  targetEmail: string;
  ip?: string | null;
}): Promise<boolean> {
  try {
    await prisma.adminActionLog.create({
      data: {
        operatorEmail: opts.operatorEmail,
        action: opts.action,
        signupId: opts.signupId ?? null,
        targetEmail: opts.targetEmail,
        ip: opts.ip ?? null,
      },
    });
    return true;
  } catch (err) {
    console.error(
      "[audit-log] write failed:",
      (err as Error)?.constructor?.name,
    );
    return false;
  }
}

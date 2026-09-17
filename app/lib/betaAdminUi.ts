/**
 * OPS-06 client-safe beta-admin UI metadata.
 *
 * Pure display/decision helpers for the operator /admin panel. Deliberately
 * does NOT import the server-only `lib/betaAdmin.ts` (that module pulls in
 * `resend` and `crypto`), so this module stays bundle-safe for the client.
 *
 * `getAvailableAdminActions` mirrors `computeTransitionDeltas` in
 * `lib/betaAdmin.ts` so the action matrix is consistent between the server
 * transition rules and the client UI:
 *   approve  : pending only
 *   revoke   : pending | approved | redeemed (not revoked)
 *   reinvite : approved | revoked (not pending or redeemed)
 */

/** Human-readable label for a BetaSignup status. Unknown states fall back to the raw value. */
export const BETA_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  revoked: "Revoked",
  redeemed: "Redeemed",
};

/** Tailwind badge classes per status. Ordered keyed by status string. */
export const BETA_STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
  approved: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  revoked: "bg-red-500/15 text-red-300 border border-red-500/40",
  redeemed: "bg-sky-500/15 text-sky-300 border border-sky-500/40",
};

/** A filter chip for the panel, combining a label and the underlying status key ('all' means no filter). */
export type AdminFilterChip = { key: string; label: string };

/** All status filter chips offered by the panel (including the 'all' catch-all). */
export const ADMIN_FILTER_CHIPS: AdminFilterChip[] = [
  { key: "all", label: "All" },
  ...Object.entries(BETA_STATUS_LABELS).map(([key, label]) => ({ key, label })),
];

/** The operator actions the beta-admin API accepts. */
export type BetaAdminUiAction = "approve" | "revoke" | "reinvite";

/**
 * The set of actions valid for a given signup status, matching
 * `computeTransitionDeltas`. Returns an empty array for unknown/unsupported
 * statuses so the UI never offers an action the server would reject.
 */
export function getAvailableAdminActions(status: string): BetaAdminUiAction[] {
  switch (status) {
    case "pending":
      return ["approve", "revoke"];
    case "approved":
      return ["revoke", "reinvite"];
    case "revoked":
      return ["reinvite"];
    case "redeemed":
      return ["revoke"];
    default:
      return [];
  }
}

/** Resolve a status to its human-readable label, falling back to the raw value. */
export function getStatusLabel(status: string): string {
  return BETA_STATUS_LABELS[status] ?? status;
}

/** Resolve a status to its badge classes, falling back to a neutral badge. */
export function getStatusBadgeClasses(status: string): string {
  return (
    BETA_STATUS_BADGE_CLASSES[status] ??
    "bg-gray-500/15 text-gray-300 border border-gray-500/40"
  );
}

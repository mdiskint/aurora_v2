/**
 * Unit tests for OPS-06 client-safe beta-admin UI metadata (lib/betaAdminUi.ts).
 *
 * Asserts the action matrix returned by `getAvailableAdminActions` matches the
 * `computeTransitionDeltas` rules in lib/betaAdmin.ts:
 *   approve  : pending only
 *   revoke   : pending | approved | redeemed (not revoked)
 *   reinvite : approved | revoked (not pending or redeemed)
 *
 * Run with: npx tsx lib/__tests__/betaAdminUi.test.ts
 */

import {
  ADMIN_FILTER_CHIPS,
  BETA_STATUS_BADGE_CLASSES,
  BETA_STATUS_LABELS,
  getAvailableAdminActions,
  getStatusBadgeClasses,
  getStatusLabel,
} from "../betaAdminUi";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function hasAction(status: string, action: string): boolean {
  return getAvailableAdminActions(status).includes(action as never);
}

function testActionMatrix(): void {
  // pending: approve + revoke only
  assert(
    hasAction("pending", "approve") && hasAction("pending", "revoke") &&
      !hasAction("pending", "reinvite"),
    "pending allows approve and revoke, but not reinvite",
  );

  // approved: revoke + reinvite only
  assert(
    hasAction("approved", "revoke") && hasAction("approved", "reinvite") &&
      !hasAction("approved", "approve"),
    "approved allows revoke and reinvite, but not approve",
  );

  // revoked: reinvite only
  assert(
    hasAction("revoked", "reinvite") &&
      !hasAction("revoked", "approve") && !hasAction("revoked", "revoke"),
    "revoked allows only reinvite",
  );

  // redeemed: revoke only
  assert(
    hasAction("redeemed", "revoke") &&
      !hasAction("redeemed", "approve") && !hasAction("redeemed", "reinvite"),
    "redeemed allows only revoke",
  );

  // unknown status: no actions offered (UI never sends an unsupported action)
  const unknown = getAvailableAdminActions("bogus");
  assert(Array.isArray(unknown) && unknown.length === 0, "unknown status offers no actions");
}

function testStatusMetadata(): void {
  assert(getStatusLabel("pending") === "Pending", 'pending label');
  assert(getStatusLabel("approved") === "Approved", 'approved label');
  assert(getStatusLabel("revoked") === "Revoked", 'revoked label');
  assert(getStatusLabel("redeemed") === "Redeemed", 'redeemed label');
  assert(getStatusLabel("weird") === "weird", 'unknown status falls back to raw value');

  const badge = getStatusBadgeClasses("approved");
  assert(badge.includes("emerald"), 'approved badge uses emerald styling');
  assert(getStatusBadgeClasses("nope").includes("gray"), 'unknown status uses neutral badge');

  // Every known status has a label and a badge class.
  for (const status of Object.keys(BETA_STATUS_LABELS)) {
    assert(!!BETA_STATUS_LABELS[status], `label present for ${status}`);
    assert(!!BETA_STATUS_BADGE_CLASSES[status], `badge present for ${status}`);
  }

  // Filter chips cover 'all' plus every known status exactly once.
  const chips = ADMIN_FILTER_CHIPS;
  assert(chips[0].key === "all" && chips[0].label === "All", 'first chip is All');
  const chipKeys = chips.map((c) => c.key);
  for (const status of Object.keys(BETA_STATUS_LABELS)) {
    assert(chipKeys.includes(status), `filter chip includes ${status}`);
  }
}

const tests: Array<[string, () => void]> = [
  ["action matrix", testActionMatrix],
  ["status metadata", testStatusMetadata],
];

let failures = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}: ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`${failures} test group(s) failed`);
  process.exit(1);
}
console.log(`All ${tests.length} betaAdminUi test groups passed`);

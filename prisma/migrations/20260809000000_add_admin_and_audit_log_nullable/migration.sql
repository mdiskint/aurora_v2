-- OPS-06 round-2: operator management + audit-log flexibility.
--
-- 1. Creates the `Admin` table (operator management UI): a second source of
--    operator identity alongside the ADMIN_EMAILS env allowlist. Additive.
-- 2. Relaxes `AdminActionLog.signupId` to nullable so admin add/remove actions
--    (which have no BetaSignup row) can be audited with the affected email in
--    `targetEmail`. The admin_action_log table is created by the earlier
--    OPS-06 migration (20260808170000_add_admin_action_log); this only drops
--    the NOT NULL constraint. No columns are dropped or renamed.
--
-- Migration is generated locally and gated from application to the live
-- production database; it is deployed through the board change-control stage.

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_email_idx" ON "Admin"("email");

-- AlterTable (admin add/remove audit rows carry no signup)
ALTER TABLE "AdminActionLog" ALTER COLUMN "signupId" DROP NOT NULL;

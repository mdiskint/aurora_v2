-- OPS-06: Additive audit table recording beta-admin operator actions.
--
-- Records every approve/revoke/reinvite action an operator performs on a
-- BetaSignup row (BETA-14 operator control surface) for an immutable audit
-- trail. Additive only: creates a new `admin_action_log` table and does not
-- alter or drop any existing tables or columns.
--
-- Migration is generated locally and gated from application to the live
-- production database; it is deployed through the board change-control stage.

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionLog_operatorEmail_idx" ON "AdminActionLog"("operatorEmail");

-- CreateIndex
CREATE INDEX "AdminActionLog_signupId_idx" ON "AdminActionLog"("signupId");

-- CreateIndex
CREATE INDEX "AdminActionLog_action_idx" ON "AdminActionLog"("action");

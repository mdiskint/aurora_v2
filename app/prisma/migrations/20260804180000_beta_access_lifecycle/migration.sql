-- BETA-03: Model beta access lifecycle.
--
-- Redesign BetaSignup from a signup row into a full beta-access lifecycle:
--   pending | approved | revoked | redeemed.
--
-- Migration strategy for existing records:
--   Existing auto-created BetaSignup rows were never operator-approved, so they
--   default to `status = 'pending'` (the column default below) and require
--   manual operator approval before access is granted. This is consistent with
--   DEC-01 (public application + manual approval).
--
--   NOTE (BETA-03 P1): This backfills ALL legacy rows to `pending`, including
--   any previously-authorized users. Previously-authorized users MUST be
--   re-approved manually before access is restored. Do NOT auto-approve legacy
--   rows: that would silently regrant access the operator never explicitly
--   authorized in the new lifecycle (security).
--
--   The old raw `inviteToken` column is dropped. Existing raw tokens are NOT
--   carried into `inviteTokenHash`: those invites were never approved and their
--   raw values are not hashed retroactively. New invites store only a SHA-256
--   hash so a database leak can never mint usable invite links.
--
--   `updatedAt` is added as nullable, backfilled from `createdAt` for existing
--   rows, then constrained NOT NULL so existing rows always carry a value.

-- DropIndex
DROP INDEX "BetaSignup_inviteToken_key";

-- AlterTable: drop raw token; add lifecycle state + timestamps.
-- `updatedAt` is added nullable first so existing rows can be backfilled.
ALTER TABLE "BetaSignup" DROP COLUMN "inviteToken",
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "inviteTokenHash" TEXT,
ADD COLUMN "invitedEmail" TEXT,
ADD COLUMN "redeemedAt" TIMESTAMP(3),
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill existing rows, then enforce NOT NULL.
UPDATE "BetaSignup" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "BetaSignup" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BetaSignup_inviteTokenHash_key" ON "BetaSignup"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "BetaSignup_status_idx" ON "BetaSignup"("status");
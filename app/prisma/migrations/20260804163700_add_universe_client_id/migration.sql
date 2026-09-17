-- BETA-05: Make universe cloud CRUD owner-safe.
--
-- Adds a per-user client id to the Universe table so clients can address
-- their own universes by a composite (userId, clientId) key instead of the
-- global server id. The server-owned `id` column becomes an auto-generated
-- cuid (Prisma-level default; no DB default change is required).
--
-- This migration is NOT applied to any production database. It is produced
-- locally only. Production application is gated to the deployment stage
-- (BETA-13) per board policy, with backup and rollback evidence.

-- 1. Add the clientId column as nullable so existing rows can be backfilled.
ALTER TABLE "Universe" ADD COLUMN "clientId" TEXT;

-- 2. Backfill existing rows: their legacy client-controlled id already holds
--    the client universe key, so preserve it as the per-user client id.
--    Existing rows keep their prior id value; new rows get a cuid via Prisma.
UPDATE "Universe" SET "clientId" = "id" WHERE "clientId" IS NULL;

-- 3. Enforce NOT NULL now that legacy rows are backfilled.
ALTER TABLE "Universe" ALTER COLUMN "clientId" SET NOT NULL;

-- 4. Unique composite key scopes a client id to a single user, so a client
--    id can never collide across users and cannot be used to address another
--    user's universe.
CREATE UNIQUE INDEX "Universe_userId_clientId_key" ON "Universe"("userId", "clientId");
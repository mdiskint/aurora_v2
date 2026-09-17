-- BETA-08: Bind Blob uploads and video analysis to owner.
--
-- Adds an `Upload` metadata table so Vercel Blob uploads can be bound to the
-- owning user. Each upload carries an opaque, user-scoped pathname, a
-- lifecycle state (pending -> processing -> done), and an expiry. The
-- analysis route only ever fetches/deletes a blob whose pathname matches the
-- current user's pending upload record, which removes the pre-existing SSRF
-- path (analyze-video previously fetched an arbitrary client-supplied URL).
--
-- This migration is NOT applied to any production database. It is produced
-- locally only. Production application is gated to the deployment stage
-- (BETA-13) per board policy, with backup and rollback evidence.

-- The row id IS the client-generated v4 uploadId (opaque, non-enumerable), so
-- it is the primary key and never auto-generated.
CREATE TABLE "Upload" (
    "id"          TEXT      NOT NULL,
    "userId"      TEXT      NOT NULL,
    "pathname"    TEXT      NOT NULL,
    "url"         TEXT,
    "contentType" TEXT,
    "sizeBytes"   INTEGER,
    "state"       TEXT      NOT NULL DEFAULT 'pending',
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    -- Owner cascade mirrors the other user-scoped tables (Universe, Session).
    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- Every read/write is scoped to the owning user; index so owner lookups are
-- fast and a foreign key cannot be moved to a different owner.
CREATE INDEX "Upload_userId_idx" ON "Upload"("userId");

-- A pathname is unique per user, so a non-owner can never address another
-- user's blob by guessing a pathname.
CREATE UNIQUE INDEX "Upload_userId_pathname_key" ON "Upload"("userId", "pathname");

-- Enforce the owner foreign key (cascade delete removes orphaned upload
-- metadata when the user is deleted).
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
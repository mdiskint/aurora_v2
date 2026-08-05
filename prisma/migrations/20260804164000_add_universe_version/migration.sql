-- BETA-05 P1: clock-skew-robust optimistic concurrency.
--
-- Adds a server-owned `version` integer to the Universe table so conflict
-- detection never compares client-clock timestamps against server-clock
-- timestamps. The server increments the version on every write and echoes it;
-- the client submits the version it last observed on the next write, and the
-- server rejects only when the submitted version is older than its recorded
-- version.
--
-- This migration is NOT applied to any production database. It is produced
-- locally only. Production application is gated to the deployment stage
-- (BETA-13) per board policy, with backup and rollback evidence.

-- Every existing row starts at version 1 by default; new rows also default
-- to 1. No backfill is required because the version is only ever compared
-- against the client's echoed value, and a fresh/legacy client that sends no
-- version is treated as non-conflicting.
ALTER TABLE "Universe" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
-- Backfill missing timestamp columns on `phonemes`.
-- Older envs that had a hand-built `phonemes` table predating the
-- 0028 migration kept that older shape because 0028 used
-- CREATE TABLE IF NOT EXISTS — leaving created_at/updated_at absent.
-- This makes those envs match the schema Drizzle expects.

ALTER TABLE phonemes
	ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

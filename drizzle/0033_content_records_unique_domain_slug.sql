-- ============================================================================
-- Make (domain, slug) globally unique on content_records.
--
-- Replaces the (domain, COALESCE(parent_path, ''), slug) unique index which
-- allowed two records with the same (domain, slug) under different parents —
-- inconsistent with how cross-domain link resolution looks records up.
--
-- Run scripts/audit-content-record-collisions.ts and resolve any collisions
-- before applying this migration.
-- ============================================================================

DROP INDEX IF EXISTS idx_cr_unique_slug;
DROP INDEX IF EXISTS idx_cr_domain_slug;

CREATE UNIQUE INDEX uq_cr_domain_slug ON content_records(domain, LOWER(slug));

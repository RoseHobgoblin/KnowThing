-- Wordbook integrity: back every app-level uniqueness rule with a real DB
-- constraint, and let revision history survive entry deletion.
-- Each constraint is preceded by a dedup pass so the migration cannot fail on
-- pre-existing violations (newest row wins, matching the app's last-wins reads).

-- ── 1. Homographs: case-insensitive uniqueness ────────────────────────────────
-- The app's homograph check is case-insensitive but the old unique index was
-- case-sensitive, so the DB never actually enforced the invariant.
-- Canonically renumber every (language, word-CI) group 1..n (also closes gaps
-- left by deletions — homograph numbers are display labels, not stable ids).
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY language_id, LOWER(word)
               ORDER BY homograph_number, id
           ) AS rn
    FROM lexicon
)
UPDATE lexicon l
SET homograph_number = r.rn
FROM ranked r
WHERE l.id = r.id AND l.homograph_number <> r.rn;

-- The old identity was a table CONSTRAINT (case-sensitive); the CI replacement
-- is an expression index, which constraints can't express.
ALTER TABLE lexicon DROP CONSTRAINT IF EXISTS lexicon_word_lang_hom_unique;
DROP INDEX IF EXISTS lexicon_word_lang_hom_unique;
CREATE UNIQUE INDEX IF NOT EXISTS lexicon_word_lang_hom_ci_unique
    ON lexicon (language_id, LOWER(word), homograph_number);

-- ── 2. Paradigm rules: one pattern per (class, cell) ─────────────────────────
DELETE FROM paradigm_rules a
USING paradigm_rules b
WHERE a.class_id = b.class_id AND a.cell_key = b.cell_key AND a.id < b.id;

ALTER TABLE paradigm_rules
    ADD CONSTRAINT uq_paradigm_rules_class_cell UNIQUE (class_id, cell_key);

-- ── 3. Inflected forms: one row per (entry, cell) ────────────────────────────
DELETE FROM inflected_forms a
USING inflected_forms b
WHERE a.entry_id = b.entry_id AND a.cell_key = b.cell_key AND a.id < b.id;

ALTER TABLE inflected_forms
    ADD CONSTRAINT uq_inflected_forms_entry_cell UNIQUE (entry_id, cell_key);

-- ── 4. Relations: no duplicate edges ─────────────────────────────────────────
DELETE FROM lexicon_relations a
USING lexicon_relations b
WHERE a.source_id = b.source_id
  AND a.target_id = b.target_id
  AND a.relation_type = b.relation_type
  AND a.id < b.id;

ALTER TABLE lexicon_relations
    ADD CONSTRAINT uq_lexicon_relations_edge UNIQUE (source_id, target_id, relation_type);

-- ── 5. Variants: one per (entry, dialect) ────────────────────────────────────
DELETE FROM lexicon_variants a
USING lexicon_variants b
WHERE a.entry_id = b.entry_id AND a.dialect_id = b.dialect_id AND a.id < b.id;

ALTER TABLE lexicon_variants
    ADD CONSTRAINT uq_lexicon_variants_entry_dialect UNIQUE (entry_id, dialect_id);

-- ── 6. Dialect slugs: unique per language ────────────────────────────────────
UPDATE language_dialects d
SET slug = d.slug || '-' || d.id
WHERE EXISTS (
    SELECT 1 FROM language_dialects x
    WHERE x.language_id = d.language_id AND x.slug = d.slug AND x.id < d.id
);

ALTER TABLE language_dialects
    ADD CONSTRAINT uq_language_dialects_lang_slug UNIQUE (language_id, slug);

-- ── 7. Revisions survive entry deletion ──────────────────────────────────────
-- Previously ON DELETE CASCADE: deleting an entry destroyed its own audit
-- trail. Now the FK detaches instead; the snapshot JSON retains the old id,
-- word, and language for forensic/undelete purposes.
ALTER TABLE lexicon_revisions ALTER COLUMN entry_id DROP NOT NULL;
ALTER TABLE lexicon_revisions DROP CONSTRAINT IF EXISTS lexicon_revisions_entry_id_fkey;
ALTER TABLE lexicon_revisions
    ADD CONSTRAINT lexicon_revisions_entry_id_fkey
    FOREIGN KEY (entry_id) REFERENCES lexicon(id) ON DELETE SET NULL;

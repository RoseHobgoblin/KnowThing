-- Drop columns that no code path has ever read or written:
--  - lexicon.description: added speculatively, never used (entry prose lives
--    in lexicon.body; sense text lives in definitions.definition)
--  - definitions.dialect_id: dialect variance is modeled by lexicon_variants;
--    no endpoint ever populated this column
ALTER TABLE lexicon DROP COLUMN IF EXISTS description;
ALTER TABLE definitions DROP COLUMN IF EXISTS dialect_id;

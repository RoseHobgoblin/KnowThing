-- ============================================================================
-- Guard the phoneme inventory and orthography against silent duplicate rows.
--
-- Neither table had a natural-key constraint, so a re-run of a seed script (or
-- a double POST) could silently insert a second copy of a phoneme or grapheme.
-- The inventory grid would then render every sound/letter twice, with no error
-- to catch it — the bug only surfaces as a wrong-looking page. A set-valued
-- inventory needs a set constraint.
--
--   phonemes: a language cannot list the same IPA segment twice.
--   graphemes: a language cannot list the same letter twice IN THE SAME
--     environment. `environment` is nullable and compared NULLS NOT DISTINCT,
--     so two unqualified (NULL-environment) copies now collide, while the same
--     letter in genuinely different environments (e.g. context-dependent
--     spellings) remains allowed.
--
-- No existing rows violate these (verified before writing); the seeds already
-- DELETE-before-INSERT, so this is a belt-and-suspenders guard at the DB layer.
-- ============================================================================

ALTER TABLE phonemes
	ADD CONSTRAINT uq_phonemes_lang_ipa UNIQUE (language_id, ipa);

ALTER TABLE graphemes
	ADD CONSTRAINT uq_graphemes_lang_grapheme_env
	UNIQUE NULLS NOT DISTINCT (language_id, grapheme, environment);

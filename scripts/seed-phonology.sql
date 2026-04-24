-- Seed a realistic phoneme inventory for one existing language.
-- Defaults to the language with slug 'oncheran' — change :lang_slug below
-- (or re-use the DO block) if the target language has a different slug.
--
-- Run with:
--   docker compose exec -T db psql -U knowthing -d knowthing -v lang_slug=<slug> < scripts/seed-phonology.sql
-- Or edit the variable directly and run:
--   psql $DATABASE_URL < scripts/seed-phonology.sql

DO $$
DECLARE
	lang_id INT;
	target_slug TEXT := 'oncerhan';  -- change me if needed
BEGIN
	SELECT id INTO lang_id FROM languages WHERE slug = target_slug;
	IF lang_id IS NULL THEN
		RAISE NOTICE 'Language with slug "%" not found. Pick an existing language and edit target_slug.', target_slug;
		RETURN;
	END IF;

	-- Wipe any prior seed for this language so the script is idempotent
	DELETE FROM phonemes WHERE language_id = lang_id;

	-- Consonants (sort_order drives column appearance order in the grid)
	INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, sort_order, notes) VALUES
		(lang_id, 'p', 'consonant', 'bilabial',     'plosive',              'voiceless', 10, NULL),
		(lang_id, 'b', 'consonant', 'bilabial',     'plosive',              'voiced',    11, NULL),
		(lang_id, 't', 'consonant', 'alveolar',     'plosive',              'voiceless', 20, NULL),
		(lang_id, 'd', 'consonant', 'alveolar',     'plosive',              'voiced',    21, NULL),
		(lang_id, 'k', 'consonant', 'velar',        'plosive',              'voiceless', 30, NULL),
		(lang_id, 'ɡ', 'consonant', 'velar',        'plosive',              'voiced',    31, NULL),
		(lang_id, 'ʔ', 'consonant', 'glottal',      'plosive',              'voiceless', 40, 'only at end of syllable'),
		(lang_id, 'm', 'consonant', 'bilabial',     'nasal',                'voiced',    50, NULL),
		(lang_id, 'n', 'consonant', 'alveolar',     'nasal',                'voiced',    51, NULL),
		(lang_id, 'ŋ', 'consonant', 'velar',        'nasal',                'voiced',    52, NULL),
		(lang_id, 'f', 'consonant', 'labiodental',  'fricative',            'voiceless', 60, NULL),
		(lang_id, 'v', 'consonant', 'labiodental',  'fricative',            'voiced',    61, NULL),
		(lang_id, 's', 'consonant', 'alveolar',     'fricative',            'voiceless', 62, NULL),
		(lang_id, 'z', 'consonant', 'alveolar',     'fricative',            'voiced',    63, NULL),
		(lang_id, 'ʃ', 'consonant', 'postalveolar', 'fricative',            'voiceless', 64, NULL),
		(lang_id, 'h', 'consonant', 'glottal',      'fricative',            'voiceless', 65, NULL),
		(lang_id, 'r', 'consonant', 'alveolar',     'trill',                'voiced',    70, 'realized as [ɾ] between vowels'),
		(lang_id, 'l', 'consonant', 'alveolar',     'lateral approximant',  'voiced',    80, NULL),
		(lang_id, 'j', 'consonant', 'palatal',      'approximant',          'voiced',    90, NULL),
		(lang_id, 'w', 'consonant', 'labial-velar', 'approximant',          'voiced',    91, NULL);

	-- Vowels
	INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order) VALUES
		(lang_id, 'i', 'vowel', 'close',    'front',   false, 10),
		(lang_id, 'u', 'vowel', 'close',    'back',    true,  11),
		(lang_id, 'e', 'vowel', 'close-mid','front',   false, 20),
		(lang_id, 'o', 'vowel', 'close-mid','back',    true,  21),
		(lang_id, 'a', 'vowel', 'open',     'central', false, 30);

	RAISE NOTICE 'Seeded phonemes for % (language_id=%)', target_slug, lang_id;
END $$;

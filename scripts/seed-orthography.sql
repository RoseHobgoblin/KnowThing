-- Seed orthography (graphemes + grapheme→phoneme links) for Oncerhan.
-- Idempotent: wipes prior graphemes for the language before re-inserting.
-- Requires seed-phonology.sql to have run (grapheme phonemes reference it).
--
-- Run with:
--   docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-orthography.sql

DO $$
DECLARE
	lang_id INT;
	target_slug TEXT := 'oncerhan';

	-- Phoneme id lookups (seed-phonology.sql IPAs).
	p_p INT; p_b INT; p_t INT; p_d INT; p_k INT; p_g INT;
	p_m INT; p_n INT; p_ng INT;
	p_f INT; p_v INT; p_s INT; p_z INT; p_sh INT; p_h INT; p_theta INT;
	p_r INT; p_l INT; p_j INT; p_w INT; p_glottal INT;
	p_i INT; p_u INT; p_e INT; p_o INT; p_a INT;

	-- Grapheme ids for linking.
	g_th INT; g_c_k INT; g_c_s INT; g_h_silent INT; g_ka INT;
BEGIN
	SELECT id INTO lang_id FROM languages WHERE slug = target_slug;
	IF lang_id IS NULL THEN
		RAISE NOTICE 'Language with slug "%" not found. Seed phonology first.', target_slug;
		RETURN;
	END IF;

	-- Wipe any prior seed (grapheme_phonemes cascades via FK).
	DELETE FROM graphemes WHERE language_id = lang_id;

	-- Resolve phoneme ids (may be NULL if phonology hasn't been seeded; we NULL-check below).
	SELECT id INTO p_p  FROM phonemes WHERE language_id = lang_id AND ipa = 'p';
	SELECT id INTO p_b  FROM phonemes WHERE language_id = lang_id AND ipa = 'b';
	SELECT id INTO p_t  FROM phonemes WHERE language_id = lang_id AND ipa = 't';
	SELECT id INTO p_d  FROM phonemes WHERE language_id = lang_id AND ipa = 'd';
	SELECT id INTO p_k  FROM phonemes WHERE language_id = lang_id AND ipa = 'k';
	SELECT id INTO p_g  FROM phonemes WHERE language_id = lang_id AND ipa = 'ɡ';
	SELECT id INTO p_m  FROM phonemes WHERE language_id = lang_id AND ipa = 'm';
	SELECT id INTO p_n  FROM phonemes WHERE language_id = lang_id AND ipa = 'n';
	SELECT id INTO p_f  FROM phonemes WHERE language_id = lang_id AND ipa = 'f';
	SELECT id INTO p_v  FROM phonemes WHERE language_id = lang_id AND ipa = 'v';
	SELECT id INTO p_s  FROM phonemes WHERE language_id = lang_id AND ipa = 's';
	SELECT id INTO p_z  FROM phonemes WHERE language_id = lang_id AND ipa = 'z';
	SELECT id INTO p_sh FROM phonemes WHERE language_id = lang_id AND ipa = 'ʃ';
	SELECT id INTO p_h  FROM phonemes WHERE language_id = lang_id AND ipa = 'h';
	SELECT id INTO p_r  FROM phonemes WHERE language_id = lang_id AND ipa = 'r';
	SELECT id INTO p_l  FROM phonemes WHERE language_id = lang_id AND ipa = 'l';
	SELECT id INTO p_j  FROM phonemes WHERE language_id = lang_id AND ipa = 'j';
	SELECT id INTO p_w  FROM phonemes WHERE language_id = lang_id AND ipa = 'w';
	SELECT id INTO p_glottal FROM phonemes WHERE language_id = lang_id AND ipa = 'ʔ';
	SELECT id INTO p_i  FROM phonemes WHERE language_id = lang_id AND ipa = 'i';
	SELECT id INTO p_u  FROM phonemes WHERE language_id = lang_id AND ipa = 'u';
	SELECT id INTO p_e  FROM phonemes WHERE language_id = lang_id AND ipa = 'e';
	SELECT id INTO p_o  FROM phonemes WHERE language_id = lang_id AND ipa = 'o';
	SELECT id INTO p_a  FROM phonemes WHERE language_id = lang_id AND ipa = 'a';

	-- Insert graphemes. sort_order values are spaced so manual reorder shows up clearly.
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'a', 10);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'b', 20);
	-- Context-dependent "c" → two rows, same grapheme, different environments.
	INSERT INTO graphemes (language_id, grapheme, environment, sort_order) VALUES
		(lang_id, 'c', 'before a/o/u', 30) RETURNING id INTO g_c_k;
	INSERT INTO graphemes (language_id, grapheme, environment, sort_order) VALUES
		(lang_id, 'c', 'before e/i', 31)   RETURNING id INTO g_c_s;
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'd', 40);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'e', 50);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'f', 60);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'g', 70);
	-- Silent h (zero phoneme links).
	INSERT INTO graphemes (language_id, grapheme, environment, notes, sort_order) VALUES
		(lang_id, 'h', 'word-initial', 'silent in native vocabulary', 80) RETURNING id INTO g_h_silent;
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'i', 90);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'l', 100);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'm', 110);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'n', 120);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'o', 130);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'p', 140);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'r', 150);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 's', 160);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 't', 170);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'u', 180);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'v', 190);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'w', 200);
	INSERT INTO graphemes (language_id, grapheme, sort_order) VALUES (lang_id, 'z', 210);

	-- Digraph "th" (single phoneme).
	INSERT INTO graphemes (language_id, grapheme, romanization, sort_order) VALUES
		(lang_id, 'th', 's', 220) RETURNING id INTO g_th;
	-- Digraph "sh".
	INSERT INTO graphemes (language_id, grapheme, romanization, sort_order) VALUES
		(lang_id, 'sh', 's', 230);
	-- A token syllabary-style grapheme that maps to TWO phonemes in sequence.
	-- Exercises the many-to-many ordered join path end-to-end.
	INSERT INTO graphemes (language_id, grapheme, romanization, notes, sort_order) VALUES
		(lang_id, 'か', 'ka', 'loanword marker — maps to /ka/ as a single written unit', 240)
		RETURNING id INTO g_ka;

	-- ---- Links (ordered) ----
	-- Single-phoneme alphabetic rows
	IF p_a IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_a, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'a'; END IF;
	IF p_b IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_b, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'b'; END IF;
	IF p_d IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_d, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'd'; END IF;
	IF p_e IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_e, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'e'; END IF;
	IF p_f IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_f, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'f'; END IF;
	IF p_g IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_g, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'g'; END IF;
	IF p_i IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_i, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'i'; END IF;
	IF p_l IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_l, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'l'; END IF;
	IF p_m IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_m, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'm'; END IF;
	IF p_n IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_n, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'n'; END IF;
	IF p_o IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_o, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'o'; END IF;
	IF p_p IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_p, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'p'; END IF;
	IF p_r IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_r, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'r'; END IF;
	IF p_s IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_s, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 's'; END IF;
	IF p_t IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_t, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 't'; END IF;
	IF p_u IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_u, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'u'; END IF;
	IF p_v IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_v, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'v'; END IF;
	IF p_w IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_w, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'w'; END IF;
	IF p_z IS NOT NULL THEN INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
		SELECT id, p_z, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'z'; END IF;

	-- Context-dependent "c" splits: /k/ before back vowels, /s/ before front vowels.
	IF p_k IS NOT NULL THEN
		INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position) VALUES (g_c_k, p_k, 0);
	END IF;
	IF p_s IS NOT NULL THEN
		INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position) VALUES (g_c_s, p_s, 0);
	END IF;

	-- Silent "h": NO rows in grapheme_phonemes (represents silent/punctuation).
	-- Deliberately no INSERT for g_h_silent.

	-- Digraphs
	IF p_s IS NOT NULL THEN
		INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position) VALUES (g_th, p_s, 0);
	END IF;
	IF p_sh IS NOT NULL THEN
		INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
			SELECT id, p_sh, 0 FROM graphemes WHERE language_id = lang_id AND grapheme = 'sh';
	END IF;

	-- Multi-phoneme grapheme か → /k/ + /a/ in order.
	IF p_k IS NOT NULL AND p_a IS NOT NULL THEN
		INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position) VALUES
			(g_ka, p_k, 0),
			(g_ka, p_a, 1);
	END IF;

	RAISE NOTICE 'Seeded orthography for % (language_id=%)', target_slug, lang_id;
END $$;

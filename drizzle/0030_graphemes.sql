-- Orthography: how a language's sounds are written.
-- Grapheme→phoneme is a many-to-many ORDERED relation so syllabaries
-- (か → /k/+/a/) and abugidas (कि → /k/+/i/) are first-class. Alphabets
-- are the degenerate one-phoneme-per-grapheme case.
--
-- Silent letters = zero rows in grapheme_phonemes, not a nullable FK.
-- Duplicate grapheme strings are intentional: "c" → /k/ before a/o/u AND
-- "c" → /s/ before e/i are two distinct rows with different `environment`.

CREATE TABLE IF NOT EXISTS graphemes (
	id SERIAL PRIMARY KEY,
	language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
	grapheme TEXT NOT NULL,
	romanization TEXT,
	environment TEXT,
	notes TEXT,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graphemes_language
	ON graphemes(language_id, sort_order);

CREATE TABLE IF NOT EXISTS grapheme_phonemes (
	grapheme_id INTEGER NOT NULL REFERENCES graphemes(id) ON DELETE CASCADE,
	phoneme_id  INTEGER NOT NULL REFERENCES phonemes(id)  ON DELETE CASCADE,
	position    INTEGER NOT NULL,
	PRIMARY KEY (grapheme_id, position)
);

CREATE INDEX IF NOT EXISTS idx_grapheme_phonemes_phoneme
	ON grapheme_phonemes(phoneme_id);

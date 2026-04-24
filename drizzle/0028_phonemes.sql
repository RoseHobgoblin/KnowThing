-- Phonology: per-language phoneme inventories.
-- Freeform text for place/manner/height/backness so conlangs can invent
-- categories ("alveolo-palatal", "labial-velar", "denti-alveolar", ...).
-- The grid renderer derives axes from distinct values present in the data.

CREATE TABLE IF NOT EXISTS phonemes (
	id SERIAL PRIMARY KEY,
	language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
	ipa TEXT NOT NULL,
	type TEXT NOT NULL,
	place TEXT,
	manner TEXT,
	subtype TEXT,
	voicing TEXT,
	height TEXT,
	backness TEXT,
	rounded BOOLEAN,
	notes TEXT,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT phonemes_type_check CHECK (type IN ('consonant', 'vowel', 'diphthong', 'special'))
);

CREATE INDEX IF NOT EXISTS idx_phonemes_language_type
	ON phonemes(language_id, type, sort_order);

-- Phoneme inventory for languages (Phase 1 of structured data)
CREATE TABLE IF NOT EXISTS phonemes (
    id SERIAL PRIMARY KEY,
    language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    ipa TEXT NOT NULL,
    type TEXT NOT NULL,          -- 'consonant' | 'vowel' | 'diphthong' | 'special'

    -- Consonant features
    place TEXT,                  -- bilabial, alveolar, velar, etc.
    manner TEXT,                 -- plosive, nasal, fricative, etc.
    subtype TEXT,                -- plain, tense, aspirated (for sub-rows)
    voicing TEXT,                -- voiced, voiceless

    -- Vowel features
    height TEXT,                 -- close, mid, open, etc.
    backness TEXT,               -- front, central, back, etc.
    rounded BOOLEAN DEFAULT FALSE,

    notes TEXT,                  -- footnote text for allophonic rules etc.
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_phonemes_language ON phonemes(language_id);
CREATE INDEX IF NOT EXISTS idx_phonemes_type ON phonemes(language_id, type);

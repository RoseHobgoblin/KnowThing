-- Lexicon revision history
CREATE TABLE IF NOT EXISTS lexicon_revisions (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    edit_summary TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lexrev_entry ON lexicon_revisions(entry_id);

-- Homograph support: allow multiple entries for same word+language
ALTER TABLE lexicon DROP CONSTRAINT IF EXISTS lexicon_word_language_unique;
ALTER TABLE lexicon ADD COLUMN IF NOT EXISTS homograph_number INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lexicon_word_lang_hom_unique'
    ) THEN
        ALTER TABLE lexicon ADD CONSTRAINT lexicon_word_lang_hom_unique UNIQUE(word, language_id, homograph_number);
    END IF;
END $$;

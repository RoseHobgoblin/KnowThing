-- Language ancestry: self-referencing FK
ALTER TABLE languages ADD COLUMN IF NOT EXISTS parent_language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL;
ALTER TABLE languages ADD COLUMN IF NOT EXISTS language_type TEXT NOT NULL DEFAULT 'language';
CREATE INDEX IF NOT EXISTS idx_languages_parent ON languages(parent_language_id);

-- Dialects: regional variants WITHIN a language
CREATE TABLE IF NOT EXISTS language_dialects (
    id SERIAL PRIMARY KEY,
    language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    region TEXT,
    description TEXT,
    UNIQUE(language_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_dialects_language ON language_dialects(language_id);

-- Dialect-specific pronunciation/spelling variants per entry
CREATE TABLE IF NOT EXISTS lexicon_variants (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    dialect_id INTEGER NOT NULL REFERENCES language_dialects(id) ON DELETE CASCADE,
    pronunciation TEXT,
    spelling TEXT,
    notes TEXT,
    UNIQUE(entry_id, dialect_id)
);
CREATE INDEX IF NOT EXISTS idx_variants_entry ON lexicon_variants(entry_id);

-- Definitions can be dialect-restricted
ALTER TABLE definitions ADD COLUMN IF NOT EXISTS dialect_id INTEGER REFERENCES language_dialects(id) ON DELETE SET NULL;

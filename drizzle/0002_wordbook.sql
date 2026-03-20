-- Languages as first-class entities
CREATE TABLE languages (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    native_name TEXT,
    script TEXT DEFAULT 'Latin',
    family TEXT,
    color TEXT DEFAULT '#d97706',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per word-sense
CREATE TABLE lexicon (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL,
    language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    pronunciation TEXT,
    part_of_speech TEXT,
    definition TEXT NOT NULL,
    etymology TEXT,
    usage_example TEXT,
    usage_translation TEXT,
    notes TEXT,
    page_slug TEXT,
    tags TEXT[] DEFAULT '{}',
    related TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(word, language_id, definition)
);

CREATE INDEX idx_lexicon_word ON lexicon(word);
CREATE INDEX idx_lexicon_language ON lexicon(language_id);
CREATE INDEX idx_lexicon_tags ON lexicon USING GIN(tags);

-- Trigram index for fuzzy/prefix search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_lexicon_word_trgm ON lexicon USING GIN(word gin_trgm_ops);

-- Full-text search on word + definition + etymology
ALTER TABLE lexicon ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(word, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(definition, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(etymology, '')), 'C')
    ) STORED;
CREATE INDEX idx_lexicon_search ON lexicon USING GIN(search_vector);

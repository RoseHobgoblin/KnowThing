-- Create definitions table
CREATE TABLE IF NOT EXISTS definitions (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    sense_number INTEGER NOT NULL DEFAULT 1,
    part_of_speech TEXT,
    definition TEXT NOT NULL,
    usage_example TEXT,
    usage_translation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entry_id, sense_number)
);

CREATE INDEX IF NOT EXISTS idx_definitions_entry ON definitions(entry_id);

-- FTS on definitions
ALTER TABLE definitions ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(definition, '')), 'A')
    ) STORED;
CREATE INDEX IF NOT EXISTS idx_definitions_search ON definitions USING GIN(search_vector);

-- Migrate existing data: copy definition/pos/usage from lexicon rows into definitions
INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition, usage_example, usage_translation)
SELECT id, 1, part_of_speech, definition, usage_example, usage_translation
FROM lexicon
WHERE definition IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop the generated search_vector column (references definition column we're about to drop)
ALTER TABLE lexicon DROP COLUMN IF EXISTS search_vector;

-- Drop old unique constraint
ALTER TABLE lexicon DROP CONSTRAINT IF EXISTS lexicon_word_language_id_definition_key;

-- Drop migrated columns from lexicon
ALTER TABLE lexicon DROP COLUMN IF EXISTS definition;
ALTER TABLE lexicon DROP COLUMN IF EXISTS part_of_speech;
ALTER TABLE lexicon DROP COLUMN IF EXISTS usage_example;
ALTER TABLE lexicon DROP COLUMN IF EXISTS usage_translation;
ALTER TABLE lexicon DROP COLUMN IF EXISTS related;

-- Add new unique constraint: one headword per language
-- (homographs with truly different origins should use a disambiguator in notes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lexicon_word_language_unique'
    ) THEN
        ALTER TABLE lexicon ADD CONSTRAINT lexicon_word_language_unique UNIQUE(word, language_id);
    END IF;
END $$;

-- Rebuild FTS on lexicon as a regular column + trigger
ALTER TABLE lexicon ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION lexicon_search_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.word, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.etymology, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT string_agg(definition, ' ') FROM definitions WHERE entry_id = NEW.id), ''
        )), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lexicon_search ON lexicon;
CREATE TRIGGER trg_lexicon_search
    BEFORE INSERT OR UPDATE ON lexicon
    FOR EACH ROW EXECUTE FUNCTION lexicon_search_update();

-- When definitions change, touch the parent lexicon row to re-trigger search vector
CREATE OR REPLACE FUNCTION definitions_touch_parent() RETURNS trigger AS $$
BEGIN
    UPDATE lexicon SET updated_at = NOW() WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_definitions_touch ON definitions;
CREATE TRIGGER trg_definitions_touch
    AFTER INSERT OR UPDATE OR DELETE ON definitions
    FOR EACH ROW EXECUTE FUNCTION definitions_touch_parent();

-- Rebuild all search vectors
CREATE INDEX IF NOT EXISTS idx_lexicon_search ON lexicon USING GIN(search_vector);
UPDATE lexicon SET updated_at = NOW();

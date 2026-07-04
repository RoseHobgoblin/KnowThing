-- Extend lexicon FTS coverage: pronunciation (weight C) and the wiki body's
-- plain text (weight D) join word (A), definitions (B), and etymology (C).
-- Previously entry prose was findable in scope=all (via the pages union) but
-- invisible to scope=wordbook — inconsistent by scope — and pronunciation was
-- searchable nowhere.

CREATE OR REPLACE FUNCTION lexicon_search_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.word, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT string_agg(definition, ' ') FROM definitions WHERE entry_id = NEW.id), ''
        )), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.etymology, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(NEW.pronunciation, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(NEW.body_plain_text, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-fire the trigger on every row to backfill the extended vectors.
UPDATE lexicon SET updated_at = updated_at;

-- New columns on media
ALTER TABLE media ADD COLUMN IF NOT EXISTS hash TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id);
ALTER TABLE media ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS has_thumb_150 BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS has_thumb_300 BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS has_thumb_600 BOOLEAN DEFAULT FALSE;

-- Media upload history
CREATE TABLE IF NOT EXISTS media_history (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_history_filename ON media_history(filename);

-- Media categories
CREATE TABLE IF NOT EXISTS media_categories (
    filename TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (filename, category)
);

CREATE INDEX IF NOT EXISTS idx_media_categories_cat ON media_categories(category);

-- FTS on media filename + description
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'media' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE media ADD COLUMN search_vector tsvector
            GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(filename, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')
            ) STORED;
        CREATE INDEX idx_media_search ON media USING GIN(search_vector);
    END IF;
END $$;

-- Users & Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Pages & Revisions
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    plain_text TEXT NOT NULL DEFAULT '',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_updated ON pages(updated_at);

-- Full-text search
ALTER TABLE pages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(plain_text, '')), 'B')
    ) STORED;

CREATE INDEX idx_pages_search ON pages USING GIN(search_vector);

CREATE TABLE revisions (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    page_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    edit_summary TEXT DEFAULT '',
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revisions_page ON revisions(page_slug);
CREATE INDEX idx_revisions_date ON revisions(created_at);

-- Templates
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    description TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calendars
CREATE TABLE calendars (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    static_data JSONB NOT NULL,
    calendar_date JSONB NOT NULL
);

-- Link & Category tracking
CREATE TABLE links (
    source_slug TEXT NOT NULL,
    target_slug TEXT NOT NULL,
    PRIMARY KEY (source_slug, target_slug)
);

CREATE INDEX idx_links_target ON links(target_slug);

CREATE TABLE categories (
    page_slug TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (page_slug, category)
);

CREATE INDEX idx_categories_cat ON categories(category);

-- Media
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    filepath TEXT NOT NULL,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE media_usage (
    page_slug TEXT NOT NULL,
    filename TEXT NOT NULL,
    PRIMARY KEY (page_slug, filename)
);

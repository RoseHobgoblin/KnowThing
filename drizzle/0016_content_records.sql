-- ============================================================================
-- Unified Content Records — replaces pages as the universal content table
-- ============================================================================

CREATE TABLE content_records (
    id SERIAL PRIMARY KEY,
    domain TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_path TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    plain_text TEXT NOT NULL DEFAULT '',
    parsed_ast JSONB,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_cr_unique_slug ON content_records(domain, COALESCE(parent_path, ''), slug);

ALTER TABLE content_records ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(plain_text, '')), 'B')
    ) STORED;

CREATE INDEX idx_cr_search ON content_records USING GIN(search_vector);
CREATE INDEX idx_cr_domain_slug ON content_records(domain, slug);
CREATE INDEX idx_cr_domain ON content_records(domain);
CREATE INDEX idx_cr_updated ON content_records(updated_at);

-- Unified revisions
CREATE TABLE content_revisions (
    id SERIAL PRIMARY KEY,
    content_record_id INT NOT NULL REFERENCES content_records(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    size_bytes INT NOT NULL DEFAULT 0,
    edit_summary TEXT DEFAULT '',
    user_id INT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crev_record ON content_revisions(content_record_id);
CREATE INDEX idx_crev_date ON content_revisions(created_at);

-- ID-based link tracking
CREATE TABLE content_links (
    source_id INT NOT NULL REFERENCES content_records(id) ON DELETE CASCADE,
    target_domain TEXT NOT NULL,
    target_slug TEXT NOT NULL,
    target_id INT REFERENCES content_records(id) ON DELETE SET NULL,
    PRIMARY KEY (source_id, target_domain, target_slug)
);

CREATE INDEX idx_clinks_target ON content_links(target_id);
CREATE INDEX idx_clinks_target_slug ON content_links(target_domain, target_slug);

-- ID-based categories
CREATE TABLE content_categories (
    content_record_id INT NOT NULL REFERENCES content_records(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (content_record_id, category)
);

CREATE INDEX idx_ccat_cat ON content_categories(category);

-- ID-based media usage
CREATE TABLE content_media_usage (
    content_record_id INT NOT NULL REFERENCES content_records(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    PRIMARY KEY (content_record_id, filename)
);

-- ============================================================================
-- Migrate existing data
-- ============================================================================

-- Copy pages → content_records (domain='know')
INSERT INTO content_records (id, domain, slug, parent_path, title, content, plain_text, parsed_ast, size_bytes, created_at, updated_at)
SELECT id, 'know', slug, NULL, title, content, plain_text, parsed_ast, size_bytes, created_at, updated_at
FROM pages;

SELECT setval('content_records_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM content_records), 1));

-- Copy revisions → content_revisions
INSERT INTO content_revisions (id, content_record_id, title, content, size_bytes, edit_summary, user_id, created_at)
SELECT id, page_id, title, content, size_bytes, edit_summary, user_id, created_at
FROM revisions;

SELECT setval('content_revisions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM content_revisions), 1));

-- Copy links → content_links
INSERT INTO content_links (source_id, target_domain, target_slug, target_id)
SELECT cr_s.id, 'know', l.target_slug, cr_t.id
FROM links l
JOIN content_records cr_s ON cr_s.slug = l.source_slug AND cr_s.domain = 'know'
LEFT JOIN content_records cr_t ON LOWER(cr_t.slug) = LOWER(l.target_slug) AND cr_t.domain = 'know';

-- Copy categories → content_categories
INSERT INTO content_categories (content_record_id, category)
SELECT cr.id, c.category
FROM categories c
JOIN content_records cr ON cr.slug = c.page_slug AND cr.domain = 'know';

-- Copy media_usage → content_media_usage
INSERT INTO content_media_usage (content_record_id, filename)
SELECT cr.id, mu.filename
FROM media_usage mu
JOIN content_records cr ON cr.slug = mu.page_slug AND cr.domain = 'know';

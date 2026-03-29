-- Site-wide configuration (key-value store)
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed defaults
INSERT INTO site_settings (key, value) VALUES
    ('site_name', 'KnowThing'),
    ('site_tagline', 'A collaborative encyclopedia'),
    ('institution_name', 'University of Almisan'),
    ('footer_text', ''),
    ('nav_wiki_label', 'Main Page'),
    ('nav_create_label', 'Create'),
    ('nav_wordbook_label', 'Wordbook'),
    ('nav_calendar_label', 'Calendar'),
    ('nav_search_label', 'Search'),
    ('wordbook_name', 'Wordbook'),
    ('wordbook_enabled', 'true'),
    ('calendar_enabled', 'true'),
    ('text_direction', 'ltr'),
    ('logo_url', '')
ON CONFLICT (key) DO NOTHING;

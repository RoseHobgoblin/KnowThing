-- Star systems: the top-level container for stars and their planets
CREATE TABLE star_systems (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    page_slug TEXT,
    system_type TEXT DEFAULT 'single',  -- 'single', 'binary', 'trinary', 'multiple'
    description TEXT DEFAULT '',
    extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_star_systems_slug ON star_systems(slug);

-- Link stars to their system
ALTER TABLE stars ADD COLUMN system_id INT REFERENCES star_systems(id) ON DELETE SET NULL;
CREATE INDEX idx_stars_system ON stars(system_id);

-- Seed the Sunly system and link existing stars
INSERT INTO star_systems (name, slug, page_slug, system_type)
VALUES ('Sunly system', 'sunly', 'Sunly_system', 'binary');

UPDATE stars SET system_id = (SELECT id FROM star_systems WHERE slug = 'sunly');

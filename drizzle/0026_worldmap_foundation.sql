-- World map and country foundations for PNG-to-SVG map rendering.

CREATE TABLE IF NOT EXISTS world_maps (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT UNIQUE NOT NULL,
	image_filename TEXT NOT NULL,
	image_width INTEGER,
	image_height INTEGER,
	water_hex TEXT NOT NULL DEFAULT '#000000',
	description TEXT DEFAULT '',
	content_record_id INTEGER REFERENCES content_records(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT world_maps_water_hex_format CHECK (water_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_world_maps_slug ON world_maps(slug);

CREATE TABLE IF NOT EXISTS countries (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT UNIQUE NOT NULL,
	page_slug TEXT NOT NULL,
	content_record_id INTEGER REFERENCES content_records(id) ON DELETE SET NULL,
	capital TEXT,
	governance TEXT,
	color TEXT,
	extra JSONB DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT countries_color_hex_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_countries_slug ON countries(slug);
CREATE INDEX IF NOT EXISTS idx_countries_page_slug ON countries(page_slug);

CREATE TABLE IF NOT EXISTS world_map_regions (
	id SERIAL PRIMARY KEY,
	map_id INTEGER NOT NULL REFERENCES world_maps(id) ON DELETE CASCADE,
	country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
	hex_color TEXT NOT NULL,
	label TEXT DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT world_map_regions_hex_color_format CHECK (hex_color ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT world_map_regions_map_hex_unique UNIQUE (map_id, hex_color)
);

CREATE INDEX IF NOT EXISTS idx_world_map_regions_map ON world_map_regions(map_id);
CREATE INDEX IF NOT EXISTS idx_world_map_regions_country ON world_map_regions(country_id);
CREATE INDEX IF NOT EXISTS idx_world_map_regions_hex ON world_map_regions(map_id, hex_color);

CREATE TABLE IF NOT EXISTS world_map_region_geometry (
	id SERIAL PRIMARY KEY,
	region_id INTEGER NOT NULL REFERENCES world_map_regions(id) ON DELETE CASCADE,
	path_data TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_map_region_geometry_region
	ON world_map_region_geometry(region_id, sort_order);

-- Stars table
CREATE TABLE stars (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    page_slug TEXT,

    -- Stellar properties
    spectral_type TEXT,
    mass TEXT,
    radius TEXT,
    luminosity TEXT,
    luminosity_visual TEXT,
    temperature TEXT,
    age TEXT,
    color TEXT,

    -- Orbital (for binary/multiple systems)
    orbital_period TEXT,
    semi_major_axis TEXT,
    semi_major_axis_au DOUBLE PRECISION,
    eccentricity DOUBLE PRECISION,
    periastron TEXT,
    apastron TEXT,

    -- Observation
    apparent_magnitude TEXT,
    angular_diameter TEXT,

    -- System
    companion TEXT,
    parent_star_id INT REFERENCES stars(id) ON DELETE SET NULL,

    -- Overflow
    extra JSONB DEFAULT '{}',

    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stars_slug ON stars(slug);

-- Planetary bodies table (planets, moons, dwarf planets, etc.)
CREATE TABLE planetary_bodies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    body_type TEXT NOT NULL DEFAULT 'planet',
    star_id INT REFERENCES stars(id) ON DELETE SET NULL,
    parent_id INT REFERENCES planetary_bodies(id) ON DELETE SET NULL,
    page_slug TEXT,

    -- Physical
    mass TEXT,
    radius TEXT,
    density TEXT,
    surface_gravity TEXT,
    escape_velocity TEXT,
    temperature TEXT,
    age TEXT,

    -- Composition & atmosphere
    composition TEXT,
    atmosphere TEXT,
    surface_pressure TEXT,

    -- Orbital
    orbital_period TEXT,
    orbital_period_days DOUBLE PRECISION,
    semi_major_axis TEXT,
    semi_major_axis_au DOUBLE PRECISION,
    eccentricity DOUBLE PRECISION,
    inclination DOUBLE PRECISION,

    -- Rotation
    rotation_period TEXT,
    rotation_period_s DOUBLE PRECISION,
    axial_tilt DOUBLE PRECISION,

    -- Observation
    apparent_magnitude TEXT,
    angular_diameter TEXT,
    albedo TEXT,

    -- System
    satellites INT,
    has_rings BOOLEAN DEFAULT FALSE,

    -- Overflow
    extra JSONB DEFAULT '{}',

    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_planetary_bodies_slug ON planetary_bodies(slug);
CREATE INDEX idx_planetary_bodies_star ON planetary_bodies(star_id);
CREATE INDEX idx_planetary_bodies_parent ON planetary_bodies(parent_id);

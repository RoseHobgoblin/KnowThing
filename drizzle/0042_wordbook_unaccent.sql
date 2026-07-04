-- Accent-folded alphabet navigation: "é" buckets under "E", not its own
-- singleton letter. unaccent ships with postgres contrib (present in the
-- postgres:16-alpine image used by both dev and prod compose files).
CREATE EXTENSION IF NOT EXISTS unaccent;

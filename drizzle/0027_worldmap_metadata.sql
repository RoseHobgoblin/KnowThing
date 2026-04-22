ALTER TABLE world_maps
  ADD COLUMN IF NOT EXISTS time_period TEXT,
  ADD COLUMN IF NOT EXISTS event TEXT,
  ADD COLUMN IF NOT EXISTS linked_page_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_world_maps_linked_page_slug
  ON world_maps(linked_page_slug);

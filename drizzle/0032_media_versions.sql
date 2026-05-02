-- Versioned uploads: when a file is replaced, the prior on-disk state is
-- archived here so it can be restored.

CREATE TABLE IF NOT EXISTS media_versions (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  version INTEGER NOT NULL,
  filepath TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  hash TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (filename, version)
);

CREATE INDEX IF NOT EXISTS idx_media_versions_filename ON media_versions(filename);

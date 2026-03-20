-- Add page_slug to languages for linking to wiki articles
ALTER TABLE languages ADD COLUMN page_slug TEXT;

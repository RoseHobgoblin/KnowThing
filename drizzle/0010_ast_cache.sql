-- Add parsed AST cache column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS parsed_ast JSONB;

-- Populate existing pages' ASTs will happen on next edit or via a one-time script

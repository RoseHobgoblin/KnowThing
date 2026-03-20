-- Inflection dimensions: what axes exist for a language+POS
CREATE TABLE IF NOT EXISTS inflection_dimensions (
    id SERIAL PRIMARY KEY,
    language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    part_of_speech TEXT NOT NULL,
    name TEXT NOT NULL,
    dim_values TEXT[] NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(language_id, part_of_speech, name)
);
CREATE INDEX IF NOT EXISTS idx_infl_dim_lang ON inflection_dimensions(language_id, part_of_speech);

-- Paradigm classes: named rule sets per language+POS
CREATE TABLE IF NOT EXISTS paradigm_classes (
    id SERIAL PRIMARY KEY,
    language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    part_of_speech TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE(language_id, part_of_speech, name)
);

-- Paradigm rules: one per cell in the inflection grid
CREATE TABLE IF NOT EXISTS paradigm_rules (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES paradigm_classes(id) ON DELETE CASCADE,
    cell_key TEXT NOT NULL,
    pattern TEXT NOT NULL,
    UNIQUE(class_id, cell_key)
);
CREATE INDEX IF NOT EXISTS idx_paradigm_rules_class ON paradigm_rules(class_id);

-- Per-entry inflection assignment
CREATE TABLE IF NOT EXISTS lexicon_inflections (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES paradigm_classes(id) ON DELETE SET NULL,
    stem TEXT,
    overrides JSONB DEFAULT '{}',
    UNIQUE(entry_id)
);
CREATE INDEX IF NOT EXISTS idx_lex_infl_entry ON lexicon_inflections(entry_id);

-- Materialized inflected form index for search
CREATE TABLE IF NOT EXISTS inflected_forms (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    form TEXT NOT NULL,
    cell_key TEXT NOT NULL,
    is_override BOOLEAN DEFAULT FALSE,
    UNIQUE(entry_id, cell_key)
);
CREATE INDEX IF NOT EXISTS idx_inflected_forms_form ON inflected_forms(form);
CREATE INDEX IF NOT EXISTS idx_inflected_forms_entry ON inflected_forms(entry_id);
CREATE INDEX IF NOT EXISTS idx_inflected_forms_trgm ON inflected_forms USING GIN(form gin_trgm_ops);

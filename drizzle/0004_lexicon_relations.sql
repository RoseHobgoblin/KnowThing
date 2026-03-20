-- Etymological relations between lexicon entries
CREATE TABLE lexicon_relations (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES lexicon(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX idx_lexrel_source ON lexicon_relations(source_id);
CREATE INDEX idx_lexrel_target ON lexicon_relations(target_id);
CREATE INDEX idx_lexrel_type ON lexicon_relations(relation_type);

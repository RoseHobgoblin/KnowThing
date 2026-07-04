-- TRIAL: model the Roun-basin languages as real Wordbook entries (not just Know articles).
-- Purpose: exercise the structured language model (family tree, phonemes, graphemes,
-- lexicon) and surface where the invented conlangs fight the schema.
-- Direct DB writes on purpose (the API path is role-gated: admin to create a language,
-- editor for phonemes/lexicon) — that gating is itself finding #1.

-- --- Languages: proto + tree + isolate --------------------------------------
INSERT INTO languages (name, slug, native_name, script, family, color, language_type, description, body) VALUES
('Proto-Roun', 'proto-roun', '*Rounu', 'unwritten (reconstructed)', 'Roun', '#8a6d3b', 'proto',
 'Reconstructed common ancestor of the Roun languages.', ''),
('Sarnavi', 'sarnavi', 'Sarnavi', 'Roun script', 'Ollaric (Roun)', '#b8862f', 'language',
 'The Ollaric language of Sarnau.', $body$
'''Sarnavi''' is the Ollaric language of [[Sarnau]], a sonorant tongue of the middle Roun basin.

== Phonology ==
{{Phonology|sarnavi}}

== Orthography ==
{{Orthography|sarnavi}}
$body$),
('Tsevoki', 'tsevoki', 'Tševoki', 'Block-hand', 'Tsevic (Roun)', '#9e2b25', 'language',
 'The Tsevic language of Tsevok.', ''),
('Kesseti', 'kesseti', 'Kesseti', 'Tally-hand', 'Rammic (isolate)', '#55636b', 'language',
 'The Rammic isolate of Kesset.', '')
ON CONFLICT (slug) DO NOTHING;

-- Wire the tree: Sarnavi and Tsevoki descend from Proto-Roun; Kesseti is an isolate.
UPDATE languages SET parent_language_id = (SELECT id FROM languages WHERE slug = 'proto-roun')
WHERE slug IN ('sarnavi', 'tsevoki');

-- --- Sarnavi phoneme inventory (the clean case) ------------------------------
INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, sort_order) VALUES
((SELECT id FROM languages WHERE slug='sarnavi'), 'm', 'consonant', 'bilabial',     'nasal',                'voiced',    0),
((SELECT id FROM languages WHERE slug='sarnavi'), 'n', 'consonant', 'alveolar',     'nasal',                'voiced',    1),
((SELECT id FROM languages WHERE slug='sarnavi'), 'p', 'consonant', 'bilabial',     'plosive',              'voiceless', 2),
((SELECT id FROM languages WHERE slug='sarnavi'), 't', 'consonant', 'alveolar',     'plosive',              'voiceless', 3),
((SELECT id FROM languages WHERE slug='sarnavi'), 'd', 'consonant', 'alveolar',     'plosive',              'voiced',    4),
((SELECT id FROM languages WHERE slug='sarnavi'), 'k', 'consonant', 'velar',        'plosive',              'voiceless', 5),
((SELECT id FROM languages WHERE slug='sarnavi'), 'g', 'consonant', 'velar',        'plosive',              'voiced',    6),
((SELECT id FROM languages WHERE slug='sarnavi'), 's', 'consonant', 'alveolar',     'fricative',            'voiceless', 7),
((SELECT id FROM languages WHERE slug='sarnavi'), 'ʃ', 'consonant', 'postalveolar', 'fricative',            'voiceless', 8),
((SELECT id FROM languages WHERE slug='sarnavi'), 'v', 'consonant', 'labiodental',  'fricative',            'voiced',    9),
((SELECT id FROM languages WHERE slug='sarnavi'), 'r', 'consonant', 'alveolar',     'trill',                'voiced',   10),
((SELECT id FROM languages WHERE slug='sarnavi'), 'l', 'consonant', 'alveolar',     'lateral approximant',  'voiced',   11);

INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order) VALUES
((SELECT id FROM languages WHERE slug='sarnavi'), 'i', 'vowel', 'close', 'front',   false, 0),
((SELECT id FROM languages WHERE slug='sarnavi'), 'e', 'vowel', 'mid',   'front',   false, 1),
((SELECT id FROM languages WHERE slug='sarnavi'), 'a', 'vowel', 'open',  'front',   false, 2),
((SELECT id FROM languages WHERE slug='sarnavi'), 'o', 'vowel', 'mid',   'back',    true,  3),
((SELECT id FROM languages WHERE slug='sarnavi'), 'u', 'vowel', 'close', 'back',    true,  4);

-- Diphthongs exist as a phoneme TYPE but the grid only renders consonant/vowel:
INSERT INTO phonemes (language_id, ipa, type, sort_order) VALUES
((SELECT id FROM languages WHERE slug='sarnavi'), 'ai', 'diphthong', 0),
((SELECT id FROM languages WHERE slug='sarnavi'), 'au', 'diphthong', 1),
((SELECT id FROM languages WHERE slug='sarnavi'), 'ei', 'diphthong', 2);

-- --- Tsevoki: affricate fits; the signature /kʃ/ cluster does NOT --------------
INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, sort_order) VALUES
((SELECT id FROM languages WHERE slug='tsevoki'), 't͡ʃ', 'consonant', 'postalveolar', 'affricate', 'voiceless', 0),
((SELECT id FROM languages WHERE slug='tsevoki'), 't͡s', 'consonant', 'alveolar',     'affricate', 'voiceless', 1);
-- (Cannot add /kʃ/: it is a CLUSTER, not a segment. The model has no phonotactics
--  layer, so the language's signature final clusters -tš/-ks/-sk have no home.)
INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order) VALUES
((SELECT id FROM languages WHERE slug='tsevoki'), 'ə', 'vowel', 'mid', 'central', false, 0);

-- --- Kesseti: geminates, glottal stop, front-rounded vowel --------------------
INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, subtype, sort_order) VALUES
((SELECT id FROM languages WHERE slug='kesseti'), 'p',  'consonant', 'bilabial', 'plosive', 'voiceless', NULL,       0),
((SELECT id FROM languages WHERE slug='kesseti'), 'pː', 'consonant', 'bilabial', 'plosive', 'voiceless', 'geminate', 1),
((SELECT id FROM languages WHERE slug='kesseti'), 'ʔ',  'consonant', 'glottal',  'plosive', 'voiceless', NULL,       2),
((SELECT id FROM languages WHERE slug='kesseti'), 'x',  'consonant', 'velar',    'fricative','voiceless',NULL,       3);
INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order) VALUES
((SELECT id FROM languages WHERE slug='kesseti'), 'y', 'vowel', 'close', 'front', true,  0),
((SELECT id FROM languages WHERE slug='kesseti'), 'i', 'vowel', 'close', 'front', false, 1),
((SELECT id FROM languages WHERE slug='kesseti'), 'e', 'vowel', 'mid',   'front', false, 2);

-- --- Sarnavi orthography (invented script → no Unicode glyph) -----------------
-- The grapheme column wants the native letterform; the Roun script has no Unicode,
-- so we can only store Latin romanization stand-ins.
INSERT INTO graphemes (language_id, grapheme, romanization, notes, sort_order) VALUES
((SELECT id FROM languages WHERE slug='sarnavi'), 's',  's',  'Roun-script letter; no Unicode glyph — Latin stand-in.', 0),
((SELECT id FROM languages WHERE slug='sarnavi'), 'sh', 'sh', 'Digraph for /ʃ/.', 1),
((SELECT id FROM languages WHERE slug='sarnavi'), 'r',  'r',  'Roun-script letter; no Unicode glyph — Latin stand-in.', 2);

-- --- Sarnavi lexicon + definitions (where Wordbook actually shines) -----------
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('sarnau', (SELECT id FROM languages WHERE slug='sarnavi'), 'ˈsar.nau', 'The endonym; literally "the joined roads".'),
('vaom',   (SELECT id FROM languages WHERE slug='sarnavi'), 'va.ˈom',   NULL),
('roun',   (SELECT id FROM languages WHERE slug='sarnavi'), 'roun',     NULL)
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition, usage_example, usage_translation) VALUES
((SELECT id FROM lexicon WHERE word='sarnau' AND language_id=(SELECT id FROM languages WHERE slug='sarnavi')),
 1, 'noun', 'The homeland; the network of joined roads.', NULL, NULL),
((SELECT id FROM lexicon WHERE word='vaom' AND language_id=(SELECT id FROM languages WHERE slug='sarnavi')),
 1, 'noun', 'A gathering or assembly.', NULL, NULL),
((SELECT id FROM lexicon WHERE word='roun' AND language_id=(SELECT id FROM languages WHERE slug='sarnavi')),
 1, 'noun', 'A walked road.', NULL, NULL),
((SELECT id FROM lexicon WHERE word='roun' AND language_id=(SELECT id FROM languages WHERE slug='sarnavi')),
 2, 'noun', 'The coin of Sarnau.', NULL, NULL);

-- Backfill language body sizes.
UPDATE languages SET body_size_bytes = octet_length(body) WHERE slug IN ('sarnavi') AND body_size_bytes = 0;

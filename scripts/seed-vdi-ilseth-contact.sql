-- ============================================================================
-- SEED (contact): VDI compounds, VDI→Ilseth loanwords, and Ilseth compounds
-- that fuse those loans with native Ilseth roots. Exercises cross-language
-- relations (loan_from) and layered etymology (compound → loan → donor).
-- Run AFTER seed-ilseth.sql, seed-vdi.sql, seed-vdi-dao.sql. Idempotent.
--
-- Nativisation law, VDI -> Ilseth (Ilseth has no glottal stop, ejectives,
-- uvulars, pharyngeals, or tone):
--   ʔ  -> h word-initially / medially, ∅ finally      qʼ, q -> k
--   pʼ tʼ kʼ -> p t k        ʁ (gh) -> g        ħ (ḥ) -> h        χ (kh) -> kh
--   û -> u,  tones dropped;  then bright/dark harmony re-sorts the loan.
-- ============================================================================

-- ############################################################################
-- PART 1 — VDI compound words (modifier + head; seam consonants simplify).
-- ############################################################################
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('qʼaqorûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼa.qoˈruːn', 'qʼaḥ "fire" + qorûn "mountain"; -ḥ drops before q-.'),
('gholvoʔûn',  (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁol.voˈʔuːn', 'ghold "gold" + voʔûn "hoard"; -d drops.'),
('vharnaʔûr',  (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˀvar.naˈʔuːr', 'vharûn "dragon" + naʔûr "true-name".'),
('doqhghoth',  (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'doqˈħʁoθ',     'doqhûn "mystery" + ghoth "gate"; echoes the Dào''s 眾妙之門.'),
('sháurghold', (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈʃaur.ʁold',  'sháur "sun" + ghold "gold".'),
('vharbroʔ',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˀvarˈbroʔ',   'vharûn "dragon" + broʔ "brood".')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, 'noun', m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
JOIN (VALUES
  ('qʼaqorûn','a volcano; a fire-mountain.'),
  ('gholvoʔûn','a treasury; a catalogued gold-hoard.'),
  ('vharnaʔûr','a dragon''s true-name; a Name of Power.'),
  ('doqhghoth','the Gate of Mystery; the threshold of the profound.'),
  ('sháurghold','electrum; "sun-gold", the pale precious metal.'),
  ('vharbroʔ','a dragon-line; a dynasty; a brood-clan.')
) AS m(word, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- All Sovereign (draconic/elemental).
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Sovereign'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('qʼaqorûn','gholvoʔûn','vharnaʔûr','doqhghoth','sháurghold','vharbroʔ')
ON CONFLICT DO NOTHING;

-- compound_of edges to both parts.
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'compound_of', NULL
FROM (VALUES
  ('qʼaqorûn','qʼaḥ'),   ('qʼaqorûn','qorûn'),
  ('gholvoʔûn','ghold'), ('gholvoʔûn','voʔûn'),
  ('vharnaʔûr','vharûn'),('vharnaʔûr','naʔûr'),
  ('doqhghoth','doqhûn'),('doqhghoth','ghoth'),
  ('sháurghold','sháur'),('sháurghold','ghold'),
  ('vharbroʔ','vharûn'), ('vharbroʔ','broʔ')
) AS m(cw, pw)
JOIN languages lg ON lg.slug='verdant-draconic-imperial'
JOIN lexicon s ON s.language_id=lg.id AND s.word=m.cw
JOIN lexicon t ON t.language_id=lg.id AND t.word=m.pw
ON CONFLICT DO NOTHING;

-- ############################################################################
-- PART 2 — VDI loanwords into Ilseth (nativised; sorted into harmony classes).
-- ############################################################################
INSERT INTO lexicon (word, language_id, pronunciation, etymology, notes) VALUES
('varun', (SELECT id FROM languages WHERE slug='ilseth'), 'ˈva.run', 'From VDI vharûn "dragon".',            'Fire-voice onset and vowel length lost; a living being, so it joins the Living class.'),
('kah',   (SELECT id FROM languages WHERE slug='ilseth'), 'kah',     'From VDI qʼaḥ "fire".',                'Ejective and pharyngeal flattened to k-...-h; means the sacred/dragon fire, beside native sena.'),
('vohun', (SELECT id FROM languages WHERE slug='ilseth'), 'ˈvo.hun', 'From VDI voʔûn "hoard".',              'Glottal stop -> h; the marsh folk had no word for a dragon''s hoard.'),
('gol',   (SELECT id FROM languages WHERE slug='ilseth'), 'gol',     'From VDI ghold "gold".',               'Uvular gh -> g, final -d dropped.'),
('nahur', (SELECT id FROM languages WHERE slug='ilseth'), 'ˈna.hur', 'From VDI naʔûr "true-name".',          'Glottal stop -> h; a name of power, beside native resh "name".'),
('goth',  (SELECT id FROM languages WHERE slug='ilseth'), 'goθ',     'From VDI ghoth "gate".',               'gh -> g; VDI final th kept (Ilseth has /θ/).')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, 'noun', m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
JOIN (VALUES
  ('varun','a dragon (loanword).'),
  ('kah','dragonfire; sacred flame.'),
  ('vohun','a hoard; a dragon''s treasure.'),
  ('gol','gold (the metal).'),
  ('nahur','a name of power; a true-name.'),
  ('goth','a gate; a threshold.')
) AS m(word, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- varun is animate -> Living; the rest are dark-vowel stems -> Dark.
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Living'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word = 'varun' ON CONFLICT DO NOTHING;

INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Dark'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('kah','vohun','gol','nahur','goth') ON CONFLICT DO NOTHING;

-- loan_from edges (Ilseth word -> VDI donor), cross-language.
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'loan_from', m.note
FROM (VALUES
  ('varun','vharûn','Nativised: vh- -> v-, -û- -> -u-.'),
  ('kah','qʼaḥ','Nativised: qʼ -> k, -ḥ -> -h.'),
  ('vohun','voʔûn','Nativised: -ʔ- -> -h-, -û- -> -u-.'),
  ('gol','ghold','Nativised: gh- -> g-, -d dropped.'),
  ('nahur','naʔûr','Nativised: -ʔ- -> -h-.'),
  ('goth','ghoth','Nativised: gh- -> g-.')
) AS m(ilw, vdiw, note)
JOIN languages il ON il.slug='ilseth'
JOIN languages vd ON vd.slug='verdant-draconic-imperial'
JOIN lexicon s ON s.language_id=il.id AND s.word=m.ilw
JOIN lexicon t ON t.language_id=vd.id AND t.word=m.vdiw
ON CONFLICT DO NOTHING;

-- ############################################################################
-- PART 3 — Ilseth compounds: a VDI-loan element + a native Ilseth element.
-- Head-final: the second (native) element sets meaning, harmony, and class.
-- ############################################################################
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('varunkoran', (SELECT id FROM languages WHERE slug='ilseth'), 'ˈva.run.ko.ran', 'varun (loan) + koran "mountain".'),
('kahthora',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈkah.θo.ra',     'kah (loan) + thora "river".'),
('vohunkival', (SELECT id FROM languages WHERE slug='ilseth'), 'ˈvo.hun.ki.val', 'vohun (loan) + kival "house".'),
('golserin',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈgol.se.rin',    'gol (loan) + serin "light".'),
('nahurvael',  (SELECT id FROM languages WHERE slug='ilseth'), 'ˈna.hur.vael',   'nahur (loan) + vael "word".'),
('varunseth',  (SELECT id FROM languages WHERE slug='ilseth'), 'ˈva.run.seθ',    'varun (loan) + seth "friend".')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, 'noun', m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
JOIN (VALUES
  ('varunkoran','a dragon-mountain; a peak where a wyrm lairs.'),
  ('kahthora','a lava-flow; a river of dragonfire.'),
  ('vohunkival','a treasure-house; a vault.'),
  ('golserin','the gleam of gold; treasure-light.'),
  ('nahurvael','a word of power; an invocation.'),
  ('varunseth','a dragon-friend; one who speaks with dragons.')
) AS m(word, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- Class follows the native head: koran/thora/kival = Dark; serin/vael = Bright;
-- varunseth denotes a person = Living.
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Dark'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('varunkoran','kahthora','vohunkival') ON CONFLICT DO NOTHING;

INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Bright'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('golserin','nahurvael') ON CONFLICT DO NOTHING;

INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Living'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word = 'varunseth' ON CONFLICT DO NOTHING;

-- compound_of edges to each part (one part is itself a loanword -> layered etymology).
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'compound_of', NULL
FROM (VALUES
  ('varunkoran','varun'), ('varunkoran','koran'),
  ('kahthora','kah'),     ('kahthora','thora'),
  ('vohunkival','vohun'), ('vohunkival','kival'),
  ('golserin','gol'),     ('golserin','serin'),
  ('nahurvael','nahur'),  ('nahurvael','vael'),
  ('varunseth','varun'),  ('varunseth','seth')
) AS m(cw, pw)
JOIN languages lg ON lg.slug='ilseth'
JOIN lexicon s ON s.language_id=lg.id AND s.word=m.cw
JOIN lexicon t ON t.language_id=lg.id AND t.word=m.pw
ON CONFLICT DO NOTHING;

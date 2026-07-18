-- ============================================================================
-- SEED (extension): Verdant Draconic Imperial — vocabulary to translate the
-- opening of the Dào Dé Jīng. These 18 words are the gaps the translation
-- exposed in the 100-word survival core: abstract, philosophical terms. Many
-- are DERIVED from roots VDI already had (the Void from "hollow", the Origin
-- from "to rise", the Mystery from "deep") — so the language grows organically
-- and the derivation graph lights up. Run AFTER scripts/seed-vdi.sql.
-- Idempotent (ON CONFLICT DO NOTHING / matched UPDATEs).
-- ============================================================================

INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('ʔandhûr',  (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔanˈðuːr',  'For 常: the eternal, the ever-abiding — a dragon''s undying constancy.'),
('kʼun',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'kʼun',      'For 可: auxiliary particle, precedes the verb it enables.'),
('hulʼûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'hulˈʔuːn',  'For 無: the Void, Non-being. Derived from hulʼ "hollow".'),
('riʔûn',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'riˈʔuːn',   'For 始: origin, the rising-forth. Derived from riʔ "to rise".'),
('maʔûn',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'maˈʔuːn',   'For 母: mother, the bearing-one.'),
('woʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'woʔ',       'For 物: a thing, an existent. Its myriad form woʔukh renders 萬物.'),
('gholûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁoˈluːn',   'For 萬/眾: a countless multitude, all, the ten-thousand.'),
('khoʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χoʔ',       'For 欲: to desire, to covet — a Strong (draconic) verb, the hoarder''s hunger.'),
('tʼun',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼun',      'For 故: therefore, thus, so.'),
('miʔûr',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'miˈʔuːr',   'For 觀: to behold, to contemplate. Derived from miʔ "to see".'),
('qʼiʔûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼiˈʔuːn',  'For 妙: subtlety, the wondrous, the marvelous-hidden.'),
('khemûr',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χeˈmuːr',   'For 徼: a boundary, the outward manifestation, the fringe.'),
('ʔamûn',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔaˈmuːn',   'For 同: same, alike, of one kind, together. Derived from ʔamar "kin".'),
('thaqûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'θaˈquːn',   'For 異: different, other, distinct. Derived from thaq "that (far)".'),
('doqhûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'doqˈħuːn',  'For 玄: the deep mystery, the profound dark. Derived from doqh "deep".'),
('raʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'raʔ',       'For 又: again, further, moreover.'),
('ghoth',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁoθ',       'For 門: a gate, a door, a threshold.'),
('boʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'boʔ',       'For 而: but, yet, whereas (adversative).')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, m.pos, m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
JOIN (VALUES
  ('ʔandhûr','adjective','eternal, ever-constant, undying, ever-abiding.'),
  ('kʼun','particle','can, may, be able (auxiliary; precedes its verb).'),
  ('hulʼûn','noun','the Void; Non-being; nothingness.'),
  ('riʔûn','noun','origin, beginning, source; the rising-forth.'),
  ('maʔûn','noun','mother; the bearing-one, the dam.'),
  ('woʔ','noun','a thing, an existent, a matter.'),
  ('gholûn','noun','a myriad; a countless multitude; all, the ten-thousand.'),
  ('khoʔ','verb','to desire, to covet, to crave.'),
  ('tʼun','conjunction','therefore, thus, so.'),
  ('miʔûr','verb','to behold, to contemplate, to observe deeply.'),
  ('qʼiʔûn','noun','subtlety; the wondrous; the marvelous-hidden.'),
  ('khemûr','noun','a boundary; the outward manifestation; the fringe.'),
  ('ʔamûn','adjective','same, alike, of one kind; together.'),
  ('thaqûn','adjective','different, other, distinct.'),
  ('doqhûn','noun','the deep mystery; the profound dark; the abyssal.'),
  ('raʔ','particle','again, further, moreover, yet-more.'),
  ('ghoth','noun','a gate, a door, a threshold.'),
  ('boʔ','conjunction','but, yet, whereas.')
) AS m(word, pos, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- --- Inflection assignments --------------------------------------------------
-- Sovereign nouns (cosmic / sacred abstractions)
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Sovereign'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('hulʼûn','riʔûn','doqhûn','qʼiʔûn','ghoth')
ON CONFLICT DO NOTHING;

-- Common nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Common'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('woʔ','maʔûn','khemûr','gholûn')
ON CONFLICT DO NOTHING;

-- Strong verb (khoʔ) + Weak verb (miʔûr)
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Strong'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word = 'khoʔ' ON CONFLICT DO NOTHING;
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Weak'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word = 'miʔûr' ON CONFLICT DO NOTHING;

-- --- Derivation relations (the new words growing out of old roots) -----------
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'derived_from', m.note
FROM (VALUES
  ('hulʼûn','hulʼ','Abstract noun from the adjective "hollow": emptiness reified as the Void.'),
  ('riʔûn','riʔ','Deverbal noun from "to rise": the rising-forth, the origin.'),
  ('doqhûn','doqh','Abstract noun from "deep": the profound made a name.'),
  ('miʔûr','miʔ','Intensive verb from "to see": to see deeply, to contemplate.'),
  ('ʔamûn','ʔamar','From "kin": what is of one blood is of one kind — "the same".'),
  ('thaqûn','thaq','From "that (far)": what is set apart — "other, different".')
) AS m(child, root, note)
JOIN languages lg ON lg.slug='verdant-draconic-imperial'
JOIN lexicon s ON s.language_id=lg.id AND s.word=m.child
JOIN lexicon t ON t.language_id=lg.id AND t.word=m.root
ON CONFLICT DO NOTHING;

UPDATE languages SET body_size_bytes = octet_length(body)
WHERE slug='verdant-draconic-imperial' AND body_size_bytes = 0;

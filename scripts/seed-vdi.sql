-- ============================================================================
-- SEED: Verdant Draconic Imperial (VDI) — an invented glottal, tonal contact
-- language. Second conlang seed; mirrors scripts/seed-ilseth.sql, but exercises
-- a DIFFERENT slice of the model: ERGATIVE alignment, a 4th "draconic" person,
-- TONE-bearing affixes, and a heavy etymology graph that encodes the lore.
-- ----------------------------------------------------------------------------
-- Lore: True Draconic ("Old Draconic") uses phonation humans cannot produce —
-- subsonic rumble, fire-modulated voice, infrasound. Verdant Draconic Imperial
-- is the Empire's engineered middle-tongue: every word is a HUMAN-SAYABLE
-- approximation of a Draconic root, kept close enough (glottal stops, ejectives,
-- uvulars, pharyngeals, and three register tones) that a dragon still hears its
-- own word inside it. So a human who learns VDI has, in effect, learned the
-- correspondence key — and can parse Draconic speech. That key is modelled here
-- as `derived_from` edges from VDI words to their Old Draconic etyma.
--
-- Romanisation uses the true IPA letters ʔ (glottal stop) and ◌ʼ (ejective),
-- NOT ASCII apostrophes — authentic AND safe inside SQL string literals.
-- Tone: acute = high ˥, grave = low ˩, unmarked = mid ˧.
--
-- Direct DB writes (admin/editor-gated API). Idempotent: phonemes/graphemes are
-- DELETE-first; everything else ON CONFLICT DO NOTHING.
-- Reset: DELETE FROM languages WHERE slug IN ('verdant-draconic-imperial','old-draconic');
-- Run: docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-vdi.sql
-- ============================================================================

-- --- 1. Languages: Old Draconic (proto) + VDI (daughter/contact tongue) -------
INSERT INTO languages (name, slug, native_name, script, family, color, language_type, description, body) VALUES
('Old Draconic', 'old-draconic', '[unrenderable]', 'wing-glyph (unrendered)', 'Draconic', '#7a5c1e', 'proto',
 'The true tongue of dragons. Uses subsonic and fire-modulated phonation no human throat can produce; attested to mortals only through Verdant Draconic Imperial.', ''),
('Verdant Draconic Imperial', 'verdant-draconic-imperial', 'Qʼarrûth', 'Imperial tone-hand', 'Draconic', '#2e7d46', 'language',
 'The human-sayable middle-tongue of the Verdant Empire — a spoken key to Draconic.', $body$
'''Verdant Draconic Imperial''' (VDI; native '''Qʼarrûth''', "the shared-throat") is a wholly invented language — not built from any real tongue. It is the '''engineered contact language''' of the Verdant Empire: a speech a human mouth can manage that still rings, to a dragon's ear, like the dragon's own words. To learn it is to learn the key by which Draconic itself becomes intelligible.

== The intelligibility bargain ==
True '''[[Old Draconic]]''' is unpronounceable by humans — it rides on subsonic rumble, infrasound, and fire-shaped breath. VDI keeps only the parts a human throat can copy: a wall of '''glottal stops''' (ʔ), '''ejectives''' (pʼ tʼ kʼ qʼ), '''uvulars''' (q, kh /χ/, gh /ʁ/), '''pharyngeals''' (ḥ /ħ/, ʿ /ʕ/), and '''three register tones'''. Each VDI word is a regular approximation of a Draconic etymon (see the ''Etymology'' links on any core word) — so a fluent human parses Draconic by running the correspondence backward.

== Phonology ==
{{Phonology|verdant-draconic-imperial}}

=== Tone ===
Every full syllable carries one of three '''register tones''':
* '''high''' (˥, marked '''á''') — the "sky register"; bright, distant, the tone of names and titles.
* '''mid''' (˧, unmarked '''a''') — the neutral, default register.
* '''low''' (˩, marked '''à''') — the "deep register"; the closest a human comes to the Draconic rumble, used for the sacred and the enormous.
Tone is lexical (it tells words apart) '''and''' grammatical: several endings are fixed-tone, so the paradigm below is dotted with ás and às.

== Orthography ==
Written in the '''Imperial tone-hand'''; the Wordbook stores its romanisation. Glottal stop is ''ʔ'', ejectives take a following ''ʼ'', and tone rides as an accent on the vowel.

{{Orthography|verdant-draconic-imperial}}

== Grammar ==
=== Alignment: ergative ===
VDI is '''ergative–absolutive'''. The bare '''absolutive''' is the subject of an intransitive verb ''and'' the object of a transitive one; the special '''ergative''' marks the doer of a transitive verb. Dragons are grammatically exalted: the ergative of the '''Sovereign''' noun class is the high-tone ''-qá'', while the '''Common''' class takes a flat ''-ki''. To mark a dragon as the agent is to raise the pitch of the whole word.

=== Noun classes, number, case ===
Nouns are '''Sovereign''' (dragons, elements, celestial bodies, the sacred, the Empire) or '''Common''' (everything else). Both inflect for '''number''' — singular / plural / '''myriad''' (an uncountable multitude: scales, embers, coins, stars) — and four '''cases''': absolutive, ergative, genitive, oblique. Full tables: {{Inflections|verdant-draconic-imperial}}.

=== Verbs: tense, and the fourth person ===
Verbs mark '''tense''' (past / present / future) by prefix and '''person''' by suffix. VDI person is unusual: alongside 1st, 2nd, and 3rd it has a '''fourth person''' — the '''draconic''', used for and by dragons, the Empire, and the divine. The fourth person always carries '''high tone''' (''-á'' / ''-é''), so reverence is audible. '''Strong''' verbs (draconic acts: to fly, to burn, to hoard) take glottal, ejective endings; '''Weak''' verbs (mortal acts) take plain ones.

=== Syntax ===
The clause is '''verb-final''' (SOV) with '''postpositions''': ''vharûn qʼaḥ verqá'' — "the-dragon the-fire burns" → "the dragon burns the fire", with ''vharûn'' in the ergative.

== A line, read twice ==
: '''Qʼa'''ghár'''á''' vharûnqá vaʔath.
: FUT-fly-4.DRACONIC dragon-ERG sky-OBL
: "The dragon shall fly into the sky." — and a listening wyrm hears its own ''ghár-'' inside the human ''ghár''.
$body$)
ON CONFLICT (slug) DO NOTHING;

UPDATE languages SET parent_language_id = (SELECT id FROM languages WHERE slug = 'old-draconic')
WHERE slug = 'verdant-draconic-imperial';

-- --- 2. Dialects -------------------------------------------------------------
INSERT INTO language_dialects (language_id, name, slug, region, description) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'High Imperial', 'high-imperial', 'Court & fire-temples',
 'The court register: all three tones and every ejective kept crisp. The form dragons are addressed in.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'Trade Pidgin', 'trade-pidgin', 'The border markets',
 'The mortal marketplace form: tone collapses to stress, ejectives soften to plain stops. Still intelligible to a patient dragon.')
ON CONFLICT (language_id, slug) DO NOTHING;

-- --- 3. Phoneme inventory (glottal-heavy, human-producible) -------------------
DELETE FROM phonemes WHERE language_id = (SELECT id FROM languages WHERE slug='verdant-draconic-imperial');
INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, subtype, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔ',   'consonant', 'glottal',    'plosive',           'voiceless', NULL,       10, 'The keystone sound; can open or close any syllable.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'p',   'consonant', 'bilabial',   'plosive',           'voiceless', NULL,       20, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'pʼ',  'consonant', 'bilabial',   'plosive',           'voiceless', 'ejective', 21, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 't',   'consonant', 'alveolar',   'plosive',           'voiceless', NULL,       30, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼ',  'consonant', 'alveolar',   'plosive',           'voiceless', 'ejective', 31, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'd',   'consonant', 'alveolar',   'plosive',           'voiced',    NULL,       32, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'k',   'consonant', 'velar',      'plosive',           'voiceless', NULL,       40, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'kʼ',  'consonant', 'velar',      'plosive',           'voiceless', 'ejective', 41, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'g',   'consonant', 'velar',      'plosive',           'voiced',    NULL,       42, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'q',   'consonant', 'uvular',     'plosive',           'voiceless', NULL,       50, 'The draconic "deep k".'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼ',  'consonant', 'uvular',     'plosive',           'voiceless', 'ejective', 51, 'Signature sound of the language.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ɢ',   'consonant', 'uvular',     'plosive',           'voiced',    NULL,       52, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 't͡sʼ', 'consonant', 'alveolar',   'affricate',         'voiceless', 'ejective', 60, 'spelled tsʼ'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 's',   'consonant', 'alveolar',   'fricative',         'voiceless', NULL,       70, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʃ',   'consonant', 'postalveolar','fricative',        'voiceless', NULL,       71, 'spelled sh'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ɬ',   'consonant', 'alveolar',   'lateral fricative', 'voiceless', NULL,       72, 'spelled hl'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χ',   'consonant', 'uvular',     'fricative',         'voiceless', NULL,       73, 'spelled kh'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁ',   'consonant', 'uvular',     'fricative',         'voiced',    NULL,       74, 'spelled gh'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ħ',   'consonant', 'pharyngeal', 'fricative',         'voiceless', NULL,       75, 'spelled ḥ'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʕ',   'consonant', 'pharyngeal', 'fricative',         'voiced',    NULL,       76, 'spelled ʿ'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'h',   'consonant', 'glottal',    'fricative',         'voiceless', NULL,       77, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'm',   'consonant', 'bilabial',   'nasal',             'voiced',    NULL,       80, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'n',   'consonant', 'alveolar',   'nasal',             'voiced',    NULL,       81, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ŋ',   'consonant', 'velar',      'nasal',             'voiced',    NULL,       82, 'spelled ng'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʀ',   'consonant', 'uvular',     'trill',             'voiced',    NULL,       90, 'The draconic growl; spelled r.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'l',   'consonant', 'alveolar',   'lateral approximant','voiced',   NULL,       91, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'w',   'consonant', 'labial-velar','approximant',      'voiced',    NULL,       92, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'j',   'consonant', 'palatal',    'approximant',       'voiced',    NULL,       93, 'spelled y');

INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'i', 'vowel', 'close', 'front',   false, 10, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'e', 'vowel', 'mid',   'front',   false, 20, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'a', 'vowel', 'open',  'central', false, 30, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'o', 'vowel', 'mid',   'back',    true,  40, NULL),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'u', 'vowel', 'close', 'back',    true,  50, NULL);

-- Tone registers recorded as 'special' phonemes (grid renders C/V only, but the
-- inventory should carry the tone system explicitly).
INSERT INTO phonemes (language_id, ipa, type, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), '˥', 'special', 10, 'High register tone (á): the sky register.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), '˧', 'special', 20, 'Mid register tone (unmarked): the neutral register.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), '˩', 'special', 30, 'Low register tone (à): the deep register, nearest the Draconic rumble.');

-- --- 4. Orthography ----------------------------------------------------------
DELETE FROM graphemes WHERE language_id = (SELECT id FROM languages WHERE slug='verdant-draconic-imperial');
INSERT INTO graphemes (language_id, grapheme, romanization, environment, notes, sort_order) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔ',  'ʔ',  NULL, 'Glottal stop; the keystone letter.',         0),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼ', 'qʼ', NULL, 'Uvular ejective — the signature sound.',     1),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'kh', 'kh', NULL, 'Digraph for uvular fricative /χ/.',          2),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'gh', 'gh', NULL, 'Digraph for uvular fricative /ʁ/.',          3),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'hl', 'hl', NULL, 'Digraph for lateral fricative /ɬ/.',         4),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ng', 'ng', 'not word-initial', 'Digraph for /ŋ/.',            5),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ḥ',  'ḥ',  NULL, 'Voiceless pharyngeal /ħ/.',                  6),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʿ',  'ʿ',  NULL, 'Voiced pharyngeal /ʕ/.',                     7),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'á',  'á',  'high tone', 'Vowel carrying high register tone.',  8),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'à',  'à',  'low tone',  'Vowel carrying low register tone.',   9);

-- Link the single-phoneme graphemes to their phonemes.
INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
SELECT g.id, p.id, 0
FROM graphemes g
JOIN languages l ON l.id = g.language_id AND l.slug = 'verdant-draconic-imperial'
JOIN (VALUES ('ʔ','ʔ'),('qʼ','qʼ'),('kh','χ'),('gh','ʁ'),('hl','ɬ'),('ng','ŋ'),('ḥ','ħ'),('ʿ','ʕ')) AS m(grph, ipa)
  ON m.grph = g.grapheme
JOIN phonemes p ON p.language_id = l.id AND p.ipa = m.ipa
ON CONFLICT DO NOTHING;

-- --- 5. Inflection dimensions ------------------------------------------------
INSERT INTO inflection_dimensions (language_id, part_of_speech, name, dim_values, sort_order) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'noun', 'number',
   ARRAY['singular','plural','myriad'], 0),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'noun', 'case',
   ARRAY['absolutive','ergative','genitive','oblique'], 1),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verb', 'tense',
   ARRAY['past','present','future'], 0),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verb', 'person',
   ARRAY['p1','p2','p3','p4'], 1)
ON CONFLICT (language_id, part_of_speech, name) DO NOTHING;

-- --- 6. Paradigm classes -----------------------------------------------------
INSERT INTO paradigm_classes (language_id, part_of_speech, name, description) VALUES
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'noun', 'Sovereign',
 'Exalted class: dragons, elements, celestial bodies, the Empire, the sacred. High-tone ergative -qá.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'noun', 'Common',
 'Everyday class: mortals, tools, places, animals. Flat ergative -ki.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verb', 'Strong',
 'Draconic acts (to fly, burn, hoard): glottal/ejective endings, prefixes ʔe-/qʼa-.'),
((SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verb', 'Weak',
 'Mortal acts (to speak, take, walk): plain endings, prefixes ha-/ku-.')
ON CONFLICT (language_id, part_of_speech, name) DO NOTHING;

-- --- 7. Paradigm rules (cell_key = number.case  /  tense.person) -------------
-- NOUN · Sovereign (ergative -qá high tone; number: sing -, plural -ren, myriad -oq)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='verdant-draconic-imperial') AND part_of_speech='noun' AND name='Sovereign'),
       k, v
FROM (VALUES
  ('singular.absolutive','{stem}'),   ('singular.ergative','{stem}qá'),   ('singular.genitive','{stem}ghà'),   ('singular.oblique','{stem}ʔu'),
  ('plural.absolutive','{stem}ren'),  ('plural.ergative','{stem}renqá'),  ('plural.genitive','{stem}renghà'),  ('plural.oblique','{stem}renʔu'),
  ('myriad.absolutive','{stem}oq'),   ('myriad.ergative','{stem}oqqá'),   ('myriad.genitive','{stem}oqghà'),   ('myriad.oblique','{stem}oqʔu')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- NOUN · Common (ergative -ki; number: sing -, plural -il, myriad -ukh)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='verdant-draconic-imperial') AND part_of_speech='noun' AND name='Common'),
       k, v
FROM (VALUES
  ('singular.absolutive','{stem}'),   ('singular.ergative','{stem}ki'),   ('singular.genitive','{stem}hu'),   ('singular.oblique','{stem}at'),
  ('plural.absolutive','{stem}il'),   ('plural.ergative','{stem}ilki'),   ('plural.genitive','{stem}ilhu'),   ('plural.oblique','{stem}ilat'),
  ('myriad.absolutive','{stem}ukh'),  ('myriad.ergative','{stem}ukhki'),  ('myriad.genitive','{stem}ukhhu'),  ('myriad.oblique','{stem}ukhat')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- VERB · Strong (tense prefix past ʔe-, future qʼa-; person p1 -aʔ, p2 -uq, p3 -a, p4 -á high)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='verdant-draconic-imperial') AND part_of_speech='verb' AND name='Strong'),
       k, v
FROM (VALUES
  ('present.p1','{stem}aʔ'),    ('present.p2','{stem}uq'),    ('present.p3','{stem}a'),    ('present.p4','{stem}á'),
  ('past.p1','ʔe{stem}aʔ'),     ('past.p2','ʔe{stem}uq'),     ('past.p3','ʔe{stem}a'),     ('past.p4','ʔe{stem}á'),
  ('future.p1','qʼa{stem}aʔ'),  ('future.p2','qʼa{stem}uq'),  ('future.p3','qʼa{stem}a'),  ('future.p4','qʼa{stem}á')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- VERB · Weak (tense prefix past ha-, future ku-; person p1 -im, p2 -it, p3 -i, p4 -é high)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='verdant-draconic-imperial') AND part_of_speech='verb' AND name='Weak'),
       k, v
FROM (VALUES
  ('present.p1','{stem}im'),   ('present.p2','{stem}it'),   ('present.p3','{stem}i'),   ('present.p4','{stem}é'),
  ('past.p1','ha{stem}im'),    ('past.p2','ha{stem}it'),    ('past.p3','ha{stem}i'),    ('past.p4','ha{stem}é'),
  ('future.p1','ku{stem}im'),  ('future.p2','ku{stem}it'),  ('future.p3','ku{stem}i'),  ('future.p4','ku{stem}é')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- --- 8. Old Draconic etymon roots (the correspondence key) --------------------
-- Transcribed in the scholars' "deep hand"; bracketed marks are phonation no
-- human can voice. The VDI reflex strips them to the sayable core.
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('*χʁōm̥',   (SELECT id FROM languages WHERE slug='old-draconic'), '[subsonic]', 'Root of fire/breath. VDI drops the subsonic onset.'),
('*wʱarûŋ', (SELECT id FROM languages WHERE slug='old-draconic'), '[fire-voiced]', 'Root "great-serpent"; the self-name of dragons.'),
('*ʁʱolð',  (SELECT id FROM languages WHERE slug='old-draconic'), '[rumble]', 'Root of the hoarded/bright-metal.'),
('*ɢʱár',   (SELECT id FROM languages WHERE slug='old-draconic'), '[infrasound]', 'Root of flight; "to beat the wide air".'),
('*ʔm̥bʱa',  (SELECT id FROM languages WHERE slug='old-draconic'), '[creaky]', 'Root of the sky/vault.'),
('*naʔʱûr', (SELECT id FROM languages WHERE slug='old-draconic'), '[fire-voiced]', 'Root of name/true-word.'),
('*wʕoðʱ',  (SELECT id FROM languages WHERE slug='old-draconic'), '[subsonic]', 'Root of the hoard/gathered-treasure.')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, m.pos, m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='old-draconic'
JOIN (VALUES
  ('*χʁōm̥','noun','fire; the exhaled breath of a dragon'),
  ('*wʱarûŋ','noun','dragon; the great serpent'),
  ('*ʁʱolð','noun','gold; bright hoarded metal'),
  ('*ɢʱár','verb','to fly, to beat the wide air'),
  ('*ʔm̥bʱa','noun','sky, the vault above'),
  ('*naʔʱûr','noun','name; a true-word of power'),
  ('*wʕoðʱ','noun','hoard; gathered treasure')
) AS m(word, pos, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- ============================================================================
-- 9. VDI lexicon — 100 words. Class tag: [S]=Sovereign noun, [C]=Common noun,
--    [St]=Strong verb, [Wk]=Weak verb; others uninflected.
-- ============================================================================
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
-- Pronouns
('ná',       (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'náˀ',        'I; high tone on the self.'),
('tuq',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tuq',        NULL),
('ʔir',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔir',        '3rd person; also the base of the 4th (draconic) pronoun ʔirá.'),
('nakh',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'naχ',        NULL),
('tuqul',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈtu.qul',    NULL),
('ʔirá',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔiˈráˀ',     '4th person, the draconic: "the Exalted One". High tone.'),
-- Numerals (senary — six talons to a foreclaw)
('ʔuq',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔuq',        NULL),
('dhá',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ðáˀ',        NULL),
('qʼir',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼir',       NULL),
('val',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'val',        NULL),
('shen',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʃen',        NULL),
('ʔaʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔaʔ',        'Six; the base of the count, "a full claw".'),
('ʔaʔʔuq',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈʔaʔ.ʔuq',   'Seven; literally "six-one".'),
-- Draconic anatomy (Sovereign)
('khaʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χaʔ',        NULL),
('ghúr',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁúrˀ',       NULL),
('tsʼalq',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 't͡sʼalq',     NULL),
('ʔungh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔuŋʁ',       NULL),
('verokh',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'veˈroχ',     NULL),
('maʔûl',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'maˈʔuːl',    NULL),
-- Common body
('ʔil',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔil',        NULL),
('voq',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'voq',        NULL),
('sanḥ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'sanħ',       NULL),
('tʼokh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼoχ',       NULL),
('reʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'reʔ',        NULL),
('khul',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χul',        NULL),
-- Elements & celestial (Sovereign)
('qʼaḥ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼaħ',       'Fire; from Old Draconic *χʁōm̥.'),
('ʔashûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔaˈʃuːn',    NULL),
('ʔembor',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈʔem.bor',   NULL),
('dhukh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ðuχ',        NULL),
('velà',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'veˈlàˀ',     'Flame, low tone; the visible tongue of fire.'),
('tʼarq',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼarq',      NULL),
('qorûn',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qoˈruːn',    NULL),
('vaʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'vaʔ',        'Sky; from Old Draconic *ʔm̥bʱa.'),
('sturoq',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈstu.roq',   NULL),
('ghil',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁil',        NULL),
('ʔestá',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔesˈtáˀ',    NULL),
('sháur',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʃáurˀ',      NULL),
('lunà',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'luˈnàˀ',     NULL),
('ghold',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁold',       'Gold; from Old Draconic *ʁʱolð.'),
('jadhûr',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'jaˈðuːr',    'Jade; the Verdant Empire''s holy stone.'),
('muʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'muʔ',        NULL),
-- Draconic culture (Sovereign)
('vharûn',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˀvaˈruːn',   'Dragon, wyrm; from Old Draconic *wʱarûŋ.'),
('voʔûn',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'voˈʔuːn',    'A hoard; from Old Draconic *wʕoðʱ.'),
('ʔeldhor',  (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈʔel.ðor',   'An elder wyrm.'),
('qʼopʼ',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼopʼ',      NULL),
('broʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'broʔ',       'A brood, a clutch of dragons.'),
('ʔoth',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔoθ',        NULL),
('naʔûr',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'naˈʔuːr',    'A true-name; from Old Draconic *naʔʱûr.'),
('tʼavul',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈtʼa.vul',   NULL),
('ʔimperûq', (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˌʔim.peˈruːq','The Verdant Empire itself.'),
('velʔûr',   (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'velˈʔuːr',   'Fire-speech; the true Draconic tongue.'),
-- Nature (Common)
('dhar',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ðar',        NULL),
('riʔûl',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'riˈʔuːl',    NULL),
('voskh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'vosχ',       NULL),
('tʼel',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼel',       NULL),
('roq',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'roq',        NULL),
('nakht',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'naχt',       NULL),
('sháo',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʃáo',        NULL),
('faʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'faʔ',        NULL),
('khir',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χir',        NULL),
-- People (Common)
('ʔansh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔanʃ',       'A human, a mortal.'),
('ʔamar',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈʔa.mar',    NULL),
('voʔul',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ˈvo.ʔul',    'A lair, a dwelling.'),
-- Verbs (Strong — draconic acts)
('ghár',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁárˀ',       'to fly; from Old Draconic *ɢʱár.'),
('verq',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verq',       'to burn.'),
('voʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'voʔ',        'to hoard.'),
('khamʼ',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χamʼ',       'to devour.'),
('sʼugh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'sʼuʁ',       'to breathe fire.'),
('riʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'riʔ',        'to rise.'),
('tʼaur',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tʼaur',      'to reign, to rule.'),
('qʼen',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼen',       'to guard.'),
('dhomʼ',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ðomʼ',       'to sleep the long sleep.'),
('brekh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'breχ',       'to break, to shatter.'),
-- Verbs (Weak — mortal acts)
('velʼ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'velʼ',       'to speak.'),
('khen',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'χen',        'to know.'),
('miʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'miʔ',        'to see.'),
('luʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'luʔ',        'to hear.'),
('tan',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tan',        'to take.'),
('ghen',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁen',        'to give.'),
('makh',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'maχ',        'to make.'),
('qad',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qad',        'to go.'),
('tunʼ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'tunʼ',       'to hold.'),
('skarʔ',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'skarʔ',      'to hunt.'),
('ghesh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁeʃ',        'to fear.'),
('wár',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'wárˀ',       'to be, to exist (suppletive in the past).'),
-- Adjectives
('sʼar',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'sʼar',       'great, vast.'),
('ʔeldh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔelð',       'ancient, elder.'),
('briʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'briʔ',       'bright.'),
('doqh',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'doqħ',       'deep.'),
('verdh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'verð',       'verdant, green; the Empire''s colour.'),
('gholʼ',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʁolʼ',       'golden.'),
('hulʼ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'hulʼ',       'hollow, empty.'),
('haʔûr',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'haˈʔuːr',    'sacred, hallowed.'),
('qruʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qruʔ',       'cruel.'),
('swikh',    (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'swiχ',       'swift.'),
-- Particles / function words
('nuʔ',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'nuʔ',        'not (pre-verbal negator).'),
('ʔun',      (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʔun',        'and.'),
('shaq',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'ʃaq',        'this, these (near).'),
('thaq',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'θaq',        'that, those (far).'),
('qʼáʔ',     (SELECT id FROM languages WHERE slug='verdant-draconic-imperial'), 'qʼáʔ',       'Exalting particle: raises what follows to the draconic register.')
ON CONFLICT DO NOTHING;

-- --- Definitions (sense 1 carries the POS the inflection engine reads) --------
INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition, usage_example, usage_translation)
SELECT l.id, 1, m.pos, m.def, m.ex, m.tr
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
JOIN (VALUES
  ('ná','pronoun','I, me.',NULL,NULL),
  ('tuq','pronoun','you (singular).',NULL,NULL),
  ('ʔir','pronoun','he, she, it, they (3rd person).',NULL,NULL),
  ('nakh','pronoun','we.',NULL,NULL),
  ('tuqul','pronoun','you (plural).',NULL,NULL),
  ('ʔirá','pronoun','the Exalted One (4th/draconic person): a dragon, the Empire, or the divine, referred to with reverence.',NULL,NULL),
  ('ʔuq','numeral','one (1).',NULL,NULL),
  ('dhá','numeral','two (2).',NULL,NULL),
  ('qʼir','numeral','three (3).',NULL,NULL),
  ('val','numeral','four (4).',NULL,NULL),
  ('shen','numeral','five (5).',NULL,NULL),
  ('ʔaʔ','numeral','six (6); the base of the senary count.',NULL,NULL),
  ('ʔaʔʔuq','numeral','seven (7); literally "six-one".',NULL,NULL),
  ('khaʔ','noun','a scale.',NULL,NULL),
  ('ghúr','noun','a wing.','Qʼaghárá vharûnqá.','The dragon shall fly.'),
  ('tsʼalq','noun','a talon, a claw.',NULL,NULL),
  ('ʔungh','noun','a horn.',NULL,NULL),
  ('verokh','noun','a fang, a tooth.',NULL,NULL),
  ('maʔûl','noun','the maw, the jaws.',NULL,NULL),
  ('ʔil','noun','an eye.',NULL,NULL),
  ('voq','noun','the heart.',NULL,NULL),
  ('sanḥ','noun','blood.',NULL,NULL),
  ('tʼokh','noun','a bone.',NULL,NULL),
  ('reʔ','noun','a hand.',NULL,NULL),
  ('khul','noun','a foot.',NULL,NULL),
  ('qʼaḥ','noun','fire.','Sʼughá vharûnqá qʼaḥ.','The dragon breathes fire.'),
  ('ʔashûn','noun','ash.',NULL,NULL),
  ('ʔembor','noun','an ember.',NULL,NULL),
  ('dhukh','noun','smoke.',NULL,NULL),
  ('velà','noun','a flame.',NULL,NULL),
  ('tʼarq','noun','stone.',NULL,NULL),
  ('qorûn','noun','a mountain.',NULL,NULL),
  ('vaʔ','noun','the sky.',NULL,NULL),
  ('sturoq','noun','a storm.',NULL,NULL),
  ('ghil','noun','wind.',NULL,NULL),
  ('ʔestá','noun','a star.',NULL,NULL),
  ('sháur','noun','the sun.',NULL,NULL),
  ('lunà','noun','the moon.',NULL,NULL),
  ('ghold','noun','gold.',NULL,NULL),
  ('jadhûr','noun','jade.',NULL,NULL),
  ('muʔ','noun','water.',NULL,NULL),
  ('vharûn','noun','a dragon, a wyrm.',NULL,NULL),
  ('voʔûn','noun','a hoard.',NULL,NULL),
  ('ʔeldhor','noun','an elder wyrm, an ancient dragon.',NULL,NULL),
  ('qʼopʼ','noun','an egg.',NULL,NULL),
  ('broʔ','noun','a brood, a clutch.',NULL,NULL),
  ('ʔoth','noun','an oath, a binding word.',NULL,NULL),
  ('naʔûr','noun','a true-name, a name of power.',NULL,NULL),
  ('tʼavul','noun','law, the Empire''s edict.',NULL,NULL),
  ('ʔimperûq','noun','the Verdant Empire.',NULL,NULL),
  ('velʔûr','noun','fire-speech; the true Draconic tongue.',NULL,NULL),
  ('dhar','noun','a tree.',NULL,NULL),
  ('riʔûl','noun','a river.',NULL,NULL),
  ('voskh','noun','a forest.',NULL,NULL),
  ('tʼel','noun','earth, soil.',NULL,NULL),
  ('roq','noun','a road, a way.',NULL,NULL),
  ('nakht','noun','night.',NULL,NULL),
  ('sháo','noun','day.',NULL,NULL),
  ('faʔ','noun','a beast.',NULL,NULL),
  ('khir','noun','a bird.',NULL,NULL),
  ('ʔansh','noun','a human, a mortal.',NULL,NULL),
  ('ʔamar','noun','kin, blood-kindred.',NULL,NULL),
  ('voʔul','noun','a lair, a dwelling.',NULL,NULL),
  ('ghár','verb','to fly.',NULL,NULL),
  ('verq','verb','to burn.',NULL,NULL),
  ('voʔ','verb','to hoard.',NULL,NULL),
  ('khamʼ','verb','to devour.',NULL,NULL),
  ('sʼugh','verb','to breathe fire.',NULL,NULL),
  ('riʔ','verb','to rise.',NULL,NULL),
  ('tʼaur','verb','to reign, to rule.',NULL,NULL),
  ('qʼen','verb','to guard.',NULL,NULL),
  ('dhomʼ','verb','to sleep the long sleep.',NULL,NULL),
  ('brekh','verb','to break, to shatter.',NULL,NULL),
  ('velʼ','verb','to speak, to say.',NULL,NULL),
  ('khen','verb','to know.',NULL,NULL),
  ('miʔ','verb','to see.',NULL,NULL),
  ('luʔ','verb','to hear.',NULL,NULL),
  ('tan','verb','to take.',NULL,NULL),
  ('ghen','verb','to give.',NULL,NULL),
  ('makh','verb','to make, to craft.',NULL,NULL),
  ('qad','verb','to go.',NULL,NULL),
  ('tunʼ','verb','to hold.',NULL,NULL),
  ('skarʔ','verb','to hunt.',NULL,NULL),
  ('ghesh','verb','to fear.',NULL,NULL),
  ('wár','verb','to be, to exist.',NULL,NULL),
  ('sʼar','adjective','great, vast.',NULL,NULL),
  ('ʔeldh','adjective','ancient, elder.',NULL,NULL),
  ('briʔ','adjective','bright.',NULL,NULL),
  ('doqh','adjective','deep.',NULL,NULL),
  ('verdh','adjective','verdant, green.',NULL,NULL),
  ('gholʼ','adjective','golden.',NULL,NULL),
  ('hulʼ','adjective','hollow, empty.',NULL,NULL),
  ('haʔûr','adjective','sacred, hallowed.',NULL,NULL),
  ('qruʔ','adjective','cruel.',NULL,NULL),
  ('swikh','adjective','swift.',NULL,NULL),
  ('nuʔ','particle','not (pre-verbal negator).',NULL,NULL),
  ('ʔun','conjunction','and.',NULL,NULL),
  ('shaq','determiner','this, these (near).',NULL,NULL),
  ('thaq','determiner','that, those (far).',NULL,NULL),
  ('qʼáʔ','particle','exalting particle: raises the following word to the draconic register.',NULL,NULL)
) AS m(word, pos, def, ex, tr) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- A second sense on a few words (multi-sense entries).
INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 2, m.pos, m.def
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
JOIN (VALUES
  ('qʼaḥ','noun','zeal, the fire of the spirit.'),
  ('naʔûr','noun','reputation, how one''s name is spoken.'),
  ('ghúr','noun','a sail; anything that catches the wind.'),
  ('velʼ','verb','to command, to decree (when a dragon speaks).')
) AS m(word, pos, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- ============================================================================
-- 10. Inflection assignments (class + stem).
-- ============================================================================
-- Sovereign nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Sovereign'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('khaʔ','ghúr','tsʼalq','ʔungh','verokh','maʔûl',
                 'qʼaḥ','ʔashûn','ʔembor','dhukh','velà','tʼarq','qorûn','vaʔ','sturoq','ghil','ʔestá','sháur','lunà','ghold','jadhûr','muʔ',
                 'vharûn','voʔûn','ʔeldhor','qʼopʼ','broʔ','ʔoth','naʔûr','tʼavul','ʔimperûq','velʔûr')
ON CONFLICT DO NOTHING;

-- Common nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Common'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('ʔil','voq','sanḥ','tʼokh','reʔ','khul',
                 'dhar','riʔûl','voskh','tʼel','roq','nakht','sháo','faʔ','khir',
                 'ʔansh','ʔamar','voʔul')
ON CONFLICT DO NOTHING;

-- Strong verbs
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Strong'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('ghár','verq','voʔ','khamʼ','sʼugh','riʔ','tʼaur','qʼen','dhomʼ','brekh')
ON CONFLICT DO NOTHING;

-- Weak verbs
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Weak'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial'
WHERE l.word IN ('velʼ','khen','miʔ','luʔ','tan','ghen','makh','qad','tunʼ','skarʔ','ghesh','wár')
ON CONFLICT DO NOTHING;

-- Irregular overrides ---------------------------------------------------------
-- wár "to be": suppletive root ʔos- throughout the past tense.
UPDATE lexicon_inflections li SET overrides = '{
  "past.p1":"haʔosim","past.p2":"haʔosit","past.p3":"haʔosi","past.p4":"haʔosé"
}'::jsonb
WHERE li.entry_id = (SELECT l.id FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial' WHERE l.word='wár');

-- sʼugh "to breathe fire": the 4th-person present is a fixed sacred form.
UPDATE lexicon_inflections li SET overrides = '{"present.p4":"sʼughûná","future.p4":"qʼasʼughûná"}'::jsonb
WHERE li.entry_id = (SELECT l.id FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial' WHERE l.word='sʼugh');

-- vharûn "dragon": irregular myriad "vharoth" = the whole brood-multitude.
UPDATE lexicon_inflections li SET overrides = '{"myriad.absolutive":"vharoth","myriad.ergative":"vharothqá"}'::jsonb
WHERE li.entry_id = (SELECT l.id FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='verdant-draconic-imperial' WHERE l.word='vharûn');

-- ============================================================================
-- 11. Relations — the correspondence "key", plus compound & derivation.
-- ============================================================================
-- Compound: ʔaʔʔuq (7) = ʔaʔ (6) + ʔuq (1).
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'compound_of', n.note
FROM languages lg
JOIN lexicon s ON s.language_id=lg.id AND s.word='ʔaʔʔuq'
JOIN (VALUES ('ʔaʔ','the base "six"'), ('ʔuq','the added "one"')) AS n(w, note) ON true
JOIN lexicon t ON t.language_id=lg.id AND t.word=n.w
WHERE lg.slug='verdant-draconic-imperial'
ON CONFLICT DO NOTHING;

-- Derivation: velʔûr "fire-speech" derived from velʼ "to speak".
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'derived_from', 'Deverbal noun: "the speaking of fire".'
FROM languages lg
JOIN lexicon s ON s.language_id=lg.id AND s.word='velʔûr'
JOIN lexicon t ON t.language_id=lg.id AND t.word='velʼ'
WHERE lg.slug='verdant-draconic-imperial'
ON CONFLICT DO NOTHING;

-- THE KEY: VDI words as regular reflexes of Old Draconic etyma. loan_from marks
-- the ones the Empire consciously borrowed-and-tamed; derived_from the inherited.
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, m.rel, m.note
FROM (VALUES
  ('qʼaḥ',  '*χʁōm̥',   'derived_from', 'Drop the subsonic *χʁ- onset → qʼ-; the whole word left low, near the rumble.'),
  ('vharûn','*wʱarûŋ',  'derived_from', 'Fire-voiced *wʱ- → human vh-; final *-ŋ → -n.'),
  ('ghold', '*ʁʱolð',   'derived_from', 'Rumble-voiced *ʁʱ- → gh-; *-ð → -d.'),
  ('ghár',  '*ɢʱár',    'derived_from', 'Infrasound *ɢʱ- → gh-; the high tone is kept as the dragon''s own.'),
  ('vaʔ',   '*ʔm̥bʱa',   'derived_from', 'Creaky *ʔm̥bʱa collapses to a glottal-final vaʔ.'),
  ('naʔûr', '*naʔʱûr',  'derived_from', 'Nearly untouched; the sayable core of the true-name root.'),
  ('voʔûn', '*wʕoðʱ',   'loan_from',    'Consciously borrowed as the Imperial word for a tamed, catalogued hoard.')
) AS m(vdi, od, rel, note)
JOIN languages vl ON vl.slug='verdant-draconic-imperial'
JOIN languages ol ON ol.slug='old-draconic'
JOIN lexicon s ON s.language_id=vl.id AND s.word=m.vdi
JOIN lexicon t ON t.language_id=ol.id AND t.word=m.od
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. Dialect variants.
-- ============================================================================
-- High Imperial keeps tone & ejectives; Trade Pidgin flattens both.
INSERT INTO lexicon_variants (entry_id, dialect_id, pronunciation, spelling, notes)
SELECT l.id, d.id, m.pron, m.spell, m.note
FROM languages lg
JOIN lexicon l ON l.language_id=lg.id
JOIN (VALUES
  ('qʼaḥ','high-imperial','qʼaħ',  NULL,    'Court form: ejective and pharyngeal kept crisp.'),
  ('qʼaḥ','trade-pidgin', 'kax',   'kakh',  'Market form: ejective → plain k, pharyngeal → kh, tone lost.'),
  ('vharûn','trade-pidgin','vaˈrun','varun','Fire-voice onset and length dropped.'),
  ('ʔirá','trade-pidgin', 'iˈra',  'ira',   'Glottal onset and high tone lost; reverence flattened.')
) AS m(word, dslug, pron, spell, note) ON m.word = l.word
JOIN language_dialects d ON d.language_id=lg.id AND d.slug=m.dslug
WHERE lg.slug='verdant-draconic-imperial'
ON CONFLICT (entry_id, dialect_id) DO NOTHING;

-- ============================================================================
-- 13. Backfill body sizes.
-- ============================================================================
UPDATE languages SET body_size_bytes = octet_length(body)
WHERE slug IN ('verdant-draconic-imperial','old-draconic') AND body_size_bytes = 0;

-- Verify:
--   SELECT count(*) FROM lexicon l JOIN languages lg ON lg.id=l.language_id WHERE lg.slug='verdant-draconic-imperial'; -- expect 100
--   SELECT count(*) FROM lexicon_inflections li JOIN lexicon l ON l.id=li.entry_id
--     JOIN languages lg ON lg.id=l.language_id WHERE lg.slug='verdant-draconic-imperial';  -- expect 77

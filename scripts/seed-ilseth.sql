-- ============================================================================
-- SEED: Ilseth — an invented language, built to exercise EVERY Wordbook system.
-- ----------------------------------------------------------------------------
-- Ilseth (native: Ilsethun, "the shaped-speech") is a wholly invented tongue —
-- not derived from any real language. It is spoken by the marsh-basin folk of a
-- fictional world. Its signature features:
--   * Tripartite NUMBER: singular / paired / collective.
--   * Five "reaches" (CASES): core, mark, source, goal, vessel.
--   * BRIGHT vs DARK echo-harmony: suffix vowels echo the last stem vowel.
--     Realised in the schema as two declension classes (Bright / Dark), plus a
--     third animate class (Living) for people and beasts.
--   * ASPECT-first verbs: unfolding / sealed / latent, prefix-marked, with a
--     six-way person suffix. Two conjugations (Steady / Shifting) — Shifting is
--     the dark-harmony verb class. Suppletion handled by per-word overrides.
--   * Base-EIGHT numerals (the folk count the gaps between the fingers).
--   * Verb-initial (VSO), head-marking syntax.
--
-- Direct DB writes on purpose: creating a language + paradigm classes/dimensions
-- is admin-gated and words/phonemes are editor-gated (see trial-wordbook-roun.sql).
-- Idempotent-ish: ON CONFLICT DO NOTHING on natural keys; re-running is safe but
-- will not overwrite an existing Ilseth. To reset: DELETE FROM languages WHERE
-- slug IN ('ilseth','proto-vethic'); (cascades to everything below).
--
-- Run: docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-ilseth.sql
-- ============================================================================

-- --- 1. Languages: proto ancestor + the daughter, wired into a family tree ---
INSERT INTO languages (name, slug, native_name, script, family, color, language_type, description, body) VALUES
('Proto-Vethic', 'proto-vethic', '*Wethu', 'unwritten (reconstructed)', 'Vethic', '#6b7a5e', 'proto',
 'The reconstructed common ancestor of the Vethic tongues. Attested only through its descendants.', ''),
('Ilseth', 'ilseth', 'Ilsethun', 'Ilseth tide-script', 'Vethic', '#2f8f83', 'language',
 'The shaped-speech of the marsh-basin folk; the best-attested Vethic tongue.', $body$
'''Ilseth''' (native '''Ilsethun''', "the shaped-speech") is the tongue of the marsh-basin folk. It is a fully invented language — not built on, borrowed from, or reskinned from any language spoken in the real world. It is agglutinating, verb-initial, and famous for its '''echo-harmony''', in which the vowels of every ending bend to match the last vowel of the word they attach to.

== Phonology ==
Ilseth has a modest inventory — no tone, no length distinction, and a strong taste for the sounds ''l, r, n, s, th, v''. Two glides (''w, y'') fill the gaps when suffixes create vowel-on-vowel meetings (''aru + or'' &rarr; [ˈa.ru.wor]).

{{Phonology|ilseth}}

=== Echo-harmony ===
Every stem is either '''bright''' (its last vowel is ''e, i, ei,'' or ''ai'') or '''dark''' (its last vowel is ''a, o,'' or ''u''). Endings come in two shapes and the word chooses the matching one:

* bright ''nell'' "hand" &rarr; source '''nell'''es'', goal '''nell'''eth''
* dark ''sath'' "head" &rarr; source '''sath'''as'', goal '''sath'''ath''

This single rule runs through the whole grammar — nouns, verbs, everything. In the tables below it is captured as separate '''Bright''' and '''Dark''' paradigm classes.

== Orthography ==
Ilseth is written in the '''tide-script''', an invented syllabic hand with no Unicode home; the Wordbook stores Latin romanisation stand-ins. Five digraphs carry single sounds: ''th'' /θ/, ''sh'' /ʃ/, ''kh'' /x/, ''ng'' /ŋ/, ''ts'' /t͡s/.

{{Orthography|ilseth}}

== Grammar ==
=== Number: singular, paired, collective ===
Ilseth counts in threes. The '''singular''' is one; the '''paired''' is a natural or habitual couple (two eyes, a married pair, the two banks of a river); the '''collective''' is a mass or a many-as-one (a crowd, a forest, all the rain). "Two houses that happen to stand together" is paired; "the houses of the town" is collective.

=== Case: the five reaches ===
A noun's ending marks which "reach" it holds in the clause:

* '''core''' — the bare doer or the thing named (nominative / citation).
* '''mark''' — the thing done-to (accusative).
* '''source''' — origin, possessor, cause (genitive / ablative): ''from, of, because of''.
* '''goal''' — destination or recipient (dative / allative): ''to, toward, for''.
* '''vessel''' — location, instrument, or means (locative / instrumental): ''in, with, by''.

Endings fuse number and case into one suffix. See {{Inflections|ilseth}} for the full paradigm tables.

=== Verbs: aspect before person ===
Ilseth verbs do not mark tense — they mark '''aspect''', how an action sits in time:

* '''unfolding''' — ongoing, habitual, or simply present (unmarked).
* '''sealed''' — complete, whole, done (prefix ''ver-'' / dark ''vor-'').
* '''latent''' — not-yet, about-to, or would-be; doubles as the future and the irrealis (prefix ''sha-'' / dark ''sho-'').

To this the verb adds a '''person''' ending for its subject (Ilseth is head-marking, so the subject pronoun is usually dropped). A few very common verbs are suppletive — ''len'' "to go" borrows the root ''vath-'' in the sealed aspect — and these are stored as per-word overrides.

=== Word order & numerals ===
The clause is '''verb-initial''' (VSO): ''Lena varek rovanav'' "walks the-person on-the-road". Numerals are '''base eight''' — the folk count the eight gaps between the fingers, so ''varan'' "eight" is the base of the count and ''varanith'' is literally "eight-one" = nine.

== A worked line ==
: '''Sha'''len'''u''' '''an''' kival'''eth''' vun'''av'''.
: LATENT-go-1SG I house-GOAL night-VESSEL
: "I will go home in the night."
$body$)
ON CONFLICT (slug) DO NOTHING;

-- Wire the tree: Ilseth descends from Proto-Vethic.
UPDATE languages SET parent_language_id = (SELECT id FROM languages WHERE slug = 'proto-vethic')
WHERE slug = 'ilseth';

-- --- 2. Dialects (exercises language_dialects + lexicon_variants) -------------
INSERT INTO language_dialects (language_id, name, slug, region, description) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'Highland Ilseth', 'highland', 'The dry upper terraces',
 'Conservative dialect of the terrace towns; keeps the old hard /k/ where the lowlands soften it.'),
((SELECT id FROM languages WHERE slug='ilseth'), 'Rivermouth Ilseth', 'rivermouth', 'The tidal delta',
 'Coastal dialect of the delta; drops final /n/ and lengthens the vowel before it.')
ON CONFLICT (language_id, slug) DO NOTHING;

-- --- 3. Phoneme inventory ----------------------------------------------------
-- Wipe prior Ilseth phonemes so re-runs stay idempotent (no unique key to conflict on).
DELETE FROM phonemes WHERE language_id = (SELECT id FROM languages WHERE slug='ilseth');
INSERT INTO phonemes (language_id, ipa, type, place, manner, voicing, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'p',  'consonant', 'bilabial',     'plosive',             'voiceless', 10, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'b',  'consonant', 'bilabial',     'plosive',             'voiced',    11, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 't',  'consonant', 'alveolar',     'plosive',             'voiceless', 20, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'd',  'consonant', 'alveolar',     'plosive',             'voiced',    21, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'k',  'consonant', 'velar',        'plosive',             'voiceless', 30, 'softens to [x] between vowels in Rivermouth'),
((SELECT id FROM languages WHERE slug='ilseth'), 'g',  'consonant', 'velar',        'plosive',             'voiced',    31, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'm',  'consonant', 'bilabial',     'nasal',               'voiced',    40, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'n',  'consonant', 'alveolar',     'nasal',               'voiced',    41, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'ŋ',  'consonant', 'velar',        'nasal',               'voiced',    42, 'spelled ng; never word-initial'),
((SELECT id FROM languages WHERE slug='ilseth'), 't͡s', 'consonant', 'alveolar',     'affricate',           'voiceless', 50, 'spelled ts'),
((SELECT id FROM languages WHERE slug='ilseth'), 'f',  'consonant', 'labiodental',  'fricative',           'voiceless', 60, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'v',  'consonant', 'labiodental',  'fricative',           'voiced',    61, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'θ',  'consonant', 'dental',       'fricative',           'voiceless', 62, 'spelled th'),
((SELECT id FROM languages WHERE slug='ilseth'), 's',  'consonant', 'alveolar',     'fricative',           'voiceless', 63, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'z',  'consonant', 'alveolar',     'fricative',           'voiced',    64, 'marginal; mostly across morpheme seams'),
((SELECT id FROM languages WHERE slug='ilseth'), 'ʃ',  'consonant', 'postalveolar', 'fricative',           'voiceless', 65, 'spelled sh'),
((SELECT id FROM languages WHERE slug='ilseth'), 'x',  'consonant', 'velar',        'fricative',           'voiceless', 66, 'spelled kh'),
((SELECT id FROM languages WHERE slug='ilseth'), 'h',  'consonant', 'glottal',      'fricative',           'voiceless', 67, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'r',  'consonant', 'alveolar',     'trill',               'voiced',    70, 'a tap [ɾ] between vowels'),
((SELECT id FROM languages WHERE slug='ilseth'), 'l',  'consonant', 'alveolar',     'lateral approximant', 'voiced',    80, NULL),
((SELECT id FROM languages WHERE slug='ilseth'), 'j',  'consonant', 'palatal',      'approximant',         'voiced',    90, 'spelled y'),
((SELECT id FROM languages WHERE slug='ilseth'), 'w',  'consonant', 'labial-velar', 'approximant',         'voiced',    91, NULL);

INSERT INTO phonemes (language_id, ipa, type, height, backness, rounded, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'i', 'vowel', 'close', 'front',   false, 10, 'bright'),
((SELECT id FROM languages WHERE slug='ilseth'), 'e', 'vowel', 'mid',   'front',   false, 20, 'bright'),
((SELECT id FROM languages WHERE slug='ilseth'), 'a', 'vowel', 'open',  'central', false, 30, 'dark'),
((SELECT id FROM languages WHERE slug='ilseth'), 'o', 'vowel', 'mid',   'back',    true,  40, 'dark'),
((SELECT id FROM languages WHERE slug='ilseth'), 'u', 'vowel', 'close', 'back',    true,  50, 'dark');

-- Diphthongs (bright): the grid renders only consonant/vowel, but they belong to the inventory.
INSERT INTO phonemes (language_id, ipa, type, sort_order, notes) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'ai', 'diphthong', 10, 'bright; spelled ai'),
((SELECT id FROM languages WHERE slug='ilseth'), 'ei', 'diphthong', 20, 'bright; spelled ei');

-- --- 4. Orthography: graphemes + ordered grapheme->phoneme mapping ------------
-- Wipe prior Ilseth graphemes (cascades to grapheme_phonemes) for idempotent re-runs.
DELETE FROM graphemes WHERE language_id = (SELECT id FROM languages WHERE slug='ilseth');
INSERT INTO graphemes (language_id, grapheme, romanization, environment, notes, sort_order) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'th', 'th', NULL, 'Digraph for /θ/.',            0),
((SELECT id FROM languages WHERE slug='ilseth'), 'sh', 'sh', NULL, 'Digraph for /ʃ/.',            1),
((SELECT id FROM languages WHERE slug='ilseth'), 'kh', 'kh', NULL, 'Digraph for /x/.',            2),
((SELECT id FROM languages WHERE slug='ilseth'), 'ng', 'ng', 'not word-initial', 'Digraph for /ŋ/.', 3),
((SELECT id FROM languages WHERE slug='ilseth'), 'ts', 'ts', NULL, 'Digraph for the affricate /t͡s/.', 4),
((SELECT id FROM languages WHERE slug='ilseth'), 'y',  'y',  NULL, 'Glide /j/; also breaks vowel hiatus.', 5),
((SELECT id FROM languages WHERE slug='ilseth'), 'ai', 'ai', NULL, 'Bright diphthong /ai/.',      6),
((SELECT id FROM languages WHERE slug='ilseth'), 'ei', 'ei', NULL, 'Bright diphthong /ei/.',      7);

-- Link the digraphs/diphthongs to their phoneme sequences (position-ordered).
-- Single-phoneme digraphs map to one phoneme at position 0.
INSERT INTO grapheme_phonemes (grapheme_id, phoneme_id, position)
SELECT g.id, p.id, 0
FROM graphemes g
JOIN languages l ON l.id = g.language_id AND l.slug = 'ilseth'
JOIN (VALUES ('th','θ'),('sh','ʃ'),('kh','x'),('ng','ŋ'),('ts','t͡s'),('y','j'),('ai','ai'),('ei','ei')) AS m(grph, ipa)
  ON m.grph = g.grapheme
JOIN phonemes p ON p.language_id = l.id AND p.ipa = m.ipa
ON CONFLICT DO NOTHING;

-- --- 5. Inflection dimensions (axes) -----------------------------------------
-- NOUN: number (rows, sortOrder 0) x case (columns, sortOrder 1).
-- Cell keys are dot-joined lowest-sortOrder-first, e.g. "singular.core", "collective.vessel".
INSERT INTO inflection_dimensions (language_id, part_of_speech, name, dim_values, sort_order) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'noun', 'number',
   ARRAY['singular','paired','collective'], 0),
((SELECT id FROM languages WHERE slug='ilseth'), 'noun', 'case',
   ARRAY['core','mark','source','goal','vessel'], 1),
-- VERB: aspect (rows) x person (columns).
((SELECT id FROM languages WHERE slug='ilseth'), 'verb', 'aspect',
   ARRAY['unfolding','sealed','latent'], 0),
((SELECT id FROM languages WHERE slug='ilseth'), 'verb', 'person',
   ARRAY['s1','s2','s3','p1','p2','p3'], 1)
ON CONFLICT (language_id, part_of_speech, name) DO NOTHING;

-- --- 6. Paradigm classes -----------------------------------------------------
INSERT INTO paradigm_classes (language_id, part_of_speech, name, description) VALUES
((SELECT id FROM languages WHERE slug='ilseth'), 'noun', 'Bright',
 'For stems whose last vowel is bright (e, i, ei, ai). Front-vowel endings.'),
((SELECT id FROM languages WHERE slug='ilseth'), 'noun', 'Dark',
 'For stems whose last vowel is dark (a, o, u). Back/central-vowel endings.'),
((SELECT id FROM languages WHERE slug='ilseth'), 'noun', 'Living',
 'Animate class: people and beasts. Distinct kin-plural in -in ("the folk of...").'),
((SELECT id FROM languages WHERE slug='ilseth'), 'verb', 'Steady',
 'Regular (bright) conjugation: aspect prefix ver-/sha-, front-vowel person endings.'),
((SELECT id FROM languages WHERE slug='ilseth'), 'verb', 'Shifting',
 'Dark-harmony conjugation: aspect prefix vor-/sho-, back-vowel person endings.')
ON CONFLICT (language_id, part_of_speech, name) DO NOTHING;

-- --- 7. Paradigm rules (per-cell affix patterns; {stem} = the stem) ----------
-- NOUN · Bright (number linker: sing -, paired -el-, coll -er-; case: core -, mark -n, source -s, goal -th, vessel -v)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='ilseth') AND part_of_speech='noun' AND name='Bright'),
       k, v
FROM (VALUES
  ('singular.core','{stem}'),      ('singular.mark','{stem}en'),   ('singular.source','{stem}es'),
  ('singular.goal','{stem}eth'),   ('singular.vessel','{stem}ev'),
  ('paired.core','{stem}el'),      ('paired.mark','{stem}elen'),   ('paired.source','{stem}eles'),
  ('paired.goal','{stem}eleth'),   ('paired.vessel','{stem}elev'),
  ('collective.core','{stem}er'),  ('collective.mark','{stem}eren'),('collective.source','{stem}eres'),
  ('collective.goal','{stem}ereth'),('collective.vessel','{stem}erev')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- NOUN · Dark (paired -al-, coll -or-; case vowel a)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='ilseth') AND part_of_speech='noun' AND name='Dark'),
       k, v
FROM (VALUES
  ('singular.core','{stem}'),      ('singular.mark','{stem}an'),   ('singular.source','{stem}as'),
  ('singular.goal','{stem}ath'),   ('singular.vessel','{stem}av'),
  ('paired.core','{stem}al'),      ('paired.mark','{stem}alan'),   ('paired.source','{stem}alas'),
  ('paired.goal','{stem}alath'),   ('paired.vessel','{stem}alav'),
  ('collective.core','{stem}or'),  ('collective.mark','{stem}oran'),('collective.source','{stem}oras'),
  ('collective.goal','{stem}orath'),('collective.vessel','{stem}orav')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- NOUN · Living (animate; kin-plural -in; personal goal -na)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='ilseth') AND part_of_speech='noun' AND name='Living'),
       k, v
FROM (VALUES
  ('singular.core','{stem}'),      ('singular.mark','{stem}an'),   ('singular.source','{stem}in'),
  ('singular.goal','{stem}na'),    ('singular.vessel','{stem}ith'),
  ('paired.core','{stem}u'),       ('paired.mark','{stem}un'),     ('paired.source','{stem}uin'),
  ('paired.goal','{stem}una'),     ('paired.vessel','{stem}uith'),
  ('collective.core','{stem}in'),  ('collective.mark','{stem}inan'),('collective.source','{stem}inin'),
  ('collective.goal','{stem}inna'),('collective.vessel','{stem}inith')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- VERB · Steady (aspect prefix: unfolding -, sealed ver-, latent sha-; person: s1 -u, s2 -ash, s3 -a, p1 -um, p2 -ashen, p3 -ath)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='ilseth') AND part_of_speech='verb' AND name='Steady'),
       k, v
FROM (VALUES
  ('unfolding.s1','{stem}u'),     ('unfolding.s2','{stem}ash'),   ('unfolding.s3','{stem}a'),
  ('unfolding.p1','{stem}um'),    ('unfolding.p2','{stem}ashen'), ('unfolding.p3','{stem}ath'),
  ('sealed.s1','ver{stem}u'),     ('sealed.s2','ver{stem}ash'),   ('sealed.s3','ver{stem}a'),
  ('sealed.p1','ver{stem}um'),    ('sealed.p2','ver{stem}ashen'), ('sealed.p3','ver{stem}ath'),
  ('latent.s1','sha{stem}u'),     ('latent.s2','sha{stem}ash'),   ('latent.s3','sha{stem}a'),
  ('latent.p1','sha{stem}um'),    ('latent.p2','sha{stem}ashen'), ('latent.p3','sha{stem}ath')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- VERB · Shifting (dark harmony: sealed vor-, latent sho-; person back vowels o)
INSERT INTO paradigm_rules (class_id, cell_key, pattern)
SELECT (SELECT id FROM paradigm_classes WHERE language_id=(SELECT id FROM languages WHERE slug='ilseth') AND part_of_speech='verb' AND name='Shifting'),
       k, v
FROM (VALUES
  ('unfolding.s1','{stem}o'),     ('unfolding.s2','{stem}osh'),   ('unfolding.s3','{stem}o'),
  ('unfolding.p1','{stem}om'),    ('unfolding.p2','{stem}oshen'), ('unfolding.p3','{stem}oth'),
  ('sealed.s1','vor{stem}o'),     ('sealed.s2','vor{stem}osh'),   ('sealed.s3','vor{stem}o'),
  ('sealed.p1','vor{stem}om'),    ('sealed.p2','vor{stem}oshen'), ('sealed.p3','vor{stem}oth'),
  ('latent.s1','sho{stem}o'),     ('latent.s2','sho{stem}osh'),   ('latent.s3','sho{stem}o'),
  ('latent.p1','sho{stem}om'),    ('latent.p2','sho{stem}oshen'), ('latent.p3','sho{stem}oth')
) AS r(k, v)
ON CONFLICT (class_id, cell_key) DO NOTHING;

-- --- 8. Proto-Vethic etymon entries (for etymology chains & cognates) ---------
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
('*watu',  (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈwa.tu',  'Reconstructed root.'),
('*sena',  (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈse.na',  'Reconstructed root.'),
('*nokti', (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈnok.ti', 'Reconstructed root.'),
('*widi',  (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈwi.di',  'Reconstructed root.'),
('*lena',  (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈle.na',  'Reconstructed root.'),
('*warnu', (SELECT id FROM languages WHERE slug='proto-vethic'), 'ˈwar.nu', 'Reconstructed root.')
ON CONFLICT DO NOTHING;

INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 1, m.pos, m.def
FROM lexicon l
JOIN languages lg ON lg.id = l.language_id AND lg.slug = 'proto-vethic'
JOIN (VALUES
  ('*watu','noun','running water; a stream'),
  ('*sena','noun','fire; the hearth'),
  ('*nokti','noun','night; the dark half'),
  ('*widi','verb','to see, to perceive'),
  ('*lena','verb','to go, to move along'),
  ('*warnu','noun','a grown person; one of the folk')
) AS m(word, pos, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- ============================================================================
-- 9. Ilseth lexicon — 100 basic words
-- Class tag in the comment: [B]=Bright noun, [D]=Dark noun, [L]=Living noun,
-- [St]=Steady verb, [Sh]=Shifting verb; others uninflected (pronoun/num/adj/part).
-- ============================================================================
INSERT INTO lexicon (word, language_id, pronunciation, notes) VALUES
-- Pronouns
('an',      (SELECT id FROM languages WHERE slug='ilseth'), 'an',        'Personal pronoun; dropped when the verb marks person.'),
('thu',     (SELECT id FROM languages WHERE slug='ilseth'), 'θu',        NULL),
('se',      (SELECT id FROM languages WHERE slug='ilseth'), 'se',        'Gender-neutral; covers he, she, it, and singular they.'),
('anin',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈa.nin',    NULL),
('thurin',  (SELECT id FROM languages WHERE slug='ilseth'), 'ˈθu.rin',   NULL),
('sin',     (SELECT id FROM languages WHERE slug='ilseth'), 'sin',       NULL),
-- Numerals (base 8)
('ith',     (SELECT id FROM languages WHERE slug='ilseth'), 'iθ',        NULL),
('dova',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈdo.va',    NULL),
('thren',   (SELECT id FROM languages WHERE slug='ilseth'), 'θren',      NULL),
('karu',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈka.ru',    NULL),
('selva',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈsel.va',   NULL),
('noru',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈno.ru',    NULL),
('hesh',    (SELECT id FROM languages WHERE slug='ilseth'), 'heʃ',       NULL),
('varan',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈva.ran',   'Base of the count; "a full set of finger-gaps".'),
('varanith',(SELECT id FROM languages WHERE slug='ilseth'), 'ˌva.ra.ˈniθ','Literally "eight-one".'),
-- Body
('sath',    (SELECT id FROM languages WHERE slug='ilseth'), 'saθ',       NULL),
('lian',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈli.an',    NULL),
('vess',    (SELECT id FROM languages WHERE slug='ilseth'), 'ves',       NULL),
('nell',    (SELECT id FROM languages WHERE slug='ilseth'), 'nel',       NULL),
('tuar',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈtu.ar',    NULL),
('rethi',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈre.θi',    NULL),
('kona',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈko.na',    NULL),
('shan',    (SELECT id FROM languages WHERE slug='ilseth'), 'ʃan',       NULL),
('hava',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈha.va',    NULL),
('mira',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈmi.ra',    NULL),
-- Nature
('aru',     (SELECT id FROM languages WHERE slug='ilseth'), 'ˈa.ru',     NULL),
('sena',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈse.na',    NULL),
('thal',    (SELECT id FROM languages WHERE slug='ilseth'), 'θal',       NULL),
('velu',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈve.lu',    NULL),
('dun',     (SELECT id FROM languages WHERE slug='ilseth'), 'dun',       NULL),
('loth',    (SELECT id FROM languages WHERE slug='ilseth'), 'loθ',       NULL),
('isha',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈi.ʃa',     NULL),
('maren',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈma.ren',   NULL),
('vash',    (SELECT id FROM languages WHERE slug='ilseth'), 'vaʃ',       NULL),
('lira',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈli.ra',    NULL),
('esti',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈes.ti',    NULL),
('she',     (SELECT id FROM languages WHERE slug='ilseth'), 'ʃe',        NULL),
('moru',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈmo.ru',    NULL),
('neith',   (SELECT id FROM languages WHERE slug='ilseth'), 'neiθ',      NULL),
('thora',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈθo.ra',    NULL),
('dela',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈde.la',    NULL),
('koran',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈko.ran',   NULL),
('rathu',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈra.θu',    NULL),
('sivel',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈsi.vel',   NULL),
('thai',    (SELECT id FROM languages WHERE slug='ilseth'), 'θai',       NULL),
('vun',     (SELECT id FROM languages WHERE slug='ilseth'), 'vun',       NULL),
('serin',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈse.rin',   NULL),
('nakh',    (SELECT id FROM languages WHERE slug='ilseth'), 'nax',       NULL),
('kesh',    (SELECT id FROM languages WHERE slug='ilseth'), 'keʃ',       NULL),
-- Beings & kin (Living)
('faru',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈfa.ru',    NULL),
('reshi',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈre.ʃi',    NULL),
('kuna',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈku.na',    NULL),
('thelu',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈθe.lu',    NULL),
('mora',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈmo.ra',    NULL),
('varek',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈva.rek',   'The unmarked word for a human being.'),
('ilse',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈil.se',    'The root of the language-name Ilseth.'),
('neth',    (SELECT id FROM languages WHERE slug='ilseth'), 'neθ',       NULL),
('dar',     (SELECT id FROM languages WHERE slug='ilseth'), 'dar',       NULL),
('meth',    (SELECT id FROM languages WHERE slug='ilseth'), 'meθ',       NULL),
('seth',    (SELECT id FROM languages WHERE slug='ilseth'), 'seθ',       NULL),
('thuran',  (SELECT id FROM languages WHERE slug='ilseth'), 'ˈθu.ran',   NULL),
-- Objects, dwelling, food
('resh',    (SELECT id FROM languages WHERE slug='ilseth'), 'reʃ',       NULL),
('vael',    (SELECT id FROM languages WHERE slug='ilseth'), 'vael',      NULL),
('kival',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈki.val',   NULL),
('rovan',   (SELECT id FROM languages WHERE slug='ilseth'), 'ˈro.van',   NULL),
('maru',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈma.ru',    NULL),
('koth',    (SELECT id FROM languages WHERE slug='ilseth'), 'koθ',       NULL),
-- Verbs (Steady)
('len',     (SELECT id FROM languages WHERE slug='ilseth'), 'len',       'Suppletive: sealed aspect uses the root vath-.'),
('vir',     (SELECT id FROM languages WHERE slug='ilseth'), 'vir',       NULL),
('mir',     (SELECT id FROM languages WHERE slug='ilseth'), 'mir',       NULL),
('lesh',    (SELECT id FROM languages WHERE slug='ilseth'), 'leʃ',       NULL),
('vel',     (SELECT id FROM languages WHERE slug='ilseth'), 'vel',       NULL),
('ken',     (SELECT id FROM languages WHERE slug='ilseth'), 'ken',       NULL),
('thir',    (SELECT id FROM languages WHERE slug='ilseth'), 'θir',       NULL),
('sel',     (SELECT id FROM languages WHERE slug='ilseth'), 'sel',       NULL),
('den',     (SELECT id FROM languages WHERE slug='ilseth'), 'den',       NULL),
('rin',     (SELECT id FROM languages WHERE slug='ilseth'), 'rin',       NULL),
-- Verbs (Shifting)
('kor',     (SELECT id FROM languages WHERE slug='ilseth'), 'kor',       NULL),
('sur',     (SELECT id FROM languages WHERE slug='ilseth'), 'sur',       NULL),
('tor',     (SELECT id FROM languages WHERE slug='ilseth'), 'tor',       NULL),
('hol',     (SELECT id FROM languages WHERE slug='ilseth'), 'hol',       NULL),
('dov',     (SELECT id FROM languages WHERE slug='ilseth'), 'dov',       NULL),
('vor',     (SELECT id FROM languages WHERE slug='ilseth'), 'vor',       NULL),
('lok',     (SELECT id FROM languages WHERE slug='ilseth'), 'lok',       NULL),
('nag',     (SELECT id FROM languages WHERE slug='ilseth'), 'nag',       NULL),
('tun',     (SELECT id FROM languages WHERE slug='ilseth'), 'tun',       NULL),
('som',     (SELECT id FROM languages WHERE slug='ilseth'), 'som',       NULL),
-- Adjectives
('sael',    (SELECT id FROM languages WHERE slug='ilseth'), 'sael',      NULL),
('nith',    (SELECT id FROM languages WHERE slug='ilseth'), 'niθ',       NULL),
('vesh',    (SELECT id FROM languages WHERE slug='ilseth'), 'veʃ',       NULL),
('thann',   (SELECT id FROM languages WHERE slug='ilseth'), 'θan',       NULL),
('rell',    (SELECT id FROM languages WHERE slug='ilseth'), 'rel',       NULL),
('haru',    (SELECT id FROM languages WHERE slug='ilseth'), 'ˈha.ru',    NULL),
('mel',     (SELECT id FROM languages WHERE slug='ilseth'), 'mel',       NULL),
('groth',   (SELECT id FROM languages WHERE slug='ilseth'), 'groθ',      NULL),
-- Particles & function words
('nu',      (SELECT id FROM languages WHERE slug='ilseth'), 'nu',        'Pre-verbal negator.'),
('wa',      (SELECT id FROM languages WHERE slug='ilseth'), 'wa',        NULL),
('sha',     (SELECT id FROM languages WHERE slug='ilseth'), 'ʃa',        'Proximal determiner.'),
('tha',     (SELECT id FROM languages WHERE slug='ilseth'), 'θa',        'Distal determiner.'),
('kwe',     (SELECT id FROM languages WHERE slug='ilseth'), 'kwe',       'Also the relative "who/which".')
ON CONFLICT DO NOTHING;

-- --- Definitions (sense 1 carries the part_of_speech the inflection engine reads) ---
INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition, usage_example, usage_translation)
SELECT l.id, 1, m.pos, m.def, m.ex, m.tr
FROM lexicon l
JOIN languages lg ON lg.id = l.language_id AND lg.slug = 'ilseth'
JOIN (VALUES
  ('an','pronoun','I, me (first person singular).',NULL,NULL),
  ('thu','pronoun','you (second person singular).',NULL,NULL),
  ('se','pronoun','he, she, it, they (third person singular).',NULL,NULL),
  ('anin','pronoun','we (first person plural).',NULL,NULL),
  ('thurin','pronoun','you (second person plural).',NULL,NULL),
  ('sin','pronoun','they (third person plural).',NULL,NULL),
  ('ith','numeral','one (1).',NULL,NULL),
  ('dova','numeral','two (2).',NULL,NULL),
  ('thren','numeral','three (3).',NULL,NULL),
  ('karu','numeral','four (4).',NULL,NULL),
  ('selva','numeral','five (5).',NULL,NULL),
  ('noru','numeral','six (6).',NULL,NULL),
  ('hesh','numeral','seven (7).',NULL,NULL),
  ('varan','numeral','eight (8); the base of the counting system.',NULL,NULL),
  ('varanith','numeral','nine (9); literally "eight-one".',NULL,NULL),
  ('sath','noun','head.',NULL,NULL),
  ('lian','noun','eye.','Mira lianel.','Two eyes see.'),
  ('vess','noun','mouth.',NULL,NULL),
  ('nell','noun','hand.',NULL,NULL),
  ('tuar','noun','foot.',NULL,NULL),
  ('rethi','noun','heart.',NULL,NULL),
  ('kona','noun','blood.',NULL,NULL),
  ('shan','noun','bone.',NULL,NULL),
  ('hava','noun','skin.',NULL,NULL),
  ('mira','noun','hair.',NULL,NULL),
  ('aru','noun','water.','Sura an aru.','I drink water.'),
  ('sena','noun','fire; a hearth.',NULL,NULL),
  ('thal','noun','earth, soil, land.',NULL,NULL),
  ('velu','noun','wind.',NULL,NULL),
  ('dun','noun','stone.',NULL,NULL),
  ('loth','noun','tree.',NULL,NULL),
  ('isha','noun','leaf.',NULL,NULL),
  ('maren','noun','root.',NULL,NULL),
  ('vash','noun','the sun.',NULL,NULL),
  ('lira','noun','the moon.',NULL,NULL),
  ('esti','noun','star.',NULL,NULL),
  ('she','noun','sky, heaven.',NULL,NULL),
  ('moru','noun','cloud.',NULL,NULL),
  ('neith','noun','rain.',NULL,NULL),
  ('thora','noun','river.',NULL,NULL),
  ('dela','noun','sea.',NULL,NULL),
  ('koran','noun','mountain.',NULL,NULL),
  ('rathu','noun','forest.',NULL,NULL),
  ('sivel','noun','field, meadow.',NULL,NULL),
  ('thai','noun','day.',NULL,NULL),
  ('vun','noun','night.',NULL,NULL),
  ('serin','noun','light.',NULL,NULL),
  ('nakh','noun','darkness, shadow.',NULL,NULL),
  ('kesh','noun','ice, frost.',NULL,NULL),
  ('faru','noun','a beast, an animal.',NULL,NULL),
  ('reshi','noun','bird.',NULL,NULL),
  ('kuna','noun','fish.',NULL,NULL),
  ('thelu','noun','hound, dog.',NULL,NULL),
  ('mora','noun','a mount; the marsh-horse.',NULL,NULL),
  ('varek','noun','a person, a human being.',NULL,NULL),
  ('ilse','noun','woman.',NULL,NULL),
  ('neth','noun','child.',NULL,NULL),
  ('dar','noun','father.',NULL,NULL),
  ('meth','noun','mother.',NULL,NULL),
  ('seth','noun','friend, companion.',NULL,NULL),
  ('thuran','noun','leader, chief, king.',NULL,NULL),
  ('resh','noun','a name.',NULL,NULL),
  ('vael','noun','word, speech.',NULL,NULL),
  ('kival','noun','house, home.',NULL,NULL),
  ('rovan','noun','road, way, path.',NULL,NULL),
  ('maru','noun','food.',NULL,NULL),
  ('koth','noun','meat, flesh.',NULL,NULL),
  ('len','verb','to go, to walk.','Lena se rovanev.','She walks on the road.'),
  ('vir','verb','to come.',NULL,NULL),
  ('mir','verb','to see, to look.',NULL,NULL),
  ('lesh','verb','to hear, to listen.',NULL,NULL),
  ('vel','verb','to speak, to say.',NULL,NULL),
  ('ken','verb','to know.',NULL,NULL),
  ('thir','verb','to think.',NULL,NULL),
  ('sel','verb','to want, to wish.',NULL,NULL),
  ('den','verb','to give.',NULL,NULL),
  ('rin','verb','to take.',NULL,NULL),
  ('kor','verb','to eat.',NULL,NULL),
  ('sur','verb','to drink.',NULL,NULL),
  ('tor','verb','to sleep.',NULL,NULL),
  ('hol','verb','to stand.',NULL,NULL),
  ('dov','verb','to sit.',NULL,NULL),
  ('vor','verb','to fall.',NULL,NULL),
  ('lok','verb','to run.',NULL,NULL),
  ('nag','verb','to strike, to hit.',NULL,NULL),
  ('tun','verb','to hold, to keep.',NULL,NULL),
  ('som','verb','to breathe.',NULL,NULL),
  ('sael','adjective','big, great.',NULL,NULL),
  ('nith','adjective','small, little.',NULL,NULL),
  ('vesh','adjective','good.',NULL,NULL),
  ('thann','adjective','bad, ill.',NULL,NULL),
  ('rell','adjective','red.',NULL,NULL),
  ('haru','adjective','cold.',NULL,NULL),
  ('mel','adjective','new.',NULL,NULL),
  ('groth','adjective','old.',NULL,NULL),
  ('nu','particle','not (pre-verbal negator).',NULL,NULL),
  ('wa','conjunction','and.',NULL,NULL),
  ('sha','determiner','this, these (near).',NULL,NULL),
  ('tha','determiner','that, those (far).',NULL,NULL),
  ('kwe','pronoun','who? which? (also relative).',NULL,NULL)
) AS m(word, pos, def, ex, tr) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- A second sense on a couple of words, to exercise multi-sense entries.
INSERT INTO definitions (entry_id, sense_number, part_of_speech, definition)
SELECT l.id, 2, 'noun', m.def
FROM lexicon l
JOIN languages lg ON lg.id = l.language_id AND lg.slug = 'ilseth'
JOIN (VALUES
  ('vael','a promise; a given word.'),
  ('vash','a day-long span, "a sun".'),
  ('nell','a handful; a measure of grain.')
) AS m(word, def) ON m.word = l.word
ON CONFLICT (entry_id, sense_number) DO NOTHING;

-- ============================================================================
-- 10. Inflection assignments — attach class + stem so the tables render live.
--     stem = the citation form; echo-harmony picks the class.
-- ============================================================================
-- Bright nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Bright'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('lian','vess','nell','rethi','maren','esti','she','neith','sivel','thai','serin','kesh','resh','vael','kival')
ON CONFLICT DO NOTHING;

-- Dark nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Dark'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('sath','tuar','kona','shan','hava','mira','aru','sena','thal','velu','dun','loth','isha','vash','lira','moru','thora','dela','koran','rathu','vun','nakh','maru','koth','rovan')
ON CONFLICT DO NOTHING;

-- Living nouns
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='noun' AND name='Living'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('faru','reshi','kuna','thelu','mora','varek','ilse','neth','dar','meth','seth','thuran')
ON CONFLICT DO NOTHING;

-- Steady verbs
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Steady'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('len','vir','mir','lesh','vel','ken','thir','sel','den','rin')
ON CONFLICT DO NOTHING;

-- Shifting verbs
INSERT INTO lexicon_inflections (entry_id, class_id, stem)
SELECT l.id, (SELECT id FROM paradigm_classes WHERE language_id=lg.id AND part_of_speech='verb' AND name='Shifting'), l.word
FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth'
WHERE l.word IN ('kor','sur','tor','hol','dov','vor','lok','nag','tun','som')
ON CONFLICT DO NOTHING;

-- Irregular overrides (per-cell literal forms) --------------------------------
-- len "to go": suppletive vath- root throughout the sealed aspect.
UPDATE lexicon_inflections li SET overrides = '{
  "sealed.s1":"vervathu","sealed.s2":"vervathash","sealed.s3":"vervatha",
  "sealed.p1":"vervathum","sealed.p2":"vervathashen","sealed.p3":"vervathath"
}'::jsonb
WHERE li.entry_id = (SELECT l.id FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth' WHERE l.word='len');

-- varek "person": irregular collective core "varmin" = "the folk, the people".
UPDATE lexicon_inflections li SET overrides = '{"collective.core":"varmin","collective.mark":"varminan"}'::jsonb
WHERE li.entry_id = (SELECT l.id FROM lexicon l JOIN languages lg ON lg.id=l.language_id AND lg.slug='ilseth' WHERE l.word='varek');

-- ============================================================================
-- 11. Relations — derivation, compounding, and inherited (proto) etyma.
-- ============================================================================
-- Compound: varanith (9) = varan (8) + ith (1).
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'compound_of', n.note
FROM languages lg
JOIN lexicon s ON s.language_id=lg.id AND s.word='varanith'
JOIN (VALUES ('varan','the base "eight"'), ('ith','the added "one"')) AS n(w, note) ON true
JOIN lexicon t ON t.language_id=lg.id AND t.word=n.w
WHERE lg.slug='ilseth'
ON CONFLICT DO NOTHING;

-- Derivation within Ilseth: vael "word" derived from vel "to speak".
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'derived_from', 'Deverbal noun: "that which is spoken".'
FROM languages lg
JOIN lexicon s ON s.language_id=lg.id AND s.word='vael'
JOIN lexicon t ON t.language_id=lg.id AND t.word='vel'
WHERE lg.slug='ilseth'
ON CONFLICT DO NOTHING;

-- Inherited etyma: Ilseth words derived_from their Proto-Vethic roots.
INSERT INTO lexicon_relations (source_id, target_id, relation_type, notes)
SELECT s.id, t.id, 'derived_from', n.note
FROM (VALUES
  ('aru','*watu','Proto-Vethic *watu; regular *w- > Ø, *t > r between vowels.'),
  ('sena','*sena','Directly inherited.'),
  ('vun','*nokti','Proto-Vethic *nokti "night"; *nok- > vu-, *-ti > -n.'),
  ('mir','*widi','Proto-Vethic *widi "to see".'),
  ('len','*lena','Proto-Vethic *lena "to go".'),
  ('varek','*warnu','Proto-Vethic *warnu "grown person".')
) AS n(ilw, prw, note)
JOIN languages il ON il.slug='ilseth'
JOIN languages pv ON pv.slug='proto-vethic'
JOIN lexicon s ON s.language_id=il.id AND s.word=n.ilw
JOIN lexicon t ON t.language_id=pv.id AND t.word=n.prw
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. Dialect variants (per-dialect spelling / pronunciation).
-- ============================================================================
-- Highland keeps hard /k/; Rivermouth drops final -n with compensatory length.
INSERT INTO lexicon_variants (entry_id, dialect_id, pronunciation, spelling, notes)
SELECT l.id, d.id, m.pron, m.spell, m.note
FROM languages lg
JOIN lexicon l ON l.language_id=lg.id
JOIN (VALUES
  ('kival','highland',  'ˈki.val', NULL,    'Highland keeps the hard /k/.'),
  ('kival','rivermouth','ˈxi.val', 'khival','Rivermouth softens /k/ to [x] between vowels.'),
  ('varan','rivermouth','vaˈraː',  'varaa', 'Final -n dropped; preceding vowel lengthened.'),
  ('koran','rivermouth','koˈraː',  'koraa', 'Final -n dropped; preceding vowel lengthened.')
) AS m(word, dslug, pron, spell, note) ON m.word = l.word
JOIN language_dialects d ON d.language_id=lg.id AND d.slug=m.dslug
WHERE lg.slug='ilseth'
ON CONFLICT (entry_id, dialect_id) DO NOTHING;

-- ============================================================================
-- 13. Backfill body sizes (the app maintains these; SQL seeds must set them).
-- ============================================================================
UPDATE languages SET body_size_bytes = octet_length(body)
WHERE slug IN ('ilseth','proto-vethic') AND body_size_bytes = 0;

-- Done. Verify:
--   SELECT count(*) FROM lexicon l JOIN languages lg ON lg.id=l.language_id WHERE lg.slug='ilseth';  -- expect 100
--   SELECT count(*) FROM lexicon_inflections li JOIN lexicon l ON l.id=li.entry_id
--     JOIN languages lg ON lg.id=l.language_id WHERE lg.slug='ilseth';  -- expect 72

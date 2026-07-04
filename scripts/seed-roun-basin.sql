-- Seed the Roun basin: three countries and three languages (low-fantasy, Wikipedia format).
-- Constraint honoured: the POLITICS echo real archetypes (a diminished empire turned
-- federal republic, a neutral oath-confederation, a one-party revolutionary republic —
-- a Cold-War-style triangle), but every language, name, title, institution, and culture
-- is invented and NOT based on any real language or culture.
--
-- Self-contained region: no links to the Onchera or Corlanth material.
-- Each country uses {{Infobox country}} with an SVG flag; each language uses
-- {{Infobox language}}. Present in-world year ~1988.
--
-- Run with: docker exec -i knowthing-db-1 psql -U knowthing -d knowthing < scripts/seed-roun-basin.sql
--
-- Idempotent: ON CONFLICT DO NOTHING.

-- --- Flags (media registry) --------------------------------------------------
INSERT INTO media (filename, filepath, mime_type, width, height, has_raster) VALUES
('sarnau_flag.svg', 'uploads/sarnau_flag.svg', 'image/svg+xml', 900, 600, false),
('kesset_flag.svg', 'uploads/kesset_flag.svg', 'image/svg+xml', 900, 600, false),
('tsevok_flag.svg', 'uploads/tsevok_flag.svg', 'image/svg+xml', 900, 600, false)
ON CONFLICT (filename) DO NOTHING;

-- --- Countries ---------------------------------------------------------------
INSERT INTO content_records (domain, slug, title, content) VALUES

-- === Federated Roads of Sarnau ===============================================
('know', 'Sarnau', 'Sarnau', $md$
{{Infobox country
|conventional_long_name=Federated Roads of Sarnau
|common_name=Sarnau
|native_name=Sarnaulg Vaomat ([[Sarnavi language|Sarnavi]])
|image_flag=sarnau_flag.svg
|national_motto=''By the roads, one people''
|capital=[[Ollemarn]]
|largest_city=[[Ollemarn]]
|official_languages=[[Sarnavi language|Sarnavi]]
|religion=Majority [[Waykeeping]]
|demonym=Sarnavi
|government_type=Federal parliamentary republic
|leader_title1=Vail
|leader_name1=[[Teloru Ansave]]
|leader_title2=First Speaker
|leader_name2=[[Marenu Olgai]]
|legislature=[[Vaomat]]
|established_event1=Old Sarnavi Empire
|established_date1=1204
|established_event2=Federated Roads proclaimed
|established_date2=1889
|area_km2=1,760,000
|population=94,000,000
|population_year=1988
|currency=[[Roun (currency)|Roun]]
}}

'''Sarnau''', officially the '''Federated Roads of Sarnau''', is a large country of the middle [[Roun]] basin and the dominant power of the region. Once the seat of an empire that bound the whole basin under a single crown, it is today a federal republic — diminished from its imperial height, and uneasily divided between pride in its past and the loss of its southern provinces to revolution.

Sarnavi identity has always been bound up with roads. The old empire was, in its own telling, less a territory than a network — a web of great paved ways radiating from [[Ollemarn]] — and to this day a Sarnavi reckons belonging not by birthplace but by ''road-house'', the civic lineage into which one is received.

== History ==

=== The empire of the roads ===
The Old Sarnavi Empire, conventionally dated to 1204, rose by building and holding the great ways that carried its armies and its tolls. At its height the empire's road-law reached across the basin and into the southern lowlands and the fringes of the [[Kesset Highlands]].

=== Decline and federation ===
Over-extension, and the cost of holding roads it could no longer defend, wore the empire down. In 1889 the surviving provinces reconstituted themselves as the Federated Roads, a republic in which each province — each "road" — retained wide autonomy under a common assembly, the [[Vaomat]]. The change was made bitterer by the loss, four decades later, of the southern lowlands to the [[Tsevok|Tsevoki]] revolution.

== Government and politics ==
Sarnau is a federal parliamentary republic. Its head of state, the [[Vail]], is elected by the [[Vaomat]] and presides over a government led by a First Speaker. Relations with the revolutionary republic of [[Tsevok]] across the [[Iron Marches]] remain cold; those with neutral [[Kesset]] are correct and profitable.

== Culture ==
The [[Waykeeping]], Sarnau's traditional faith, venerates the roads themselves and the ancestors who walked them; its shrines are milestones, and its liturgy is a recited poetry of routes and journeys. Sarnavi prize oratory and memory above almost all else, and a well-recited genealogy is a social currency in its own right.

See also: [[Kesset]], [[Tsevok]], [[Sarnavi language]], [[Roun]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:Roun basin]]
$md$),

-- === Oathbound Rams of Kesset =================================================
('know', 'Kesset', 'Kesset', $md$
{{Infobox country
|conventional_long_name=Oathbound Rams of Kesset
|common_name=Kesset
|native_name=Kesset Ettin ([[Kesseti language|Kesseti]])
|image_flag=kesset_flag.svg
|national_motto=''We keep what is sworn''
|capital=[[Tekkir]]
|largest_city=[[Tekkir]]
|official_languages=[[Kesseti language|Kesseti]]
|religion=Majority [[the Unspeaking|Unspeaking]]
|demonym=Kesseti
|government_type=Confederal direct democracy
|leader_title1=Ettan
|leader_name1=[[Pitwen Esker]]
|leader_title2=Steward of the Essek
|leader_name2=[[Kunna Tekwir]]
|legislature=[[Rammoot]]
|established_event1=Oath of the Rams
|established_date1=1447
|established_event2=Guaranteed neutrality
|established_date2=1891
|area_km2=52,000
|population=6,200,000
|population_year=1988
|currency=[[Kesseti tenn|Tenn]]
}}

'''Kesset''', officially the '''Oathbound Rams of Kesset''', is a small, mountainous confederation of the [[Kesset Highlands]], lying between the great powers of [[Sarnau]] and [[Tsevok]]. It is a country famous for two things above all: its stubborn neutrality, and the absolute weight it places upon a sworn word.

Kesset is not a nation in the usual sense but a federation of self-governing valleys, called ''rams'', bound together by mutual oath rather than by any crown or capital. Its people are accordingly renowned as arbiters and as keepers of deposits, trusted precisely because, among them, to break an oath is the one unforgivable act.

== History ==

=== The Oath of the Rams ===
The valleys of the highlands were long a march contested between lowland powers. In 1447 their headmen swore the first Oath of the Rams, binding the valleys to common defence while leaving each free in its own affairs — a compact renewed, by custom, at every generation since.

=== Guaranteed neutrality ===
Wedged between [[Sarnau]] and the rising power of the south, Kesset made neutrality its policy and its trade. In 1891 the surrounding powers, each preferring a neutral buffer to a rival's gain, jointly guaranteed Kesseti neutrality by treaty. The confederation has since prospered as a place where enemies can safely deposit their gold and submit their quarrels.

== Government and politics ==
Kesset is a confederal direct democracy. Each ''ram'' governs itself through its own assembly; national matters are decided by the [[Rammoot]], the general assembly of all the rams, and administered between sittings by a standing council, the [[Essek]], under a rotating [[Ettan]].

== Culture ==
Kesseti culture is austere, reticent, and preoccupied with the keeping of one's word. A person receives an ''oath-name'' upon swearing into adulthood, and the faith of the highlands, the [[the Unspeaking|Unspeaking]], is an apophatic reverence that holds the highest things to be beyond speech — and therefore not to be sworn upon lightly, or at all.

See also: [[Sarnau]], [[Tsevok]], [[Kesseti language]], [[Kesset Highlands]].

[[Category:Countries]]
[[Category:Confederations]]
[[Category:Landlocked countries]]
[[Category:Roun basin]]
$md$),

-- === Fellowship Republic of Tsevok ===========================================
('know', 'Tsevok', 'Tsevok', $md$
{{Infobox country
|conventional_long_name=Fellowship Republic of Tsevok
|common_name=Tsevok
|native_name=Tševok Sekshara ([[Tsevoki language|Tsevoki]])
|image_flag=tsevok_flag.svg
|national_motto=''Hands before blood''
|capital=[[Ksharod]]
|largest_city=[[Ksharod]]
|official_languages=[[Tsevoki language|Tsevoki]]
|religion=Secular state (historically the [[Ember Orders]])
|demonym=Tsevoki
|government_type=One-party fellowship republic
|leader_title1=Sekur
|leader_name1=[[Vodel Ksharu]]
|leader_title2=Secretary of the Directorate
|leader_name2=[[Sena Otselu]]
|legislature=[[Sekshara]]
|established_event1=The Ember-Breaking
|established_date1=1931
|established_event2=Fellowship Republic proclaimed
|established_date2=1934
|area_km2=880,000
|population=51,000,000
|population_year=1988
|currency=[[Tsevoki vretsh|Vretsh]]
}}

'''Tsevok''', officially the '''Fellowship Republic of Tsevok''', is a country of the lower [[Roun]], born from revolution and governed as a single-party state. Until the twentieth century its lands were the southern provinces of imperial [[Sarnau]], worked under a hereditary priest-caste; today they form a republic organised around collective labour and defined, above all, against the order it overthrew.

== History ==

=== The Ember-Breaking ===
The old south was ruled by the ''Ember Orders'', a caste of flame-priests who held both the shrines and the land by birthright. In 1931 a rising of the labour-fellowships — the ''Ember-Breaking'' — overthrew the priest-caste, abolished its hereditary titles, and broke the southern provinces away from [[Sarnau]]. The Fellowship Republic was proclaimed in 1934.

=== The republic ===
Since the revolution Tsevok has been governed by a single party, the Ember-Breakers' Union, through a central Directorate. Its rivalry with [[Sarnau]] — the empire it seceded from — dominates the politics of the [[Roun]] basin, the two states facing one another across the fortified [[Iron Marches]].

== Government and politics ==
Tsevok is a one-party fellowship republic. Authority rests with the Directorate, chaired by the [[Sekur]]; the [[Sekshara]], a congress of the labour-fellowships, ratifies its decisions. Old hereditary titles are abolished; citizens take chosen ''work-names'' on entering their fellowship.

== Culture ==
Tsevoki public life is built around collective labour and its commemoration. Great geometric murals cover the walls of its communal halls, and its reformed calendar is a cycle of work-festivals. The [[Ember Orders]] are officially suppressed, though their old rites are said to survive quietly in the countryside.

See also: [[Sarnau]], [[Kesset]], [[Tsevoki language]], [[Iron Marches]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:Roun basin]]
$md$),

-- --- Languages ---------------------------------------------------------------

-- === Sarnavi language ========================================================
('know', 'Sarnavi language', 'Sarnavi language', $md$
{{Infobox language
|name=Sarnavi
|nativename=Sarnavi
|states=[[Sarnau]]
|region=The middle [[Roun]] basin
|speakers=≈90 million
|date=1988
|familycolor=#b8862f
|fam1=Roun
|fam2=Ollaric
|family=Ollaric (Roun)
|protoname=[[Proto-Roun]]
|script=[[Roun script]]
|nation=[[Sarnau]]
}}

'''Sarnavi''' is the language of [[Sarnau]] and the old administrative tongue of the Sarnavi Empire. It forms the Ollaric branch of the [[Proto-Roun|Roun]] family and is a distant relative of [[Tsevoki language|Tsevoki]], from which it has been separated since imperial times.

Sarnavi is a sonorant, flowing language, rich in liquids and nasals and fond of long, rolling words; it is often described by its neighbours as sounding like recited verse even in ordinary speech — a quality its speakers, who prize oratory, cultivate rather than deny.

== Phonology ==
Sarnavi has five vowels, ''a e i o u'', and the diphthongs ''ai'', ''au'', and ''ei''. Its consonants are ''m n l r s sh v t d k g''. Characteristic of the language are its medial consonant clusters — ''-lg-'', ''-rn-'', ''-shv-'', ''-lm-'' — which give words such as ''Sarnaulg'' and ''Neshvai'' their texture. Stress falls regularly on the penultimate syllable.

== Vocabulary ==
A few illustrative words:
* ''sarnau'' — the joined roads; the homeland
* ''vaom'' — a gathering or assembly (hence the ''[[Vaomat]]'')
* ''olle'' — great, high; ''marn'' — a crossing or hub (''[[Ollemarn]]'', "great crossing")
* ''vail'' — a keeper or guide; also the office of head of state
* ''roun'' — a walked road; by extension, the coin of the realm
* ''shanu'' / ''shanavi'' — a person / a people
* ''selavai'' — "good road", used in both greeting and farewell
* numerals: ''en'' (1), ''vor'' (2), ''teln'' (3)

== Writing system ==
Sarnavi is written in the '''[[Roun script]]''', an alphabet whose angular letterforms are traditionally said to derive from the carving of milestones along the imperial ways.

See also: [[Kesseti language]], [[Tsevoki language]], [[Sarnau]].

[[Category:Languages]]
[[Category:Roun basin]]
$md$),

-- === Kesseti language ========================================================
('know', 'Kesseti language', 'Kesseti language', $md$
{{Infobox language
|name=Kesseti
|nativename=Kesseti
|states=[[Kesset]]
|region=The [[Kesset Highlands]]
|speakers=≈6 million
|date=1988
|familycolor=#55636b
|family=Rammic (isolate)
|script=[[Tally-hand]]
|nation=[[Kesset]]
}}

'''Kesseti''' is the language of the highland confederation of [[Kesset]]. It is a Rammic isolate with no established relatives — notably unrelated to the [[Sarnavi language|Sarnavi]] of the surrounding lowlands — a linguistic apartness that mirrors the confederation's political one.

Kesseti is a clipped, terse language of short, consonant-final words, and it strikes lowland ears as abrupt. Its speakers regard economy of speech as a virtue in itself.

== Phonology ==
Kesseti is unusual for its front-weighted vowel system — ''i e y a'', with no back rounded vowels at all. Its stops ''p t k'' contrast with the geminates ''pp tt kk'', and it makes heavy use of a glottal stop (written ''ʼ'') and the velar fricative ''x''. Words are short and end in consonants; longer ideas are built by hyphenated compounding.

== Vocabulary ==
A few illustrative words:
* ''kesset'' — sworn-together; oath-bound
* ''ram'' — a self-ruling valley or canton
* ''ettan'' — first-sworn; warden (the office of head of state)
* ''essek'' — the seated ones; the standing council
* ''tenn'' — a reckoning or tally; the coin of the confederation
* ''kir'' — stone, hold (''[[Tekkir]]'', "hearth-stone")
* ''yxen'' / ''yxeni'' — a person / a people
* ''tekʼi-set'' — "sworn peace", a greeting
* numerals: ''pit'' (1), ''esk'' (2), ''kʼun'' (3)

== Writing system ==
Kesseti is written in the '''[[Tally-hand]]''', a notched script descended from the reckoning-sticks on which the rams once kept their oaths and their accounts.

See also: [[Sarnavi language]], [[Tsevoki language]], [[Kesset]].

[[Category:Languages]]
[[Category:Language isolates]]
[[Category:Roun basin]]
$md$),

-- === Tsevoki language ========================================================
('know', 'Tsevoki language', 'Tsevoki language', $md$
{{Infobox language
|name=Tsevoki
|nativename=Tševoki
|states=[[Tsevok]]
|region=The lower [[Roun]]
|speakers=≈50 million
|date=1988
|familycolor=#9e2b25
|fam1=Roun
|fam2=Tsevic
|family=Tsevic (Roun)
|protoname=[[Proto-Roun]]
|script=[[Block-hand]]
|nation=[[Tsevok]]
}}

'''Tsevoki''' is the language of [[Tsevok]]. It forms the Tsevic branch of the [[Proto-Roun|Roun]] family — a southern sister of [[Sarnavi language|Sarnavi]], from which it split under the old empire. That ancient linguistic division hardened into a political one after the Ember-Breaking, and the two kindred tongues are now the languages of rival states.

Tsevoki is an angular, percussive language, dense with affricates and sibilants, and it sounds as hard and deliberate as the murals and machinery its speakers celebrate.

== Phonology ==
Tsevoki has the vowels ''e o a'' and a central vowel ''ə''. Its most striking feature is a thick series of affricates and sibilants — ''ts'', ''tš'', ''kš'', ''s'', ''š'', ''z'' — and a fondness for final clusters such as ''-tš'', ''-ks'', and ''-sk''. The native orthography writes ''š'' for the sound English spells "sh", whence the spelling ''Tševoki''.

== Vocabulary ==
A few illustrative words:
* ''tševok'' — the freed hands; a fellowship
* ''sekur'' — the turned-one; the chair of the Directorate
* ''sekshara'' — the gathering of hands; the congress
* ''vretš'' — a day's labour; a labour-note (the coin)
* ''kšar'' — a forge or works (''[[Ksharod]]'', "the great works")
* ''vok'' / ''voki'' — a worker / the freed (as a people)
* ''otsel'' — "hands up", a greeting of the revolution
* numerals: ''es'' (1), ''kra'' (2), ''tšon'' (3)

== Writing system ==
Tsevoki is written in the '''[[Block-hand]]''', a bold geometric script standardised from the stencils of revolutionary muralists, which after 1931 replaced the cursive hand of the old priesthood.

See also: [[Sarnavi language]], [[Kesseti language]], [[Tsevok]].

[[Category:Languages]]
[[Category:Roun basin]]
$md$)

ON CONFLICT DO NOTHING;

-- Backfill size_bytes.
UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
  AND slug IN ('Sarnau', 'Kesset', 'Tsevok', 'Sarnavi language', 'Kesseti language', 'Tsevoki language')
  AND size_bytes = 0;

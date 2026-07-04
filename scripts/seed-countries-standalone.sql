-- Seed standalone Know-domain country articles (low-fantasy, Wikipedia format).
-- These are NOT tied to the Onchera canon: they sit in a fresh region — the
-- Merope Sea and the continent of Corlanth — and cross-link only to each other.
-- Each embeds {{Infobox country|...}} with a real SVG flag (registered below in
-- the media table; files live in uploads/*.svg).
--
-- Run with: docker exec -i knowthing-db-1 psql -U knowthing -d knowthing < scripts/seed-countries-standalone.sql
--
-- Idempotent: ON CONFLICT DO NOTHING.

-- --- Flags (media registry) --------------------------------------------------
-- Files must exist at uploads/<filename>. SVGs are served as-is (no raster).
INSERT INTO media (filename, filepath, mime_type, width, height, has_raster) VALUES
('valdheim_flag.svg', 'uploads/valdheim_flag.svg', 'image/svg+xml', 900, 600, false),
('calmarre_flag.svg', 'uploads/calmarre_flag.svg', 'image/svg+xml', 900, 600, false),
('khessar_flag.svg',  'uploads/khessar_flag.svg',  'image/svg+xml', 900, 600, false),
('ozeren_flag.svg',   'uploads/ozeren_flag.svg',   'image/svg+xml', 900, 600, false)
ON CONFLICT (filename) DO NOTHING;

-- --- Articles ----------------------------------------------------------------
INSERT INTO content_records (domain, slug, title, content) VALUES

-- === Grand Duchy of Valdheim =================================================
('know', 'Valdheim', 'Valdheim', $md$
{{Infobox country
|conventional_long_name=Grand Duchy of Valdheim
|common_name=Valdheim
|native_name=Grossherzogtum Valdheim ([[Valisch language|Valisch]])
|image_flag=valdheim_flag.svg
|national_motto=''Steadfast in the heights''
|national_anthem=''Hymn of the Averen''
|capital=[[Hallenmark]]
|largest_city=[[Hallenmark]]
|official_languages=[[Valisch language|Valisch]]
|religion=79% [[Concordant Church]] <br> 14% No religion <br> 7% others
|demonym=Valdish
|government_type=Unitary constitutional monarchy
|leader_title1=Grand Duke
|leader_name1=[[Aloys III]]
|leader_title2=Minister-President
|leader_name2=[[Bertwin Halle]]
|legislature=[[Landtag of Valdheim|Landtag]]
|established_event1=County of Valdheim
|established_date1=1142
|established_event2=Elevated to Grand Duchy
|established_date2=1519
|established_event3=Constitution
|established_date3=1848
|area_km2=41,300
|population=2,900,000
|population_year=1890
|currency=[[Valdheim thaler|Thaler]]
|time_zone=Averen Mean
}}

'''Valdheim''', officially the '''Grand Duchy of Valdheim''', is a small landlocked country in the [[Averen Mountains]] at the heart of the continent of [[Corlanth]]. Bounded by high peaks on every side, it is one of the oldest continuously self-governing states of the region and, for the past three centuries, one of the most jealously neutral.

Though home to fewer than three million people, Valdheim wields an influence out of all proportion to its size through its banks, its precision workshops, and its role as a discreet meeting-ground for powers that will not meet elsewhere.

== History ==

=== County and grand duchy ===
The mountain valleys were first united as the County of Valdheim in 1142, when a line of margraves at [[Hallenmark]] secured the high passes and the tolls that crossed them. Wealth from those tolls, and from the silver of the upper valleys, raised the county steadily in rank until it was elevated to a grand duchy in 1519.

=== Neutrality and constitution ===
Ringed by larger and quarrelsome neighbours, Valdheim made a policy of armed neutrality, hiring out its soldiers abroad while refusing to take sides at home. A liberal constitution in 1848 transferred law-making to the elected [[Landtag of Valdheim|Landtag]] and fixed the neutrality that the grand dukes had long practised as a matter of survival.

== Geography ==
Valdheim is almost entirely mountainous, a country of glaciated peaks, deep valleys, and cold clear lakes. Its rivers, falling steeply, drive both its old mills and its modern power-houses.

== Government and politics ==
Valdheim is a unitary constitutional monarchy. The Grand Duke, presently [[Aloys III]], reigns as a ceremonial head of state; government is carried on by a Minister-President answerable to the [[Landtag of Valdheim|Landtag]].

== Economy ==
The Valdish economy rests on banking, on the manufacture of watches, instruments, and fine machinery, and increasingly on visitors drawn to the [[Averen Mountains]]. Its currency, the thaler, is prized abroad for its stability.

See also: [[Calmarre]], [[Khessar]], [[Ozeren]], [[Merope Sea]], [[Corlanth]].

[[Category:Countries]]
[[Category:Monarchies]]
[[Category:Landlocked countries]]
[[Category:Corlanth]]
$md$),

-- === Serene Republic of Calmarre =============================================
('know', 'Calmarre', 'Calmarre', $md$
{{Infobox country
|conventional_long_name=Serene Republic of Calmarre
|common_name=Calmarre
|native_name=Serenissima Repubblica di Calmarre ([[Calmarrese language|Calmarrese]])
|image_flag=calmarre_flag.svg
|national_motto=''The sea keeps her''
|capital=[[Calmarre (city)|Calmarre]]
|largest_city=[[Calmarre (city)|Calmarre]]
|official_languages=[[Calmarrese language|Calmarrese]]
|religion=71% [[Concordant Church]] <br> 12% [[Astral Concord]] <br> 17% others
|demonym=Calmarrese
|government_type=Unitary parliamentary republic
|leader_title1=Gonfalonier
|leader_name1=[[Vittore Sanl]]
|leader_title2=First Secretary
|leader_name2=[[Lucia Verane]]
|legislature=[[Grand Council of Calmarre|Grand Council]]
|established_event1=Founding of the city
|established_date1=c. 1030
|established_event2=Republic proclaimed
|established_date2=1216
|area_km2=18,700
|population=3,400,000
|population_year=1890
|currency=[[Calmarrese florin|Florin]]
|time_zone=Merope Mean
}}

'''Calmarre''', officially the '''Serene Republic of Calmarre''', is a compact maritime country on the northern shore of the [[Merope Sea]]. Built upon a lagoon and the islands about it, Calmarre grew from a fishing town into one of the great trading powers of the inner sea, and for six centuries has governed itself as a republic.

Small in territory but dense in people and capital, the republic has long lived by carrying, financing, and insuring the trade of others, and by the arts and crafts that its wealth supported.

== History ==

=== City of the lagoon ===
Refugees are said to have founded Calmarre among the lagoon islands around 1030, choosing the water for its safety. The settlement prospered as a neutral middleman between the powers of [[Corlanth]] and the ports across the [[Merope Sea]], and in 1216 its leading houses proclaimed a republic under an elected [[Gonfalonier]].

=== The trading republic ===
At its height Calmarre kept a chain of fortified trading factories around the Merope, a fleet to protect them, and a bank whose notes were honoured in every port of the sea. Rivalry with mainland powers cost it much of that empire, but the city itself was never taken, a fact its people ascribe — half in earnest — to the sea that guards it.

== Geography ==
The heart of the republic is its island capital, a maze of canals and quays; its small mainland territory is low, marshy, and intensively worked. The republic's true domain has always been the water.

== Government and politics ==
Calmarre is a unitary parliamentary republic descended from its mercantile constitution. A [[Gonfalonier]], elected as head of state, presides over a government answerable to the [[Grand Council of Calmarre|Grand Council]].

== Economy ==
Shipping, banking, insurance, glasswork, and the fine arts remain the pillars of the Calmarrese economy. The florin of Calmarre is among the oldest continuously minted coins of the region.

See also: [[Valdheim]], [[Khessar]], [[Ozeren]], [[Merope Sea]], [[Corlanth]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:Corlanth]]
$md$),

-- === Emirate of Khessar ======================================================
('know', 'Khessar', 'Khessar', $md$
{{Infobox country
|conventional_long_name=Emirate of Khessar
|common_name=Khessar
|native_name=Imarat Khessar ([[Khessari language|Khessari]])
|image_flag=khessar_flag.svg
|national_motto=''Under the nine stars''
|capital=[[Al-Qesir]]
|largest_city=[[Al-Qesir]]
|official_languages=[[Khessari language|Khessari]]
|religion=88% [[Astral Concord]] <br> 7% [[Concordant Church]] <br> 5% others
|demonym=Khessari
|government_type=Unitary constitutional monarchy under an emir
|leader_title1=Emir
|leader_name1=[[Yusuf al-Marran]]
|leader_title2=Grand Vizier
|leader_name2=[[Hesham Dari]]
|legislature=[[Majlis of Khessar|Majlis]]
|established_event1=Caravan emirate founded
|established_date1=1174
|established_event2=Constitution of the Majlis
|established_date2=1871
|area_km2=1,120,000
|population=11,300,000
|population_year=1890
|currency=[[Khessari dinar|Dinar]]
|time_zone=Marran Mean
}}

'''Khessar''', officially the '''Emirate of Khessar''', is a large desert country on the northern rim of the [[Marran Desert]], south across the mountains from the [[Merope Sea]]. A realm of oasis cities strung along ancient caravan roads, it has grown rich for a thousand years on the trade in salt, glass, and dyes that crosses its sands.

Khessar is famed above all for its astronomers, whose charts of the "nine stars" — the fixed lights by which caravans steer the trackless desert — gave the emirate the emblem it still flies.

== History ==

=== Caravan emirate ===
The oasis towns of the northern Marran were first bound together in 1174 by the House of Marran, whose emirs took as their charge the safety of the caravan roads and the wells that fed them. Control of water and route made the dynasty wealthy and, in time, dominant over a great sweep of desert.

=== Reform ===
Contact with the trading powers of the [[Merope Sea]] brought new wealth and new strains. In 1871 the reigning emir granted a constitution establishing the [[Majlis of Khessar|Majlis]], a council of the sheikhs and the merchant guilds, sharing law-making with the throne.

== Geography ==
Khessar is overwhelmingly desert — dune-seas, gravel plains, and salt flats — relieved by a scatter of great oases and by the highland wells along its northern border. Its cities cluster where water and caravan road meet.

== Government and politics ==
Khessar is a constitutional monarchy under an emir. [[Yusuf al-Marran]] reigns as emir; a Grand Vizier leads the government in concert with the [[Majlis of Khessar|Majlis]].

== Economy ==
Salt, glass, dates, and dyes remain the staples of Khessari trade, together with the tolls of the caravan roads. The emirate's astronomers and instrument-makers are sought throughout the region.

=== Religion ===
The great majority of Khessari follow the [[Astral Concord]], a veneration of the fixed stars whose priest-astronomers keep the calendar and the desert roads.

See also: [[Valdheim]], [[Calmarre]], [[Ozeren]], [[Marran Desert]], [[Corlanth]].

[[Category:Countries]]
[[Category:Monarchies]]
[[Category:Corlanth]]
$md$),

-- === Ozeren Federation =======================================================
('know', 'Ozeren', 'Ozeren', $md$
{{Infobox country
|conventional_long_name=Ozeren Federation
|common_name=Ozeren
|native_name=Ozeren Nutag ([[Ozeric language|Ozeric]])
|image_flag=ozeren_flag.svg
|national_motto=''One sky, many tents''
|capital=[[Tovmar]]
|largest_city=[[Tovmar]]
|official_languages=[[Ozeric language|Ozeric]]
|religion=64% [[Sky-Faith]] <br> 21% No religion <br> 15% others
|demonym=Ozeren
|government_type=Federal parliamentary republic
|leader_title1=President
|leader_name1=[[Batu Sarangel]]
|leader_title2=Prime Minister
|leader_name2=[[Oyuna Terekh]]
|legislature=[[Great Kurultai]]
|established_event1=Khaganate of the Ozeren
|established_date1=1063
|established_event2=Federation proclaimed
|established_date2=1802
|area_km2=3,760,000
|population=22,500,000
|population_year=1890
|currency=[[Ozeren sum|Sum]]
|time_zone=Ossian Mean
}}

'''Ozeren''', officially the '''Ozeren Federation''', is a vast, thinly peopled country of the [[Ossian Steppe]], east of the continent of [[Corlanth]]. It is the heir of the horse-nomad confederations whose [[Khaganate of the Ozeren|khaganate]] once ruled the grasslands from horizon to horizon, and today it governs those same lands as a federation of pastoral provinces and a handful of great trade-road cities.

Though its territory is immense, its people number only some twenty-two million, and the open steppe remains central to Ozeren life and self-image.

== History ==

=== The khaganate ===
The clans of the Ossian grasslands were first united under a single khagan in 1063, founding a khaganate that for two centuries levied tribute across the steppe and its bordering settled lands. Like most steppe empires it eventually fractured along clan lines, dissolving into a patchwork of rival hordes.

=== Federation ===
Centuries of division ended in 1802, when the surviving hordes — pressed by settled neighbours and by the decline of the overland caravan trade — bound themselves into a federation, each retaining its own council under a common assembly. The federation has since evolved into a parliamentary republic.

== Geography ==
Ozeren is a country of open steppe, cold and continental, with bitter winters and short, warm summers. Rivers and the old caravan roads thread the grassland, and it is along these that the country's few cities have grown.

== Government and politics ==
Ozeren is a federal parliamentary republic. Its provinces retain broad autonomy; national affairs are directed by a President and Prime Minister answerable to the [[Great Kurultai]], the federal assembly.

== Economy ==
The Ozeren economy still rests heavily on livestock — horses, sheep, and cattle — and on wool and hides, though mining and the reviving overland trade have grown in importance.

=== Religion ===
Most Ozeren keep the [[Sky-Faith]], an old veneration of the open sky and of ancestral spirits, whose seasonal gatherings remain among the great events of steppe life.

See also: [[Valdheim]], [[Calmarre]], [[Khessar]], [[Ossian Steppe]], [[Corlanth]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:Corlanth]]
$md$)

ON CONFLICT DO NOTHING;

-- Backfill size_bytes for the rows just inserted.
UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
  AND slug IN ('Valdheim', 'Calmarre', 'Khessar', 'Ozeren')
  AND size_bytes = 0;

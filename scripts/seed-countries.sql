-- Seed Know-domain country articles (low-fantasy, Wikipedia format).
-- Each embeds {{Infobox country|...}} (see src/lib/infoboxes/schemas/country.ts).
-- These slot into the canon established by the existing 'Onchera' article:
--   West Hashir, the Ouken Ocean, the Tambuli/Hadashule civilization, the
--   Kingdom of Nilscodd's iron-hulled circumnavigation, the EC calendar era,
--   and the Aidegani sun-faith. Many [[links]] are intentional redlinks —
--   hooks for future articles, Wikipedia-style.
--
-- Run with: docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-countries.sql
--   (local dev: docker exec -i knowthing-db-1 psql -U knowthing -d knowthing < scripts/seed-countries.sql)
--
-- Idempotent: ON CONFLICT DO NOTHING on (domain, lower(slug)).

INSERT INTO content_records (domain, slug, title, content) VALUES

-- --- Kingdom of Nilscodd ------------------------------------------------------
('know', 'Nilscodd', 'Nilscodd', $md$
{{Infobox country
|conventional_long_name=Kingdom of Nilscodd
|common_name=Nilscodd
|native_name=Kryndrik Nilscodd ([[Nilscoddi language|Nilscoddi]])
|national_motto=''By iron and tide''
|national_anthem=''The Cold Harbour Song''
|capital=[[Vessgard]]
|largest_city=[[Draakol]]
|official_languages=[[Nilscoddi language|Nilscoddi]]
|religion=68% [[Wardenism]] <br> 24% No religion <br> 8% others
|demonym=Nilscoddi
|government_type=Unitary constitutional monarchy
|leader_title1=Monarch
|leader_name1=[[Sivrid II]]
|leader_title2=First Minister
|leader_name2=[[Haldor Venn]]
|legislature=[[Storhall]]
|established_event1=Union of the Sea-Leagues
|established_date1=2411 EC
|established_event2=Constitution
|established_date2=2977 EC
|area_km2=488,600
|population=14,200,000
|population_year=3104 EC
|currency=[[Nilscoddi krent|Krent]]
|time_zone=Ouken North
|calling_code=+12
|internet_tld=.nk
}}

'''Nilscodd''', officially the '''Kingdom of Nilscodd''', is a maritime country of the cold northern reaches of the [[Ouken Ocean]]. Its fjord-cut coasts, iron ranges, and coal seams made it, over three centuries, the foremost shipbuilding and seafaring power of the known world. Nilscoddi navigators were the first to sheath ocean hulls in iron, and in 2960 EC a Nilscoddi expedition completed the first circumnavigation of the Ouken, making landfall on the shores of an isolated [[Onchera]] and ending that country's near-six-century seclusion.

With a population of about 14 million spread thinly across a long, storm-beaten littoral, Nilscodd is small by the measure of the [[West Hashir]] mainland, yet it holds an outsized place in ocean trade, marine insurance, and the carrying of other nations' goods.

== History ==

=== Sea-leagues and union ===
The medieval Nilscoddi coast was a patchwork of independent harbour-leagues, each a compact of shipwrights, whalers, and merchant captains bound by charter rather than crown. Rivalry among the leagues was fierce but rarely total, for all depended on the same narrow sailing season. In 2411 EC the three greatest leagues were bound into a single realm under the first monarch at [[Vessgard]], an event remembered as the Union of the Sea-Leagues.

=== Age of navigation ===
Royal patronage turned the leagues' rivalry outward. Nilscoddi charts, lighthouses, and deep-water pilots became the finest afloat, and by the mid-29th century EC the kingdom's yards were launching iron-framed hulls that could keep the sea through the winter gales that had turned back every earlier ocean voyage. The [[circumnavigation of the Ouken|circumnavigation of 2960]] is reckoned the beginning of the modern age of contact across the ocean.

=== Constitutional era ===
Industrial wealth from iron and coal shifted power from the throne to the shipowning towns. After decades of agitation the crown assented to a written constitution in 2977 EC, vesting law-making in the [[Storhall]] and reducing the monarch to a guarantor of the union. Nilscodd has been a constitutional monarchy since.

== Geography ==
Nilscodd occupies a rugged, glaciated coast broken by long fjords and fronted by thousands of skerries. Winters are dark and severe; the sailing season is short and prized. Little of the land is arable, and the country has always looked to the sea for its living.

== Government and politics ==
Nilscodd is a unitary constitutional monarchy. The monarch, presently [[Sivrid II]], reigns but does not rule; executive power rests with the First Minister and cabinet, answerable to the elected [[Storhall]]. The country is noted for its stable, sober politics and its long tradition of maritime law.

== Economy ==
The Nilscoddi economy is built on shipbuilding, shipping, fisheries, iron, and coal, and on the financial trades — insurance, freight, and banking — that grew up around them. Nilscoddi bottoms carry a large share of the [[Ouken Ocean|Ouken]]'s cargo, including much of the [[Onchera]]n export trade.

See also: [[Onchera]], [[Tambul]], [[Ouken Ocean]], [[West Hashir]].

[[Category:Countries]]
[[Category:Monarchies]]
[[Category:West Hashir]]
$md$),

-- --- Republic of Tambul ------------------------------------------------------
('know', 'Tambul', 'Tambul', $md$
{{Infobox country
|conventional_long_name=Republic of Tambul
|common_name=Tambul
|native_name=Tambuli Rasadan ([[Great Tambuli]])
|national_motto=''Learning outlasts empire''
|capital=[[Hadashan]]
|largest_city=[[Melgad]]
|official_languages=[[Great Tambuli]]
|religion=61% [[Tan (religion)|Tan]] <br> 15% [[Aidegani]] <br> 19% No religion <br> 5% others
|demonym=Tambuli
|government_type=Federal parliamentary republic
|leader_title1=President
|leader_name1=[[Osma Deledan]]
|leader_title2=Chancellor
|leader_name2=[[Rui Hadasso]]
|legislature=[[Grand Sanhal]]
|established_event1=Gamadi dynasty
|established_date1=c. 200 EC
|established_event2=Hadashule dynasty
|established_date2=1290 EC
|established_event3=Republic
|established_date3=3061 EC
|area_km2=2,940,000
|population=180,000,000
|population_year=3104 EC
|currency=[[Tambuli dinal|Dinal]]
|time_zone=Hashir Standard
|calling_code=+40
|internet_tld=.tb
}}

'''Tambul''', officially the '''Republic of Tambul''', is a large country occupying much of the interior and southern coast of [[West Hashir]]. It is the heartland of the [[Tambuli people]] and of [[Great Tambuli]], long the common tongue of scholarship and commerce across the [[Ouken Ocean]]. Tambul is home to some 180 million people and to the oldest continuous literate culture of the region.

For most of recorded history Tambul was an empire rather than a republic. Its merchants and scholars settled trading colonies as far as the [[Onchera]]n archipelago, and its dynasties shaped the politics of the whole ocean before the modern age of nations.

== History ==

=== Gamadi and the classical age ===
The [[Gamadi dynasty]], flourishing from around 200 EC, first bound the Tambuli river-cities into a single realm and gave the region its script and its calendar. Late Gamadi records note regular, if wary, contact with the "many-kinged" islands of [[Onchera]] as early as 483 EC. Gamadi expansion, however, outran its revenues, and coastal piracy went unchecked in its final century.

=== The Hadashule empire ===
The [[Hadashule dynasty]], established in 1290 EC, presided over Tambul's imperial zenith. From 1432 EC the Hadashule issued charters for trading colonies across the Oncheran islands, and Tambuli scholars, coin, and letters spread throughout the [[Ouken Ocean|Ouken]]. Onchera was for centuries the Hadashule's largest trading partner.

=== Collapse and the warring states ===
The [[Ouken Algae Flood (2259)]] and the loss of the Oncheran trade broke the imperial economy. The Hadashule realm fragmented into rival successor states whose long wars are remembered simply as the warring-states centuries. Reunification proved impossible until the exhausted states agreed, in 3061 EC, to a federal republican constitution — the founding of modern Tambul.

== Government and politics ==
Tambul is a federal parliamentary republic. Its constituent provinces retain wide powers; national affairs are directed by a President and Chancellor accountable to the [[Grand Sanhal]]. The long memory of imperial overreach has left Tambuli politics cautious of concentrated power.

== Demographics ==

=== Religion ===
Most Tambuli follow [[Tan (religion)|Tan]], an ancestral and philosophical tradition native to the mainland, though the [[Aidegani]] sun-faith carried back from [[Onchera]] has a substantial following in the eastern provinces.

== Economy ==
Tambul remains a scholarly and mercantile nation. Its universities, printing houses, and river trade are among the oldest institutions in [[West Hashir]], and Great Tambuli is still the ocean's principal language of contract and correspondence.

See also: [[Onchera]], [[Nilscodd]], [[Great Tambuli]], [[Ouken Ocean]], [[West Hashir]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:West Hashir]]
$md$),

-- --- Republic of Melcharia ---------------------------------------------------
('know', 'Melcharia', 'Melcharia', $md$
{{Infobox country
|conventional_long_name=Republic of Melcharia
|common_name=Melcharia
|native_name=Melcharei Vodrun ([[Melcharian language|Melcharian]])
|national_motto=''Free upon the heights''
|capital=[[Sarmarch]]
|official_languages=[[Melcharian language|Melcharian]]
|religion=54% [[Reformed Aidegani]] <br> 31% [[Aidegani]] <br> 15% others
|demonym=Melcharian
|government_type=Unitary parliamentary republic
|leader_title1=President
|leader_name1=[[Teoma Vask]]
|leader_title2=Prime Minister
|leader_name2=[[Ilsa Korden]]
|legislature=[[Vodrun Assembly]]
|established_event1=Melcharian Rising
|established_date1=2274 EC
|established_event2=Independence from [[Onchera]]
|established_date2=2288 EC
|area_km2=214,900
|population=9,600,000
|population_year=3104 EC
|currency=[[Melcharian mark|Mark]]
|time_zone=Hashir Standard
|calling_code=+68
|internet_tld=.ml
}}

'''Melcharia''', officially the '''Republic of Melcharia''', is an upland country of the interior of [[West Hashir]], lying along the cold silver-bearing ranges above the [[Ouken Ocean|Ouken]] coast. Once a frontier province of the [[Onchera]]n empire, Melcharia won its independence during the imperial collapse of the 23rd century EC and has been a republic, though not always a peaceful one, ever since.

Its roughly 9.6 million people are known for terraced [[blood algae]] ponds worked into the mountainsides, for silver and iron mining, and for a stubborn tradition of self-rule bound up with a reformed strand of the [[Aidegani]] sun-faith.

== History ==

=== Under Onchera ===
The Melcharian highlands were peopled first by [[Iratssa]] herders and later by [[Mira peoples|Mira]]-speaking settlers from the lowlands. Imperial [[Onchera]] annexed the ranges during its expansion for their silver and their algae-terraces, ruling them from garrison towns and taxing them heavily.

=== The Melcharian Rising ===
When the [[Ouken Algae Flood (2259)]] threw the Oncheran state into disorder, the highlands rose. The Melcharian Rising of 2274 EC fused grievance over taxes with a religious quarrel: Melcharian preachers had broken from orthodox [[Aidegani]] doctrine, and imperial suppression of their [[Reformed Aidegani|reformed church]] turned rebellion into a war of independence. Onchera, feudalising and beset elsewhere, could not hold the ranges, and recognised Melcharian independence in 2288 EC.

=== The republic ===
The young republic passed through generations of factional strife between mining towns, church councils, and highland clans before settling into its present parliamentary form. Melcharians regard the Rising as their founding act and the reformed church as its guardian.

== Geography ==
Melcharia is a landlocked country of high valleys and steep, mineral-rich ranges. The climate is cold and dry; agriculture depends on irrigated terraces, many of them stocked with cultivated [[blood algae]] adapted to the thin mountain air.

== Government and politics ==
Melcharia is a unitary parliamentary republic led by a President and Prime Minister answerable to the [[Vodrun Assembly]]. Its politics remain fractious, coloured by the old divisions of clan, church, and company.

== Demographics ==

=== Religion ===
A slim majority of Melcharians belong to the [[Reformed Aidegani]] church whose suppression sparked the Rising; a large minority keep to orthodox [[Aidegani]] as practised in [[Onchera]].

See also: [[Onchera]], [[Tambul]], [[Aidegani]], [[West Hashir]].

[[Category:Countries]]
[[Category:Republics]]
[[Category:Landlocked countries]]
[[Category:West Hashir]]
$md$)

ON CONFLICT DO NOTHING;

-- Backfill size_bytes for the rows just inserted (content is dollar-quoted above).
UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
  AND slug IN ('Nilscodd', 'Tambul', 'Melcharia')
  AND size_bytes = 0;

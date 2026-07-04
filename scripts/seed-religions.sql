-- Seed the religions of the Corlanth / Merope region (low-fantasy, Wikipedia format).
-- Companion to scripts/seed-countries-standalone.sql: these three faiths resolve the
-- religion redlinks in Valdheim, Calmarre, Khessar, and Ozeren. Each uses
-- {{Infobox religion}} with a simple SVG emblem (files in uploads/*.svg).
--
-- Run with: docker exec -i knowthing-db-1 psql -U knowthing -d knowthing < scripts/seed-religions.sql
--
-- Idempotent: ON CONFLICT DO NOTHING.

-- --- Emblems (media registry) ------------------------------------------------
INSERT INTO media (filename, filepath, mime_type, width, height, has_raster) VALUES
('concordant_church_emblem.svg', 'uploads/concordant_church_emblem.svg', 'image/svg+xml', 400, 400, false),
('astral_concord_emblem.svg',    'uploads/astral_concord_emblem.svg',    'image/svg+xml', 400, 400, false),
('skyfaith_emblem.svg',          'uploads/skyfaith_emblem.svg',          'image/svg+xml', 400, 400, false)
ON CONFLICT (filename) DO NOTHING;

-- --- Articles ----------------------------------------------------------------
INSERT INTO content_records (domain, slug, title, content) VALUES

-- === Concordant Church =======================================================
('know', 'Concordant Church', 'Concordant Church', $md$
{{Infobox religion
|name=Concordant Church
|type=Monotheistic ethical church
|image=concordant_church_emblem.svg
|caption=The linked rings of the Concord
|theology=The Concord — a divine order binding creation
|deity=The Ordinant
|scripture=The ''Book of Concord''
|founder=[[Saint Wolmar]]
|origin=Traditionally the 8th century, western [[Corlanth]]
|followers=≈45 million (predominant across western [[Corlanth]])
|leader=The [[Primate of Reeth]]
|headquarters=[[Reeth]], [[Corlanth]]
|language=Old Corlish (liturgical)
|branches=Orthodox Concord; Reformed congregations
|region=Western [[Corlanth]]
}}

The '''Concordant Church''' is the principal religion of western [[Corlanth]] and the established faith of both the [[Valdheim|Grand Duchy of Valdheim]] and the [[Calmarre|Serene Republic of Calmarre]]. It is a hierarchical monotheistic church centred on the doctrine of the '''Concord''': a divine order, ordained by a single creator called the Ordinant, that binds all creation into harmony against chaos.

== Beliefs ==
Concordant teaching holds that the world was set in order by the Ordinant and given to humankind under a covenant — the Concord — to preserve that order through just law, honest work, and mutual obligation. Sin is understood less as personal impurity than as a tearing of the common fabric; virtue, as its mending. The ''[[Book of Concord]]'', a compilation of law-codes, parables, and hymns, is the church's scripture.

== History ==
The church traces its founding to [[Saint Wolmar]], a reformer of the 8th century who is said to have gathered the scattered covenant-cults of the Corlish valleys into a single confession. From an early seat at [[Reeth]] the faith spread with the trade roads, becoming the dominant religion of the western continent.

A [[Reformed Aidegani|reforming]] movement in later centuries — stressing plain worship and the authority of the ''Book'' over that of the [[Primate of Reeth|Primate]] — divided the church into an Orthodox Concord and a body of Reformed congregations, a split still visible in the differing customs of [[Valdheim]] and mercantile [[Calmarre]].

== Organization ==
The Concordant Church is led by the Primate of Reeth, presiding over a hierarchy of arch-wardens and wardens. Its liturgy is conducted in Old Corlish, though preaching is in the vernacular.

== Relation to the Astral Concord ==
Scholars have long noted that the Concordant Church and the desert [[Astral Concord]] both hold the world to be bound by a divine "Concord," or order. Whether the two share a common root, or merely a word, is an old and unresolved debate among theologians of both faiths.

See also: [[Astral Concord]], [[Sky-Faith]], [[Valdheim]], [[Calmarre]], [[Corlanth]].

[[Category:Religions]]
[[Category:Corlanth]]
$md$),

-- === Astral Concord ==========================================================
('know', 'Astral Concord', 'Astral Concord', $md$
{{Infobox religion
|name=Astral Concord
|type=Astral religion
|image=astral_concord_emblem.svg
|caption=The nine fixed stars
|theology=A cosmic order read in the fixed stars
|deity=The Nine (the fixed stars)
|scripture=The ''Ephemerides''
|founder=[[Marran the Elder]] (traditional)
|origin=Traditionally the 6th century, the [[Marran Desert]]
|followers=≈14 million (chiefly [[Khessar]] and the caravan cities)
|leader=The [[High Astronomer of Al-Qesir]]
|headquarters=[[Al-Qesir]], [[Khessar]]
|language=Old Khessari (liturgical)
|region=The [[Marran Desert]] and the caravan diaspora
}}

The '''Astral Concord''' is the dominant religion of the [[Khessar|Emirate of Khessar]] and of the caravan cities of the [[Marran Desert]]. It teaches that the cosmos is bound by a fixed and knowable order — the Concord — written across the heavens in the "nine stars," the constant lights by which the desert may be crossed and the year reckoned.

== Beliefs ==
The Concord recognises no personal god but venerates the Nine: nine fixed stars held to be the regents of the celestial order. To read the stars truly is, in Astral teaching, both a science and an act of worship, for the same order that steers a caravan governs the turning of the seasons and the fate of nations. Its scripture, the ''[[Ephemerides]]'', is as much an almanac as a book of doctrine.

== History ==
Tradition ascribes the faith's founding to [[Marran the Elder]], a desert astronomer of the 6th century whose star-tables first made the deep desert reliably passable. The priest-astronomers who followed became keepers of the roads, the wells, and the calendar, and their authority grew with the caravan trade that depended on them.

== Organization ==
The Concord is led by the High Astronomer of [[Al-Qesir]], who presides over a network of observatory-temples strung along the caravan roads. Each temple keeps its own instruments, its portion of the ''Ephemerides'', and its watch upon the Nine.

== Practices ==
Worship centres on the nightly observation of the fixed stars, the maintenance of the calendar, and the blessing of caravans setting out across the sands. The emblem of the Nine — eight stars about a ninth — marks Concord temples and, since 1174, the flag of the emirate itself.

See also: [[Concordant Church]], [[Sky-Faith]], [[Khessar]], [[Marran Desert]].

[[Category:Religions]]
[[Category:Corlanth]]
$md$),

-- === Sky-Faith ===============================================================
('know', 'Sky-Faith', 'Sky-Faith', $md$
{{Infobox religion
|name=Sky-Faith
|type=Sky veneration and ancestor worship
|image=skyfaith_emblem.svg
|caption=The eye of the Eternal Sky
|theology=Reverence for the Eternal Sky and ancestral spirits
|deity=The Eternal Sky (''Kök'')
|scripture=Oral tradition; no fixed canon
|founder=None (immemorial)
|origin=The [[Ossian Steppe]], prehistoric
|followers=≈15 million (the [[Ossian Steppe]])
|leader=None central; clan sky-singers and elders
|language=Old Ozeric
|branches=Numerous clan traditions
|region=The [[Ossian Steppe]]
}}

The '''Sky-Faith''' is the traditional religion of the peoples of the [[Ossian Steppe]] and the principal faith of the [[Ozeren|Ozeren Federation]]. It is an ancient veneration of the open sky, held to be a supreme and eternal power, together with reverence for ancestral spirits and the spirits of land and water.

== Beliefs ==
At the centre of the faith stands the Eternal Sky, called ''Kök'' in [[Ozeric language|Ozeric]] — a boundless, impartial heaven over all things. Beneath it dwell the spirits of the ancestors and of the land, which must be honoured and kept in balance. The Sky-Faith has no scripture and no creed; its teachings live in songs, genealogies, and the customs of the clans.

== Organization ==
The faith has no central authority and no priesthood in the ordinary sense. Its rites are led by clan elders and by "sky-singers" — reciters and diviners who keep the songs and read the omens. Authority is local, tied to clan and place.

== Practices ==
The great occasions of the Sky-Faith are the seasonal gatherings, held when the scattered clans converge at appointed grounds. These combine worship, feasting, contests of horsemanship, the settling of disputes, and the recitation of ancestry — and remain, alongside the [[Great Kurultai]], among the central events of steppe life.

See also: [[Concordant Church]], [[Astral Concord]], [[Ozeren]], [[Ossian Steppe]].

[[Category:Religions]]
[[Category:Corlanth]]
$md$)

ON CONFLICT DO NOTHING;

-- Backfill size_bytes for the rows just inserted.
UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
  AND slug IN ('Concordant Church', 'Astral Concord', 'Sky-Faith')
  AND size_bytes = 0;

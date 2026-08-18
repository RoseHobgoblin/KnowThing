-- Seed Know-domain wiki articles for the Sunly system's planets and moons.
-- Each article embeds {{Infobox planet|from=<slug>}}, which pulls the body's
-- structured rodder data (see src/lib/server/structured-data.ts) at render time.
-- Run AFTER scripts/seed-sunly-planets.sql (the bodies must exist for from= to resolve).
--
-- Run with: docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-sunly-articles.sql
--
-- Idempotent: ON CONFLICT DO NOTHING on (domain, lower(slug)).

-- --- Planets -----------------------------------------------------------------
INSERT INTO content_records (domain, slug, title, content) VALUES
('know', 'Cinder', 'Cinder', $md$
{{Infobox planet|from=cinder}}

'''Cinder''' is the innermost planet of the [[Sunly system]], a small, airless world orbiting barely 0.39 AU from the [[Sun]]. Scorched on its dayside and frozen on its night, it is the most extreme of the system's rocky planets.

== Orbit ==
Cinder completes an orbit every 89 days on a markedly eccentric path (''e'' ≈ 0.21), so the intensity of sunlight on its surface swings widely between perihelion and aphelion. Its orbit is also steeply inclined relative to the system's plane.

== Surface ==
With effectively no atmosphere to move heat around, dayside temperatures climb past 400 °C while the nightside plunges below −170 °C. The crust is a battered silicate shell over a large iron-nickel core, pocked with impact basins and long compression scarps left as the young planet cooled and shrank.

See also: [[Marrow]], [[Cael]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
$md$),

('know', 'Marrow', 'Marrow', $md$
{{Infobox planet|from=marrow}}

'''Marrow''' is the second planet of the [[Sunly system]], a cloud-shrouded furnace often called the [[Sun]]'s "false dawn" for the gold light it casts. Beneath its haze it is the hottest world in the system.

== Atmosphere ==
Marrow is wrapped in a dense carbon-dioxide atmosphere some 88 times the pressure of [[Cael]]'s, laced with clouds of sulfuric acid. A runaway greenhouse keeps the surface near 462 °C almost pole to pole, day or night.

== Rotation ==
The planet turns slowly and ''backward'' — its day is longer than its year — so to any observer on the surface the Sun would rise in the west and set in the east, if it could be seen through the cloud at all.

See also: [[Cinder]], [[Cael]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
$md$),

('know', 'Cael', 'Cael', $md$
{{Infobox planet|from=cael}}

'''Cael''' is the third planet of the [[Sunly system]] and the only known world to bear liquid-water oceans, a breathable sky, and life. It sits comfortably within the [[Sun]]'s habitable zone at a mean distance of 1.05 AU.

== Orbit and climate ==
Cael circles the Sun once every 393 days on a nearly circular orbit, its modest 23° axial tilt giving it seasons. Blue oceans cover much of the surface beneath a nitrogen–oxygen atmosphere at about one bar of pressure.

== Mirl ==
Cael is attended by a single large moon, [[Mirl]], which is tidally locked and shows the planet only one face. Mirl's pull governs Cael's tides and helps stabilise its axial tilt over long spans of time.

See also: [[Marrow]], [[Rustmere]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
$md$),

('know', 'Rustmere', 'Rustmere', $md$
{{Infobox planet|from=rustmere}}

'''Rustmere''' is the fourth planet of the [[Sunly system]], a cold rust-red desert world orbiting the [[Sun]] at 1.62 AU. Its colour comes from iron-oxide dust that coats the entire surface.

== Surface ==
Rustmere is a dry world of dust storms, wind-carved canyons, and frozen polar caps of water ice. Its thin carbon-dioxide atmosphere — under a hundredth of [[Cael]]'s pressure — is too tenuous to hold much warmth, and mean temperatures sit near −55 °C.

== Moons ==
The planet is flanked by two small, irregular captured moons, [[Dask]] and [[Pel]], both dark potato-shaped splinters of rock. Dask races so close that it laps the planet three times a day.

See also: [[Cael]], [[Gorm]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
$md$),

('know', 'Gorm', 'Gorm', $md$
{{Infobox planet|from=gorm}}

'''Gorm''' is the fifth planet and the largest world of the [[Sunly system]], a banded amber gas giant that dominates the outer system from 5.3 AU. It holds more mass than all the other planets combined.

== Atmosphere ==
Gorm has no solid surface: it is a deep envelope of hydrogen and helium, streaked with amber and cream ammonia cloud bands and long-lived storms, wrapping a core of metallic hydrogen. It radiates more heat than it receives from the [[Sun]].

== Rings and moons ==
The planet is girdled by a faint system of dust rings and shepherds a swarm of some three dozen moons. The largest are the volcanic [[Tamber]], repaved yellow-orange by constant eruptions, and the ice-shelled [[Senn]], which hides a deep subsurface ocean.

See also: [[Rustmere]], [[Halvane]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
[[Category:Gas giants]]
$md$),

('know', 'Halvane', 'Halvane', $md$
{{Infobox planet|from=halvane}}

'''Halvane''' is the sixth planet of the [[Sunly system]], a serene cyan ice giant orbiting the [[Sun]] at 9.9 AU. Its calm colour comes from methane in the upper atmosphere, which absorbs red light.

== Character ==
Beneath an outer envelope of hydrogen, helium, and methane, Halvane is largely a mantle of water, ammonia, and methane ices over a small rocky core. It is steeply tilted on its axis — nearly 28° — and ringed by a thin, dark band of debris. A dozen moons attend it.

See also: [[Gorm]], [[Vesper]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
[[Category:Ice giants]]
$md$),

('know', 'Vesper', 'Vesper', $md$
{{Infobox planet|from=vesper}}

'''Vesper''' is the outermost known planet of the [[Sunly system]], a tiny, tilted iceworld on a long, eccentric orbit that carries it as far as the edge of the [[Sun]]'s warmth.

== Orbit ==
Vesper takes over 117 years to circle the Sun, on a path both highly eccentric (''e'' ≈ 0.25) and steeply inclined (about 17°) to the system's plane — marking it as a frozen remnant of the outer disc rather than a true sibling of the inner worlds. A thin nitrogen frost sublimes into a tenuous seasonal atmosphere when it nears perihelion.

See also: [[Halvane]], [[Sunly system]].

[[Category:Sunly system]]
[[Category:Planets]]
$md$)
ON CONFLICT DO NOTHING;

-- --- Moons -------------------------------------------------------------------
INSERT INTO content_records (domain, slug, title, content) VALUES
('know', 'Mirl', 'Mirl', $md$
{{Infobox planet|from=mirl}}

'''Mirl''' is the sole moon of the planet [[Cael]], a pale, heavily cratered world of anorthosite highlands. It is tidally locked, keeping one face turned toward Cael at all times.

Orbiting Cael every 27.3 days, Mirl raises the tides on its parent's oceans and steadies Cael's axial tilt, a quiet partner to the only inhabited world of the [[Sunly system]].

[[Category:Sunly system]]
[[Category:Moons]]
$md$),

('know', 'Dask', 'Dask', $md$
{{Infobox planet|from=dask}}

'''Dask''' is the inner of the two small moons of [[Rustmere]], a dark carbonaceous moonlet only a few kilometres across. It orbits so close to the planet that it circles roughly three times a [[Sunly system|Sunly]] day, rising in the west and setting in the east.

[[Category:Sunly system]]
[[Category:Moons]]
$md$),

('know', 'Pel', 'Pel', $md$
{{Infobox planet|from=pel}}

'''Pel''' is the outer moon of [[Rustmere]], a dark splinter of captured rock on a slow, distant loop around the planet. Together with its inner companion [[Dask]], it is likely a fragment left from an ancient collision rather than a body formed alongside Rustmere.

[[Category:Sunly system]]
[[Category:Moons]]
$md$),

('know', 'Tamber', 'Tamber', $md$
{{Infobox planet|from=tamber}}

'''Tamber''' is a volcanic moon of the gas giant [[Gorm]], the most geologically active body in the [[Sunly system]]. Flexed by Gorm's immense tides, its interior stays molten, and constant sulfur eruptions repave its yellow-orange surface faster than craters can accumulate.

[[Category:Sunly system]]
[[Category:Moons]]
$md$),

('know', 'Senn', 'Senn', $md$
{{Infobox planet|from=senn}}

'''Senn''' is an ice-shelled moon of the gas giant [[Gorm]]. Its cracked white crust of water ice conceals a deep subsurface ocean, kept liquid by tidal heating — making it one of the more intriguing places in the [[Sunly system]] to look for life beyond [[Cael]].

[[Category:Sunly system]]
[[Category:Moons]]
$md$)
ON CONFLICT DO NOTHING;

-- Backfill size_bytes for the rows just inserted (content is dollar-quoted above).
UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
  AND slug IN ('Cinder','Marrow','Cael','Rustmere','Gorm','Halvane','Vesper',
               'Mirl','Dask','Pel','Tamber','Senn')
  AND size_bytes = 0;

-- Rodder consumer-document and Wiki embed showcase.
--
-- Requires scripts/seed-palimpsest-reach.sql. The script is idempotent: reruns
-- update only this named showcase corpus, leaving authored user pages alone.
--
-- Run with:
--   docker compose exec -T db psql -U knowthing -d knowthing < scripts/seed-rodder-embed-showcase.sql

BEGIN;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM rodder_sectors WHERE slug = 'palimpsest-reach') THEN
		RAISE EXCEPTION 'Seed scripts/seed-palimpsest-reach.sql before the Rodder embed showcase';
	END IF;
END $$;

INSERT INTO content_records (domain, slug, title, content, plain_text, size_bytes) VALUES
('know', 'Rodder Embed Showcase', 'Rodder Embed Showcase', $wiki$
'''Rodder embeds''' are live views over the same consumer documents used by the full viewers and JSON API. This gallery deliberately repeats targets: the article loader deduplicates those reads before rendering.

== A locked editorial view ==
This wide sector establishing shot has a fixed camera and hidden controls. Hover remains available and the full-view link carries the composition into the sector viewer.

{{Sector map|palimpsest-reach|aspect=21:9|interaction=locked|focus=orison-fold|selected=glasswake}}

== A compact authored sky ==
Body labels and remote-star labels are separate settings. The local system is composed compactly while every authored remote root can be labelled independently.

{{Root map|orison-fold|mode=orrery|focus=nacre|labels=major|sky_labels=all|trails=short|visibility=enhanced|scale=compact|aspect=16:9|interaction=locked}}

== Inspection without camera drift ==
Readers may select bodies and open their pages, but the article's camera and display decisions remain fixed.

{{Root map|orison-fold|mode=plan|selected=nacre|labels=all|sky_labels=off|trails=full|scale=inner|interaction=inspect|aspect=3:2}}

== A fully explorable figure ==
This is the same live document with camera, selection, display controls, and navigation enabled.

{{Root map|drowned-choir|mode=orrery|selected=threnody|labels=major|sky_labels=hovered|visibility=markers|scale=log|interaction=explore|aspect=16:10}}

[[Category:Rodder]]
[[Category:Showcases]]
$wiki$, 'A gallery of locked, inspectable, and explorable Rodder maps backed by live consumer documents.', 0),

('know', 'Palimpsest Reach Navigator', 'Palimpsest Reach Navigator', $wiki$
The '''Palimpsest Reach Navigator''' demonstrates that a sector document exposes its full frame and all positioned roots without deciding how a consumer must present them.

== Survey desk ==
The selected root and camera focus are independent. Click another root, orbit the frame, or use the full-view link to keep the resulting camera.

{{Sector map|palimpsest-reach|interaction=explore|focus=orison-fold|selected=drowned-choir|aspect=16:9}}

== Fixed comparison plate ==
This second projection consumes the same document but locks the camera while retaining hover, selection, compact inspection, and navigation.

{{Sector map|palimpsest-reach|interaction=inspect|focus=veys-anvil|selected=needles-rest|camera=off|controls=hide|aspect=2:1}}

The coordinates are in authored light-years, use the Reach's declared right-handed frame, and never pretend that missing roots have a position.

[[Category:Rodder]]
[[Category:Palimpsest Reach]]
$wiki$, 'Interactive and fixed sector-map projections of the Palimpsest Reach.', 0),

('know', 'Skies Above Nacre', 'Skies Above Nacre', $wiki$
'''Skies Above Nacre''' compares apparent-sky display policies from [[Nacre]]'s containing root, [[Orison Fold]]. Each distant system remains one unresolved point source at its authored sector direction.

== Physical sky ==
The camera is fixed on Nacre and [[Glasswake]] is selected by readable <code>sky:</code> slug. Physical visibility may omit unavailable or sub-threshold sources rather than inventing light.

{{Root map|orison-fold|mode=orrery|focus=nacre|selected=sky:glasswake|labels=major|sky_labels=all|visibility=physical|scale=compact|interaction=inspect|aspect=2:1}}

== Navigation overlay ==
Markers mode may retain restrained minimum points. Remote sky labels stay independent of labels for Nacre, its moons, and the planets.

{{Root map|orison-fold|mode=orrery|focus=nacre|selected=sky:drowned-choir|labels=hovered|sky_labels=major|visibility=markers|scale=compact|interaction=explore|aspect=2:1}}

No procedural ambient catalogue appears in either view.

[[Category:Rodder]]
[[Category:Palimpsest Reach]]
$wiki$, 'A comparison of physical and marker apparent skies from Orison Fold.', 0),

('know', 'Orison Fold Orrery Laboratory', 'Orison Fold Orrery Laboratory', $wiki$
The '''Orison Fold Orrery Laboratory''' uses named arguments as a readable, reviewable composition format.

== System architecture ==
Plan mode, full trails, inner-system scaling, and all local labels make hierarchy and orbit shape the subject. Apparent-sky sources are correctly absent from Plan mode.

{{Root map|orison-fold|mode=plan|focus=orison|selected=the-redaction|date=4200|labels=all|sky_labels=all|trails=full|visibility=enhanced|scale=inner|interaction=explore|aspect=16:10}}

== Quiet publication figure ==
The same system becomes a locked, chrome-free Orrery illustration. Hover is explicitly disabled while the full-view link remains available.

{{Root map|orison-fold|mode=orrery|focus=serein|selected=the-marginalia|date=4200|labels=major|sky_labels=off|trails=short|visibility=enhanced|scale=log|interaction=locked|time=on|speed=250|hover=off|links=on|controls=hide|aspect=16:9}}

[[Category:Rodder]]
[[Category:Palimpsest Reach]]
$wiki$, 'Named-argument compositions for the Orison Fold root map.', 0),

('know', 'Drowned Choir Binary Light', 'Drowned Choir Binary Light', $wiki$
The '''Drowned Choir''' proves that a multiple-star root remains structurally honest at both scales: Cantor and Undertone have authored local orbits, while distant observers see their combined light as one apparent-sky source.

== Orbital diagram ==
{{Root map|drowned-choir|mode=plan|focus=cantor|selected=undertone|date=730|labels=all|sky_labels=off|trails=full|visibility=enhanced|scale=inner|interaction=inspect|aspect=3:2}}

== Ocean-world sky ==
{{Root map|drowned-choir|mode=orrery|focus=threnody|selected=sky:orison-fold|date=730|labels=major|sky_labels=all|trails=short|visibility=physical|scale=compact|interaction=explore|aspect=16:9}}

The first figure emphasizes the binary; the second emphasizes what an observer near [[Threnody]] can inspect and navigate to.

[[Category:Rodder]]
[[Category:Palimpsest Reach]]
$wiki$, 'Plan and Orrery projections of the Drowned Choir binary system.', 0),

('know', 'Veys Anvil Long View', 'Vey''s Anvil: The Long View', $wiki$
'''Vey's Anvil''' combines a giant primary, a distant white dwarf, and surviving worlds whose physical and schematic scales differ enormously.

== Local hierarchy ==
{{Root map|veys-anvil|mode=plan|focus=vey|selected=clinker|labels=all|sky_labels=off|trails=full|visibility=enhanced|scale=log|interaction=explore|aspect=16:10}}

== Published observer plate ==
The article keeps the giant centered, exposes remote-root labels, and permits selection while preventing accidental camera changes.

{{Root map|veys-anvil|mode=orrery|focus=vey|selected=sky:orison-fold|labels=major|sky_labels=all|trails=off|visibility=markers|scale=compact|interaction=inspect|aspect=16:9}}

[[Category:Rodder]]
[[Category:Palimpsest Reach]]
$wiki$, 'Two live projections of the Vey''s Anvil system.', 0),

('know', 'Needles Rest Copied Composition', 'Needle''s Rest: Copied Composition', $wiki$
This article starts from a complete copied root-view payload. It preserves an authored perspective camera, time, labels, trails, visibility, and scale without creating a saved-view record.

{{Root map|needles-rest|view=%7B%22version%22%3A1%2C%22renderer%22%3A%22root%22%2C%22space%22%3A%7B%22slug%22%3A%22needles-rest%22%7D%2C%22selected%22%3Anull%2C%22focus%22%3Anull%2C%22camera%22%3A%7B%22projection%22%3A%22perspective%22%2C%22target%22%3A%5B0%2C0%2C0%5D%2C%22direction%22%3A%5B0.42%2C0.31%2C0.85%5D%2C%22distance%22%3A18%2C%22zoom%22%3A1%2C%22fieldOfView%22%3A42%7D%2C%22mode%22%3A%22orrery%22%2C%22time%22%3A1200%2C%22labels%22%3A%22hovered%22%2C%22skyLabels%22%3A%22all%22%2C%22trails%22%3A%22short%22%2C%22visibility%22%3A%22markers%22%2C%22exposure%22%3A%22auto%22%2C%22scale%22%3A%22compact%22%2C%22follow%22%3Afalse%7D|interaction=inspect|selected=spindle|visibility=physical|sky_labels=major|date=2200|aspect=2:1}}

The explicit arguments win over the payload: [[Spindle]] is selected, the date is 2200, physical visibility replaces markers, and sky labels become major-only. The copied camera and every non-overridden choice survive.

== Copied sector composition ==
{{Sector map|palimpsest-reach|view=%7B%22version%22%3A1%2C%22renderer%22%3A%22sector%22%2C%22space%22%3A%7B%22slug%22%3A%22palimpsest-reach%22%7D%2C%22selected%22%3A%22drowned-choir%22%2C%22focus%22%3A%22orison-fold%22%2C%22camera%22%3A%7B%22position%22%3A%5B19%2C14%2C23%5D%2C%22target%22%3A%5B0%2C0%2C0%5D%2C%22fieldOfView%22%3A46%7D%7D|selected=veys-anvil|interaction=inspect|aspect=2:1}}

Here the copied sector camera and focus survive while the readable selected slug overrides the payload.

[[Category:Rodder]]
[[Category:Showcases]]
$wiki$, 'Copied root and sector view payloads with readable named overrides.', 0),

('know', 'Rodder Consumer API Field Guide', 'Rodder Consumer API Field Guide', $wiki$
The maps below and external clients consume the same live documents. There is no private renderer-only query shape to reverse engineer.

== Useful endpoints ==
* <code>/api/rodder/orison-fold</code> — complete entity document, relationships, authored facts, normalized facts, root-map projection, apparent sky, capabilities, links, and local diagnostics.
* <code>/api/rodder/sectors/palimpsest-reach</code> — frame contract, all roots, bounds, provenance, capabilities, links, and diagnostics.
* <code>/api/rodder/schema</code> — machine-readable entity, sector, view-state, display configuration, diagnostics, and interaction-policy schemas.

{{Sector map|palimpsest-reach|interaction=inspect|selected=orison-fold|aspect=3:1}}
{{Root map|orison-fold|interaction=locked|time=on|speed=100|controls=hide|focus=nacre|selected=nacre|labels=major|sky_labels=major|visibility=enhanced|scale=compact|aspect=3:1}}

Authored values remain separate from derived and illustrative projections. Missing optional data stays a successful document with scoped diagnostics.

[[Category:Rodder]]
[[Category:API]]
$wiki$, 'A field guide to Rodder entity, sector, and schema API documents.', 0),

('know', 'Rodder Embed Diagnostics', 'Rodder Embed Diagnostics', $wiki$
This page intentionally supplies bad local input to prove that one malformed display cannot break an article.

== Non-root target ==
[[Nacre]] has a canonical entity document and page, but it is not a sector root. The embed explains that locally and offers the canonical entity link.

{{Root map|nacre|interaction=inspect}}

== Individually invalid arguments ==
Each bad argument falls back independently. The valid selected slug and interaction preset continue to work.

{{Root map|orison-fold|mode=sideways|selected=nacre|labels=everything|sky_labels=major|trails=forever|visibility=imaginary|scale=tiny|aspect=99:1|interaction=inspect}}

== Invalid copied view ==
The payload is discarded as one unit; readable arguments still compose the map.

{{Root map|glasswake|view=%7B%22renderer%22%3A%22sector%22%7D|mode=orrery|focus=vitria|selected=vitria|interaction=inspect|aspect=2:1}}

== Missing resources ==
{{Sector map|there-is-no-such-sector|interaction=locked}}
{{Root map|there-is-no-such-root|interaction=locked}}

[[Category:Rodder]]
[[Category:Diagnostics]]
$wiki$, 'Intentional local failures demonstrating resilient Rodder embed diagnostics.', 0),

('know', 'Rodder Display Capacity Test', 'Rodder Display Capacity Test', $wiki$
This stress article contains 25 unique display targets. A request resolves at most 24: the page reports the overflow and the final target receives a local diagnostic. The many non-root entities also demonstrate that every resolved target retains a canonical document and link even when it cannot produce a root map.

{{Root map|orison-fold|aspect=3:1}}
{{Root map|glasswake|aspect=3:1}}
{{Root map|veys-anvil|aspect=3:1}}
{{Root map|drowned-choir|aspect=3:1}}
{{Root map|needles-rest|aspect=3:1}}
{{Root map|orison|aspect=3:1}}
{{Root map|palinode|aspect=3:1}}
{{Root map|aster-vale|aspect=3:1}}
{{Root map|vey|aspect=3:1}}
{{Root map|clinker|aspect=3:1}}
{{Root map|cantor|aspect=3:1}}
{{Root map|undertone|aspect=3:1}}
{{Root map|needle|aspect=3:1}}
{{Root map|nacre|aspect=3:1}}
{{Root map|bellweather|aspect=3:1}}
{{Root map|ash-of-noon|aspect=3:1}}
{{Root map|the-redaction|aspect=3:1}}
{{Root map|serein|aspect=3:1}}
{{Root map|hush|aspect=3:1}}
{{Root map|the-marginalia|aspect=3:1}}
{{Root map|vitria|aspect=3:1}}
{{Root map|heliograph|aspect=3:1}}
{{Root map|proof|aspect=3:1}}
{{Root map|ferrule|aspect=3:1}}
{{Root map|anvilwake|aspect=3:1}}

[[Category:Rodder]]
[[Category:Diagnostics]]
$wiki$, 'A deterministic stress case for Rodder display batching and the 24-target ceiling.', 0)
ON CONFLICT (domain, (LOWER(slug))) DO UPDATE SET
	title = EXCLUDED.title,
	content = EXCLUDED.content,
	plain_text = EXCLUDED.plain_text,
	parsed_ast = NULL,
	size_bytes = octet_length(EXCLUDED.content),
	updated_at = NOW();

UPDATE content_records
SET size_bytes = octet_length(content)
WHERE domain = 'know'
	AND slug IN (
		'Rodder Embed Showcase',
		'Palimpsest Reach Navigator',
		'Skies Above Nacre',
		'Orison Fold Orrery Laboratory',
		'Drowned Choir Binary Light',
		'Veys Anvil Long View',
		'Needles Rest Copied Composition',
		'Rodder Consumer API Field Guide',
		'Rodder Embed Diagnostics',
		'Rodder Display Capacity Test'
	);

DO $$
DECLARE
	showcase_count integer;
BEGIN
	SELECT COUNT(*) INTO showcase_count
	FROM content_records
	WHERE domain = 'know'
		AND slug IN (
			'Rodder Embed Showcase',
			'Palimpsest Reach Navigator',
			'Skies Above Nacre',
			'Orison Fold Orrery Laboratory',
			'Drowned Choir Binary Light',
			'Veys Anvil Long View',
			'Needles Rest Copied Composition',
			'Rodder Consumer API Field Guide',
			'Rodder Embed Diagnostics',
			'Rodder Display Capacity Test'
		);
	IF showcase_count <> 10 THEN
		RAISE EXCEPTION 'Expected 10 Rodder showcase articles, found %', showcase_count;
	END IF;
END $$;

COMMIT;

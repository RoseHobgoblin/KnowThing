# KnowThing and World Anvil: Current Product Comparison

- **Status:** Dated competitive product audit; evidence, not product architecture
- **Research date:** 18 August 2026
- **KnowThing snapshot:** repository commit `68d2d11d236d` plus the current documentation working tree
- **World Anvil scope:** publicly documented product behavior and pricing available on the research date
- **Related documents:** [Structured Objects, Facets, and Displays](../architecture/STRUCTURED-DATA-VISION.md), [Atlas Architecture](../architecture/Atlas-Architecture.md), [Celestial Views, Authoring, and Wiki Embeds](../architecture/celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md)

> **Interpretation:** This is not a feature wish list and it does not establish KnowThing's roadmap. It compares a deployed commercial service with an early self-hosted application whose strongest domains are unusually deep. “Not present” means no reachable implementation was found in the inspected KnowThing repository. “Not verified” means World Anvil's public documentation did not establish the claim.

## Executive Conclusion

World Anvil and KnowThing overlap, but they are not currently substitutes.

World Anvil is a mature hosted suite for broad worldbuilding, presentation, controlled readership, fiction writing, and tabletop campaigns. Its strength is not just the number of tools. Its typed article fields feed specialized displays and workflows: character relationships become family trees, organization relationships become diplomacy webs, historical events can appear on multiple timelines, maps and timelines combine in Chronicles, and all of those artifacts can be embedded in articles.

KnowThing is becoming a self-hosted structured knowledge engine with a MediaWiki-like composition language and unusually deep computational domains. Its strongest implemented advantages are:

- first-class WikiText parsing, transclusion, namespaces, backlinks, and recoverable revisions;
- structured linguistics beyond a dictionary, including phonology, orthography, dialects, etymological relations, and inflection systems;
- structured celestial hierarchies, orbital data, generated surfaces, interactive system views, and authored three-dimensional sectors;
- a rule-driven calendar engine with date arithmetic, eras, seasons, leap rules, and moon phases;
- direct ownership of the database, files, deployment, and source.

The most important corrections to the previous comparison are:

1. **World Anvil is not merely a collection of disconnected text forms.** It already turns some typed fields and relationships into useful displays, although those capabilities are constrained by article type and feature module.
2. **KnowThing does not yet have one unified structured object model.** It has shared content infrastructure and several purpose-built domain schemas. The generic object/facet/display model is current architecture direction, not current implementation.
3. **World Anvil's calendar is active and documented.** The previous claim that it was stalled was unsupported. KnowThing has the deeper reckoning engine; World Anvil has the stronger connection to events, timelines, embeds, and reader access.
4. **World Anvil does not provide article revision history.** Its official suggestion board describes revision history as missing and records the request as declined. KnowThing does provide article and lexicon revision history and restoration.
5. **“World Anvil has nothing in astronomy” was too absolute.** It can document planets, systems, stations, and galaxies with articles and maps. What its public documentation does not show is a specialized astronomical data model or physically informed system/sector renderer comparable to KnowThing's.
6. **A star rating is false precision.** The products optimize for different users and maturity levels. This audit uses capability, depth, integration, and strategic relevance instead.

## Research Method and Limits

### KnowThing evidence

KnowThing claims were checked against reachable routes, database schema, services, renderer code, and tests. The main evidence anchors are:

- [database schema](../../src/lib/server/db/schema.ts);
- [WikiText parser types](../../src/lib/parser/types.ts), [template expansion](../../src/lib/parser/template-expansion.ts), and [built-in template registry](../../src/lib/templates/registry.ts);
- [namespace registry](../../src/lib/namespaces/registry.ts) and [search services](../../src/lib/server/services/search/);
- [Wordbook services](../../src/lib/server/services/wordbook.ts), [etymology traversal](../../src/lib/server/wordbook/etymology.ts), and [inflection services](../../src/lib/server/services/inflections.ts);
- [Rimecraft calendar engine](../../packages/rimecraft/src/);
- [celestial model and renderers](../../src/lib/celestial/) and [sector authoring routes](../../src/routes/celestial/manage/sectors/);
- [WorldMap model](../../src/lib/worldmap/) and [region authoring route](../../src/routes/worldmap/[slug]/regions/);
- [media service](../../src/lib/server/services/media.ts), [permissions](../../src/lib/server/auth-permissions.ts), and [page export](../../src/routes/dashboard/export/+page.server.ts).

An existing table or type was not counted as a finished product feature unless a service or reachable interface uses it. A design document was not counted as implementation.

### World Anvil evidence

World Anvil claims use its current pricing page, official Learn documentation, API documentation, changelog, and official feature-request responses. Marketing descriptions were treated as evidence that a feature is offered, not evidence of usability, performance, reliability, or technical quality.

This audit did not use a paid World Anvil account. It therefore cannot fairly compare:

- subjective editing speed or cognitive load;
- rendering performance at large-world scale;
- undocumented limits or edge cases;
- support quality, uptime, or operational security;
- import/export fidelity beyond documented behavior;
- accessibility beyond documented controls and visible implementation evidence.

## Product Center of Gravity

| Question | World Anvil | KnowThing today |
|---|---|---|
| Primary product | Hosted worldbuilding, publishing, writing, and RPG suite | Self-hosted structured wiki and domain workbench |
| Default authoring model | Choose a typed article template, answer prompts, connect supported fields, embed feature modules | Write WikiText and/or author a purpose-built domain record through a specialized editor |
| Reader model | Public worlds, private worlds, subscribers, followers, communities, campaigns, and monetized readership | Mostly site-wide public reading plus authenticated role-based authoring |
| Data model | Many mature, product-specific entity types and modules | Shared content records plus separate typed domain tables; generic facets are planned |
| Strongest breadth | Maps, history, relationships, access control, manuscripts, RPG, community | Wiki, language construction, calendars, celestial modeling, media integrity |
| Deployment | Multi-tenant SaaS | Local or self-hosted Node/PostgreSQL deployment |
| Best fit | Creator who wants an integrated suite and hosted audience now | Builder who values ownership, extensibility, WikiText, and deep structured systems |

World Anvil is the much more complete general product. KnowThing is the more technically ambitious knowledge substrate in a few domains, but it still lacks several pieces required to function as a complete publishing platform for other people.

## Architecture: Fields, Relationships, and Displays

This is the most strategically useful comparison.

### World Anvil's implemented pattern

World Anvil has 28 documented worldbuilding article types. Each provides prompts and type-specific relationship fields. Those fields are not all inert prose:

- Character parent and relationship fields feed family trees and relationship panels.
- Organization relationships feed diplomacy webs.
- Plot parentage feeds plot trees.
- Some article relations generate article trees.
- Language articles own a searchable dictionary widget.
- Historical events can be reused across timelines.
- Maps, timelines, calendars, trees, statblocks, and other artifacts can be embedded in articles.

This is already a form of **fields becoming displays**.

Its main architectural constraint is that the behavior is feature-specific. Article links in structured fields are restricted by template type, an article cannot change its base type after creation, and a custom article template inherits a default template rather than declaring an arbitrary new field schema. World Anvil's custom templates can alter default content, presentation, CSS, and Twig layout, but its documentation explicitly says they cannot create new text fields.

### KnowThing's implemented pattern

KnowThing has a shared `content_records` layer for prose, parsed ASTs, links, categories, revisions, and media usage. Namespaced routes let domain entities behave like wiki pages. Specialized templates such as `{{phonology}}`, `{{orthography}}`, and `{{system map}}` render structured records inside prose.

The structured data itself is still divided among purpose-built schemas:

- calendars;
- languages, phonemes, graphemes, dialects, lexicon entries, relations, and inflections;
- celestial bodies, orbital hierarchy, sectors, and sector roots;
- maps, countries, regions, and region geometry;
- media and stable media bindings.

This is useful domain modeling, but it is not yet the generic object/facet architecture described in [Structured Objects, Facets, and Displays](../architecture/STRUCTURED-DATA-VISION.md). There is no general runtime system through which an author declares facets, arbitrary typed relationships, field schemas, display capabilities, or saved views.

### The real distinction

```text
World Anvil today
  typed product module
    -> module-owned fields and relations
    -> module-owned display
    -> embed in article

KnowThing today
  typed domain table + shared prose infrastructure
    -> domain service
    -> specialized display/template
    -> render beside or inside WikiText

KnowThing direction
  stable object
    -> composable facets and relationships
    -> capability-selected displays and saved views
    -> permission-aware WikiText transclusion
```

KnowThing's opportunity is not to rediscover field-driven displays. World Anvil demonstrates their product value already. The opportunity is to make them more composable, more revision-aware, less type-siloed, and available to domains World Anvil does not model deeply.

## Wiki, Articles, and Authoring

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Long-form world articles | Implemented | Implemented | Both are credible article systems |
| Beginner editor | Visual editor with slash menu and autosave | Source editor with live preview | World Anvil has the easier first-run path |
| Power-user markup | BBCode advanced editor | MediaWiki-style WikiText | Different dialects; KnowThing is closer to encyclopedia authoring |
| Typed prompts | 28 article types with guided prompts | Specialized forms for implemented domains; freeform wiki elsewhere | World Anvil has far broader guided coverage |
| Custom templates | Grandmaster+: parent template, default content, CSS, Twig layout; no new text fields | DB templates with parameter substitution plus built-in Svelte renderers | World Anvil has stronger presentation tooling; KnowThing has stronger wiki transclusion semantics |
| Internal links | Implemented, with mention/autolink workflows | Internal, namespace, Wordbook, and external link nodes | Both implemented |
| Categories and hierarchy | Categories, parent articles, linear navigation | Wiki categories, namespaced resolution, subpage paths | World Anvil has more authoring UI; KnowThing has stronger wiki semantics |
| Backlinks | “Where mentioned” workflow | Stored link graph and backlink endpoints | Both implemented |
| Reusable fragments | Variables and embeds | Recursive DB templates, built-in templates, magic words | Both implemented with different tradeoffs |
| Article revision history | Not available according to the official declined request | History, diffs, edit summaries, and restore | Clear KnowThing advantage |
| Structured query language | Not documented | Planned, not implemented | Neither can be credited today |
| Saved interactive view transclusion | Feature-specific embeds | `{{system map}}` exists; generic saved views are planned | World Anvil is broader today; KnowThing's target is more general |

World Anvil's editor is productized around guided creation and quick linking. KnowThing's editor is productized around source clarity and deterministic rendering. KnowThing should not treat visual/guided authoring as philosophically opposed to WikiText: a visual editor can be another display that writes the same underlying fields or source.

## Linguistics and Constructed Languages

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Language article | Typed article with prompts for structure and usage | Structured language record plus WikiText body | Both implemented |
| Dictionary | Searchable dictionary owned by a Language article | Dedicated Wordbook with language pages and entry routes | Both implemented; KnowThing is deeper |
| Import | VulgarLang-compatible BBCode and dictionary CSV | No equivalent general language import found | World Anvil advantage |
| Multiple definitions/senses | Not established by public docs | Separate definition rows with sense, part of speech, examples, and dialect | KnowThing advantage |
| Homographs | Not established | First-class lexicon entries and homograph views | KnowThing advantage |
| Phoneme inventory | Prose prompt | Typed IPA phonemes and feature metadata with editor | KnowThing advantage |
| Orthography | Prose/writing-system guidance | Graphemes, ordering, grapheme-to-phoneme mapping, rendered orthography table | KnowThing advantage |
| Dialects and variants | Can be represented as articles and prose | Typed dialects plus lexicon variants and dialect-specific definitions | KnowThing advantage |
| Etymology | Prose fields | Typed `derived_from`, `loan_from`, and `compound_of` relations with graph traversal | KnowThing advantage |
| Language families | Article relationships/content trees can represent them | Typed parent language plus rendered language tree | KnowThing has stronger linguistic semantics; World Anvil has flexible general trees |
| Inflection | Manual prose/tables | Dimensions, paradigm classes, rules, generated forms, and overrides | Clear KnowThing advantage |
| Custom script/font generation | Not documented | Not implemented | Neither credited |

KnowThing's lead here is substantive rather than cosmetic. World Anvil helps an author describe a language and publish a dictionary. KnowThing models parts of the language itself and can derive displays and forms from that model.

The product lesson from World Anvil is import and accessibility. A deep engine is less useful when authors cannot efficiently bring in existing work or get a simple dictionary online before configuring a full phonology and paradigm system.

## Maps and Spatial Authoring

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Base map | Uploaded raster image; World Anvil says it is not mapmaking software | Uploaded SVG-backed WorldMap; separate 3D celestial sector | Different foundations |
| Point markers | Pins with article/map links | No general WorldMap point marker authoring | World Anvil advantage |
| Lines/routes | Styled line markers | No general route model or authoring UI | World Anvil advantage |
| Areas | Circle and polygon markers | Imported SVG regions linked to countries/pages | Both support areas; World Anvil authoring is broader |
| Labels | Interactive map labels | Region labels | World Anvil is more flexible |
| Layers | Multiple raster/transparent layers and marker groups | Region geometry and colors; no general layer stack | World Anvil advantage |
| Drill-down | A marker can open another map | Region/page navigation; sector-to-system transition | World Anvil broader for general maps; KnowThing deeper for celestial scale changes |
| Reader controls | Zoom, layers, marker groups, privacy; some draggable markers | Pan/zoom on WorldMap; orbit/pan/zoom/focus on celestial views | Both interactive |
| Structured recoloring | Not documented as data-driven | Authored country/region colors; general data-driven thematic layers not implemented | KnowThing has a foundation, not a finished advantage |
| Time-aware map | Chronicles can switch maps with events | `timePeriod` and `event` metadata exist, but no time slider/event model | World Anvil advantage |
| Wiki embed | Implemented map embeds | General WorldMap embed not found; system-map template implemented | World Anvil broader today |

World Anvil is decisively ahead for general-purpose map publication and authoring. KnowThing's old comparison overvalued having SVG regions and undervalued the full workflow around pins, labels, routes, layers, visibility, and embeds.

KnowThing's strategic answer should be Atlas capabilities, not a clone of World Anvil's map editor. A position, geometry, route, territory claim, event location, and saved camera should be reusable across globes, projected maps, sector maps, timelines, infoboxes, and WikiText. That architectural advantage remains prospective until those objects and displays exist.

## Calendars, Timelines, and Historical Events

### Calendar comparison

World Anvil's current calendar documentation covers configurable weekdays, months, day offset, repeating celestial objects, recurring events, embedding, import/export, and premade calendars. Chronicles also has its own simpler calendar configuration with months, leap days, and time-unit lengths.

KnowThing's Rimecraft engine supports arbitrary week length, regular/intercalary/lunisolar leap months, leap-day divisibility rules, eras with forward or reverse numbering, dated or periodic cultural seasons, weather metadata, multiple moon cycles, absolute-day conversion, weekday resolution, Unix timestamp bridges, month grids, validation, and calendar magic words.

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Custom weekdays/months | Implemented | Implemented | Parity at base level |
| Leap behavior | Calendar and Chronicle leap-day support | Divisibility rules plus intercalary and lunisolar leap months | KnowThing's engine is deeper |
| Celestial cycles | Repeating calendar objects | Multiple moon cycles, offsets, phases, colors | Both implemented; KnowThing exposes more reckoning logic |
| Eras | Timeline eras; calendar-era behavior not established | Calendar eras and display formatting | KnowThing advantage within calendar reckoning |
| Seasons | Not established in current calendar docs | Dated/periodic cultural seasons and optional weather | KnowThing advantage |
| Date arithmetic/conversion | Not established | Absolute-day conversion, reverse conversion, weekdays, timestamps | KnowThing advantage |
| Cultural authority | Calendar is authored as a cycle/template | Calendar rules are authoritative; optional planet relation does not override culture | Aligned in spirit |
| Embedding | Calendar BBCode embed with selected year | Calendar pages and magic words; generic view embedding not yet present | World Anvil has the clearer reusable embed workflow |
| Event integration | Recurring events and timeline/Chronicle workflows | No first-class general historical event model | World Anvil advantage |

The correct conclusion is split: **KnowThing has the stronger calendar engine; World Anvil has the stronger history product.**

### Timelines and events

World Anvil has reusable historical events, multiple timeline modes, eras, parallel lanes, filters, article connections, privacy, and Chronicles that link events to map markers. KnowThing has no first-class general event, era-as-history, timeline, or chronicle interface.

This is one of KnowThing's most important cross-domain gaps because events belong in calendars, maps, celestial settings, people, factions, settlements, and articles. It should eventually be solved as a reusable temporal/event facet and display family, not as a celestial-only timeline.

## Celestial Systems and Sectors

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Describe planets/systems | Geography, location, building, vehicle, generic, and other articles can document them | Typed system/star/body records with WikiText body | Both can publish lore; KnowThing has the specialized model |
| Hierarchy | General article parents/trees | Unified parent graph for systems, stars, planets, moons, and other bodies | KnowThing advantage |
| Physical fields | Template prose fields where applicable | Mass, radius, temperature, luminosity, orbit, rotation, atmosphere, composition, and more | KnowThing advantage |
| Orbital mechanics | No specialized model found in public docs | Orbital periods/elements, hierarchy validation, computed layouts | KnowThing advantage |
| System viewer | No specialized orrery found | Interactive Three.js plan and orrery modes with time, focus, trails, visibility, and camera controls | Clear KnowThing advantage |
| Surface representation | Images/maps and prose | Authored surface targets, procedural illustrative surfaces, stellar surfaces, and media bindings | KnowThing advantage |
| 3D sectors | Interactive image maps can represent space | Authored reference frames, sector roots, 3D viewer, sector-to-system navigation | KnowThing advantage |
| Sector authoring | General map marker placement | Sector CRUD, frame authoring, root membership, and XYZ placement | KnowThing advantage |
| Apparent sky/distant stars | Can be illustrated with an uploaded image/map | **Not implemented** as a generated, position-dependent sky | Critical KnowThing gap |
| Reusable locked view | Feature-specific map embeds | Generic saved camera/layer/time view is planned, not implemented | Gap against KnowThing's own vision |

KnowThing has a real differentiated product here. It should still avoid claiming completion. The current sector is mainly root positions and navigation. Routes, influence volumes, interstellar regions, moving agents, generated distant-sky backdrops, and permission-aware saved views remain absent.

The missing apparent sky matters more than another physical field. A system viewer that cannot show the surrounding authored universe fails to make sector data perceptually continuous with local experience. The same sector catalogue should feed:

- points in the sector view;
- distant stars in an Orrery backdrop;
- the sky from a planet or station;
- constellation and cultural-sky overlays;
- exposure, magnitude, and visibility filters;
- a serialized WikiText-citable view.

## People, Organizations, Relationships, and World History

World Anvil provides first-class character articles, detailed pair relationships, family trees, organization relations, diplomacy webs, plot trees, content trees, historical events, and links among these objects. These are mature worldbuilding displays above the level of physical places and objects.

KnowThing has person, royalty, officeholder, religion, settlement, and country infobox renderers, but most of those are WikiText presentation schemas rather than first-class domain records. It does not have a generic typed relationship store for arbitrary entities, family or diplomacy authoring, factions, settlements as composable structured objects, territories, routes, or historical events.

This is not a reason to copy World Anvil's types one by one. It is evidence for the value of the pinned architectural direction:

- relationships must be first-class records rather than display-owned fields;
- events must be reusable across articles, timelines, maps, calendars, and participants;
- organizations, settlements, routes, claims, and anomalies must work outside the celestial area too;
- trees, graphs, map overlays, lists, and infoboxes should be alternative displays of shared facts.

Until that layer exists, World Anvil is much better at making a setting feel inhabited and historical rather than catalogued.

## Media Management

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Upload and embed | Implemented, including drag/drop in visual editor | Implemented for images and PDFs with WikiText rendering | Both implemented |
| Organization | Folders, nested folders, tags, favorites, galleries | Categories, filters, search | World Anvil broader |
| Public galleries | Static galleries and carousel embeds | Gallery WikiText node, but no comparable managed public gallery workflow found | World Anvil advantage |
| Attribution | Dedicated artist/source fields and displayed credits | Description only; no dedicated credit model found | World Anvil advantage |
| Alt text | Dedicated field | Per-use image option; no asset-level alt field | Different; World Anvil's asset workflow is stronger |
| Processing | Documented dimensions/size | MIME verification, SVG sanitization, optional EXIF stripping, rasterization, and 150/300/600 thumbnails | KnowThing advantage |
| Deduplication | Not established | SHA-256 duplicate rejection | KnowThing advantage |
| Usage tracking | Not established in public docs | Page and structured-asset usage | KnowThing advantage |
| File versions | Not established | Replace, archive, list, and restore versions | KnowThing advantage |
| Bulk editing | Grandmaster mass edit | Not found | World Anvil advantage |
| Storage | Tiered hosted limits | Limited by the self-hosted installation | Different operating models |

The previous comparison gave KnowThing an unqualified win. The current evidence shows complementary strengths. KnowThing is better at file integrity and recoverability. World Anvil is better at the creator-facing library, attribution, galleries, bulk organization, and access control.

## Search, Navigation, and Knowledge Maintenance

World Anvil's global world search is organized by entity type and supports opening, editing, viewing, linking, and embedding results. Its public guide describes searching article titles after three characters. Manuscripts adds manuscript-wide search/replace and in-context access to world articles.

KnowThing uses PostgreSQL full-text search across prose and selected structured domains, with ranking and highlighted snippets. Wordbook search includes exact/form/prefix/full-text behavior and language, part-of-speech, and tag filters. Media has filename/metadata search and type/category filters. It also exposes wanted pages, orphan pages, random pages, recent edits, categories, backlinks, and site statistics.

| Area | Better-supported conclusion |
|---|---|
| Fast entity navigation and create/edit actions | World Anvil has the more mature omnipresent workflow |
| Full body-text search with ranked snippets | KnowThing is explicitly implemented; World Anvil's general search docs do not establish equivalent behavior |
| Lexical search | KnowThing is substantially deeper |
| Wiki maintenance | KnowThing's wanted/orphan/backlink/recent-edit model is stronger |
| Cross-domain structured query | Neither product is credited; KnowThing's query syntax remains planned |

## Revisions, Integrity, and Recoverability

KnowThing's revision support is a genuine differentiator:

- wiki content revisions record title, content, size, summary, author, and time;
- page history supports diffs and restoration;
- lexicon snapshots include related entry state and can be restored;
- media replacements are archived and restorable;
- database constraints and transactional services enforce many domain invariants;
- celestial hierarchy and sector membership have explicit integrity rules.

The generic `entity_revisions` table exists, but it is not currently wired into every structured domain. KnowThing should not claim universal revisioning until calendar, celestial, language, map, and future facet mutations share a complete revision and restore contract.

World Anvil autosaves articles by default and now offers optional manual save. Its official response to a revision-history request says article version history is missing and the request was declined. Its co-author documentation also warns that deleted content cannot be recovered by World Anvil. Its Guild world export is therefore valuable as a backup mechanism, but it is not a substitute for per-edit history.

## Permissions, Collaboration, and Publication

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Author roles | Writer, Advanced Writer, Editor, Co-Owner | Viewer, Editor, Admin, Owner | Both role-based; World Anvil is more workflow-specific |
| Co-authoring | Tiered co-author slots; edit-conflict prevention | Multiple local users; no live co-editing or edit lock found | World Anvil advantage |
| Public/private world | Guild feature | Deployment can be private, but no authored world-level publication model | Different; self-hosting is not the same as publication control |
| Per-item visibility | Articles, maps, timelines, events, markers, and more | Not implemented | World Anvil advantage |
| Reader groups | Subscriber groups | Not implemented | World Anvil advantage |
| Private article sections | Subscriber containers | Not implemented | World Anvil advantage |
| Password/access-code sharing | Sage features | Not implemented | World Anvil advantage |
| Draft/publish workflow | Draft/public/private and reader access workflows | Role-gated editing; no general draft/publish state | World Anvil advantage |
| Live collaborative editing | Manuscripts explicitly do not support co-writing; articles prevent simultaneous editing | Not implemented | Neither is a Google Docs-style collaborator |

KnowThing's roles protect mutation. They do not yet model what different readers are allowed to know. For a world encyclopedia, this is not peripheral. Saved views, query results, infoboxes, and backlinks must all respect the same publication and field-level visibility decisions or they will leak restricted facts.

## RPG, Fiction Writing, and Community

World Anvil has major product families KnowThing does not attempt today:

- campaign manager, player characters, parties, quests, equipment, plots, sessions, primers, and reports;
- Digital Storyteller Screen with library, plot, party, dice, handout, and media tools;
- community and custom statblocks, character sheets, and Foundry VTT access;
- Manuscripts with chapters/scenes, outlining, labels, notes, focus/read/review modes, world search, publishing, and export;
- personal notebooks and whiteboards;
- discussion boards, followers, comments, challenges, discovery, and creator monetization workflows.

These are decisive advantages for users who need them and mostly poor parity targets for KnowThing.

The reusable concepts should still inform the generic platform:

- a plot is an ordered relationship graph;
- a session is an event with participants, sources, and restricted notes;
- a manuscript reference is a relationship to an object or revision;
- a handout is a permissioned display;
- a family tree and diplomacy web are relationship displays;
- a Chronicle is a composed spatial-temporal view.

KnowThing can support those data shapes without turning itself into a virtual tabletop, social network, or novel-writing SaaS.

## Deployment, Ownership, Export, and Extensibility

| Capability | World Anvil | KnowThing | Assessment |
|---|---|---|---|
| Hosting | Managed SaaS | Docker/Node/PostgreSQL self-hosting | Different responsibility models |
| Local/offline-capable operation | Not offered as self-hosted software | Can run on a local machine or private network | KnowThing advantage for sovereignty |
| Database access | No direct database ownership | Operator owns PostgreSQL | KnowThing advantage |
| Source modification | Closed service | Repository source is available to operator | KnowThing advantage |
| Custom domain/white label | Sage tier | Controlled by deployment and theming | KnowThing advantage for capable operators |
| API | Guild tokens; developer API documented, with some older endpoint docs | Application-owned JSON endpoints; no stable public API contract | World Anvil has the clearer external integration product |
| World export | Guild ZIP with JSON metadata/content and basic HTML; printable basic export | Admin JSON export of wiki pages only | World Anvil's product export is more complete today |
| Import | No general automated world importer; API possible | No general whole-world importer | Both weak |
| Media/structured-data export | Included to an unspecified degree in World Anvil's structured world archive | Not included in KnowThing's current export | KnowThing gap |

“Self-hosted” is not synonymous with “portable.” KnowThing owns its storage, but a user-facing backup and export story must cover structured entities, relationships, revisions, media, bindings, settings, and schema versions. The current wiki-page JSON export is not sufficient.

World Anvil's current annual-billing headline prices are USD 4.50/month for Master, USD 8.25/month for Grandmaster, and USD 25/month for Sage, excluding VAT. Feature and storage limits change by tier. The pricing page was internally inconsistent about Sage storage on the research date—its tier summary said 15 GB while its detail table said 10 GB—so this audit does not use a single Sage storage figure as fact.

## Consolidated Capability Matrix

| Domain | World Anvil position | KnowThing position | Current lead |
|---|---|---|---|
| General article authoring | Mature visual and advanced editors, broad prompts | Strong source editor and wiki renderer | Split: World Anvil accessibility; KnowThing wiki semantics |
| Structured composition | Mature feature-specific fields and embeds | Deep typed domains; generic facets planned | World Anvil breadth now; KnowThing architectural opportunity |
| Revision history | No article revision history | Article and lexicon history/restore | KnowThing |
| Linguistics | Language article and dictionary | Computational Wordbook and phonology | KnowThing |
| General maps | Full interactive image-map product | Early SVG region system | World Anvil |
| Calendar rules | Useful configurable calendar | Deeper reckoning engine | KnowThing |
| Events and timelines | Mature timelines and Chronicles | Not present | World Anvil |
| Celestial modeling | General articles/maps | Specialized hierarchy, mechanics, surfaces, systems, sectors | KnowThing |
| People/factions/relations | First-class relations and graph displays | Mostly infobox presentation | World Anvil |
| Media | Creator library, credits, galleries, privacy, bulk tools | Processing, deduplication, versions, usage | Split |
| Search | Mature entity navigation | Full-text and lexical depth | Split |
| Collaboration/access | Co-author and subscriber systems | Coarse author roles | World Anvil |
| Publishing/community | Hosted reader and community ecosystem | Minimal | World Anvil |
| RPG and manuscripts | Extensive | Not present | World Anvil; out of KnowThing's core scope |
| Ownership/extensibility | Hosted API/export | Self-hosted database and source | KnowThing for operators |
| Complete portable export | Structured Guild export | Wiki pages only | World Anvil today |

## What KnowThing Should Learn from World Anvil

### 1. Authoring convenience is part of the data model

World Anvil's quick creation, prompts, relationship pickers, embedding commands, and omnipresent search make structured connections cheap to create. KnowThing's future facets will fail if authors must understand the schema before writing anything.

Specialized forms, hierarchy editors, map placement, timeline manipulation, and WikiText should be peer authoring surfaces over the same mutation contracts.

### 2. Fields become valuable when they compose into several displays

World Anvil gets leverage from entering a relationship once and displaying it as a panel or graph. KnowThing should go further: one relationship should be eligible for a tree, graph, breadcrumb, map, timeline, infobox, query, or prose transclusion without being copied into each subsystem.

### 3. Reader state must be first-class

Public, private, draft, group-visible, and secret content cannot be bolted onto saved views later. Permission-aware transclusion, search, backlinks, queries, maps, and generated skies need a shared policy boundary.

### 4. History is a cross-domain primitive

Events, temporal intervals, participants, locations, sources, and calendar expressions should be first-class. This unlocks far more than a timeline page: historical maps, biographies, dynasties, institutional changes, migrations, system discoveries, wars, route openings, and calendar reforms.

### 5. Embeds need a stable saved-view contract

World Anvil proves that authors will embed maps, calendars, trees, and timelines in articles. KnowThing's stronger version should save the exact focus, camera, time, filters, layers, labels, and interaction policy, allow live or revision-pinned resolution, and render a usable static fallback.

### 6. Deep tools still need shallow entry paths

A user should be able to create a language with three words, a calendar with twelve months, or a sector with two systems before encountering advanced phonology, lunisolar rules, uncertainty, or reference-frame provenance.

### 7. Ownership needs productized backup

Database access is excellent disaster recovery for an operator, not an acceptable export workflow for an author. KnowThing needs full, versioned, test-restorable exports that include media and every structured domain.

## What KnowThing Should Not Copy

- Do not create dozens of permanent top-level object types merely to match World Anvil's template picker.
- Do not make presentation templates the authority for field schemas or relationships.
- Do not build an RPG campaign suite, social network, or manuscript editor to claim feature parity.
- Do not equate a generic JSON property bag with composable facets.
- Do not duplicate map, timeline, calendar, and celestial events in separate module-owned stores.
- Do not hide core portability, privacy, or data integrity behind deployment assumptions.

## Strategic Priority Suggested by the Comparison

This is comparative guidance, not a delivery plan.

1. **Finish the encyclopedia substrate:** stable object identity, complete revisions, draft/publication state, permission-aware rendering, and whole-world export.
2. **Prove the facet/display architecture with one cross-domain slice:** a general event or relationship that appears in an article, infobox, query/list, and spatial or temporal display.
3. **Make celestial continuity real:** generated distant-star/apparent-sky rendering from sector data, then serializable and embeddable view state.
4. **Generalize Atlas authoring:** markers, geometries, routes, layers, time validity, and display profiles backed by shared spatial facets.
5. **Preserve KnowThing's depth advantage:** keep investing in linguistics, calendar rules, celestial provenance, derived values, and integrity rather than broad collections of prose prompts.
6. **Add imports and low-friction creation:** deep systems need practical on-ramps and bulk workflows.

## Bottom Line

World Anvil is currently the better complete worldbuilding product. It is far ahead in general authoring breadth, maps, timelines, relationships, publishing controls, collaboration, creator workflows, RPG support, fiction writing, and community.

KnowThing is already stronger in a smaller set of technically meaningful areas: MediaWiki-like knowledge composition, revisioned wiki maintenance, computational linguistics, calendar reckoning, celestial mechanics and visualization, and operator ownership.

The defensible vision is therefore not “World Anvil, but self-hosted” and not “World Anvil is shallow.” It is:

> **A revisioned, self-owned encyclopedia where typed facts and relationships can become any appropriate display—prose, infobox, table, tree, timeline, map, system view, or cited saved scene—without being trapped in the module that first authored them.**

World Anvil already validates the demand for fields becoming displays. KnowThing must validate that a more general, cross-domain, WikiText-native version can remain understandable, authorable, permission-safe, and recoverable.

## World Anvil Primary Sources

Sources were accessed on 18 August 2026.

- [Guild membership pricing and tier matrix](https://www.worldanvil.com/pricing)
- [Feature Guide to Articles](https://www.worldanvil.com/learn/article-guides/articles)
- [How to Use Article Templates](https://www.worldanvil.com/learn/article-guides/article-templates)
- [Guide to Custom Article Templates](https://www.worldanvil.com/learn/article-guides/custom-templates)
- [Guide to the Language Template](https://www.worldanvil.com/learn/article-templates/language)
- [Feature Guide to Maps](https://www.worldanvil.com/learn/map-making/maps)
- [Feature Guide to Calendars](https://www.worldanvil.com/learn/calendars/calendars)
- [Feature Guide to Timelines](https://www.worldanvil.com/learn/timelines/timelines)
- [Feature Guide to Chronicles](https://www.worldanvil.com/learn/chronicles/chronicles)
- [Feature Guide to Family Trees](https://www.worldanvil.com/learn/family-trees/family-trees-guide)
- [Feature Guide to Diplomacy Webs](https://www.worldanvil.com/learn/diplomacy-webs/diplomacy-webs)
- [Feature Guide to Content Trees](https://www.worldanvil.com/learn/content-trees/content-trees)
- [Feature Guide to Images](https://www.worldanvil.com/learn/images/images)
- [Feature Guide to Search](https://www.worldanvil.com/learn/interface/search-world)
- [Feature Guide to Co-Authors](https://www.worldanvil.com/learn/access-rights/co-authors)
- [Feature Guide to Subscribers](https://www.worldanvil.com/learn/access-rights/subscribers)
- [Feature Guide to the Campaign Manager](https://www.worldanvil.com/learn/rpg/campaign-manager)
- [Feature Guide to the Digital Storyteller Screen](https://www.worldanvil.com/learn/rpg/dsts)
- [Feature Guide to Manuscripts](https://www.worldanvil.com/learn/manuscripts-guides/manuscripts)
- [How to Export Your World](https://www.worldanvil.com/learn/world/export)
- [World Anvil API documentation](https://www.worldanvil.com/api/aragorn/documentation)
- [Official response declining local article revision history](https://www.worldanvil.com/community/voting/suggestion/0e20984a-f1c6-4a98-8e41-6dccbcbb6238/view)

## Review Triggers

Re-run this audit when any of the following happens:

- KnowThing implements generic objects/facets, saved views, general relationships, events/timelines, publication controls, or complete export;
- World Anvil materially changes its article template model, revision history, calendar/timeline integration, map system, tiers, or export;
- KnowThing is evaluated as an end-user hosted service rather than a self-hosted repository;
- twelve months have passed since the research date.

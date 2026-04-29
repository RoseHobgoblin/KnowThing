# KnowThing vs WorldAnvil: Complete Domain Comparison

> WorldAnvil data sourced from their feature pages, codex, pricing tiers, and user reviews — not marketing copy.

---

## WIKI / ARTICLES

| | WorldAnvil | KnowThing |
|---|---|---|
| Article system | 26 typed templates (Character, Settlement, Species, etc.) with dedicated fields per type | Single wikitext format, any structure via markup. 12 infobox types auto-detected |
| Markup | BBCode (legacy) + new visual editor (buggy, breaks formatting) | MediaWiki-style wikitext with 35+ node types, parser functions, magic words |
| Templates | Twig-based (Grandmaster+ to create custom) | Built-in + DB-stored templates with `{{{param}}}` substitution, recursive expansion |
| Revision history | Yes | Yes, with diffs and edit summaries |
| Categories | Yes | Yes, `[[Category:Name]]` syntax |
| Internal links | Yes (article mentions) | Yes, `[[Page\|Display]]` + backlink tracking |
| Infoboxes | Per-template-type structured fields | 12 types: country, former_country, language, settlement, royalty, officeholder, person, religion, system, star, planet, generic |
| Custom article types | Grandmaster+ (HTML/CSS/Twig) | Not needed — wikitext is freeform |
| Structured data | Each template type is a silo — cross-referencing between types is manual | Every domain entity has a `pageSlug` — structured data and wiki prose coexist on one page |
| **Edge** | **WA for beginners (forms)** | **KT for power users — markup flexibility + unified data model** |

---

## LANGUAGE / LINGUISTICS

| | WorldAnvil | KnowThing |
|---|---|---|
| Language articles | Template with text fields for phonology, morphology, syntax | Full structured data system |
| Dictionary | Interactive word list, CSV import, VulgarLang integration | Full lexicon CRUD with pronunciation, etymology, tags, homographs |
| Definitions | Single definition per word | Multiple definitions per entry with sense numbering, POS, usage examples, dialect targeting |
| Phoneme inventory | Text field (type it yourself) | Built: phoneme + grapheme tables with grapheme→phoneme mapping, IPA, place/manner/voicing for consonants, height/backness/rounded for vowels, PhonemeEditor UI |
| Inflection/declension | Not supported — type tables manually | **Full system**: dimensions, paradigm classes, rules, stem patterns, auto-generated forms, overrides |
| Dialects | Not supported | Per-language dialects with region, lexicon variants, dialect-specific definitions |
| Etymology | Text field | Structured relations: derived_from, loan_from, compound_of between entries |
| Language families | Text field | Parent-child tree with visual LanguageTree component, proto/language/historical types |
| Script/writing system | Text field | CarveCraft planned (custom glyphs, PUA assignment, font generation) — not built yet |
| Word search | Basic dictionary search | Multi-strategy: exact > form > prefix > fuzzy > FTS, with filters |
| **Edge** | **KT wins clearly** | **Inflections, etymology, dialects, families, homographs — all built. WA's only edge is VulgarLang integration** |

---

## MAPS

| | WorldAnvil | KnowThing |
|---|---|---|
| Map type | 2D image with pin overlays (Leaflet-style) | Built: SVG worldmap with region overlays, zoom/pan, click navigation. 3D globe still planned |
| Pins/markers | 36+ icon sets, custom icons (Grandmaster+), draggable pins | Not built. Region-based, not pin-based |
| Labels | Text markers in multiple styles (Master+) | Built: per-region labels |
| Lines/journeys | Road/river/journey tracking with styling (Master+) | Not built |
| Layers | Multiple image layers with transparency (Master+) | Partial: transparency modes on regions. Multi-layer images not built |
| Map-to-map drill | Galaxy > planet > continent > city > room | Click-through to region's linked page; no nested map drill |
| Data-driven recoloring | No — pins only, no region coloring | Built: hex-color regions per map. Dynamic recoloring from structured data still planned |
| Historical timeline | No | Map has `timePeriod` + `event` fields; time slider not built |
| **Edge** | **WA wins on breadth (pins, journeys, multi-layer). KT has the data-driven region foundation WA can't match, but only the foundation** |

---

## CALENDAR

| | WorldAnvil | KnowThing |
|---|---|---|
| Custom months | Yes | Yes, with intercalary months |
| Custom weekdays | Yes | Yes, with abbreviations |
| Moons/celestials | Yes, with cycle length | Yes, with cycle + offset + phase colors for visualization |
| Leap days | Via events (workaround) | First-class: interval, ignore/exclusive divisors, intercalary support |
| Eras | Not clear | Yes: named eras with format strings, start/end years, reverse numbering |
| Seasons | Not clear | Yes: with timing, color, weather data |
| Date math | Limited | Full arithmetic: add days/months/years, leap-aware, era-resolved |
| Wiki integration | Limited | Magic words: `{{CURRENTYEAR}}`, `{{CURRENTSEASON}}`, `{{CURRENTFULLDISPLAY}}`, etc. |
| Calendar development | On hold (per WA team) | Active |
| **Edge** | **KT wins — deeper system, active development, WA's is stalled** |

---

## CELESTIAL / ASTRONOMY

| | WorldAnvil | KnowThing |
|---|---|---|
| Star systems | No structured support — use generic article | Full domain: single/binary/trinary systems with typed hierarchy |
| Stars | Text fields in a generic template | Structured data: spectral type, mass, radius, luminosity, temperature, age, color |
| Orbital mechanics | None | Semi-major axis, eccentricity, periastron/apastron, orbital period — computed from real values |
| Planets/moons | Text fields | Full schema: body type, density, surface gravity, escape velocity, atmosphere, composition, axial tilt, albedo |
| Companion stars | Not supported | Parent-child star relationships with orbital parameters |
| Moon nesting | Not supported | Recursive parent hierarchy with circular reference prevention |
| System visualization | None | Interactive SVG system map: elliptical orbits, eccentricity modeling, hover tooltips, clickable navigation |
| Sidebar navigation | None | Hierarchical tree: system > stars > planets > moons with body type icons |
| Wiki integration | Separate article, no data link | `pageSlug` on every entity — structured infobox + freeform prose on one page, edit mode with live preview |
| **Edge** | **KT wins completely — WA has nothing in this domain** |

---

## TIMELINES / CHRONICLES

| | WorldAnvil | KnowThing |
|---|---|---|
| Timeline | Vertical timeline with significance levels, parallel events, timescale/list modes | Not built. Planned in Other-Ideas.md |
| Chronicles | Timeline + interactive map fusion, 4 parallel lanes, location-aware scrolling | Not planned |
| Historical events | Linked article type with dates | Not built |
| **Edge** | **WA wins — fully built, KT has nothing** |

---

## CHARACTERS / RELATIONSHIPS

| | WorldAnvil | KnowThing |
|---|---|---|
| Character template | Dedicated with portrait, biography, personality fields | Wiki article + person/royalty/officeholder infoboxes with structured fields |
| Family trees | Visual graph, auto-relationship detection (Master+). Limited to 4 generations | Not built |
| Diplomacy webs | Org-to-org visual relationship graph (Master+) | Not built |
| Knowledge graph | Not built (character-to-character webs requested, low priority) | Planned: typed relations between any pages (capital-of, spoken-in, ruled, etc.) |
| **Edge** | **WA wins on visualization (family trees, diplomacy webs). KT's knowledge graph vision is more general but unbuilt** |

---

## RPG / CAMPAIGN TOOLS

| | WorldAnvil | KnowThing |
|---|---|---|
| Campaign manager | Full: notes, plots, player management, session scheduling | None |
| DM screen | Digital Storyteller's Screen: live notes, NPC creation, dice, statblocks, music | None |
| Statblocks | 100+ RPG systems (D&D, PF, CoC, VtM, GURPS, FATE...) | None |
| Character sheets | Interactive, per-system, player-managed | None |
| Dice roller | System-agnostic, embeddable `[roll:1d10+3]` | None |
| Session reports | Dedicated template | None |
| Player visibility | Show/hide content in real-time during sessions | None |
| Foundry VTT | Official sync module | None |
| **Edge** | **WA wins completely — KT has zero RPG features and shouldn't try** |

---

## NOVEL WRITING

| | WorldAnvil | KnowThing |
|---|---|---|
| Manuscripts | Scenes, chapters, drag-and-drop, focus mode, split-screen with worldbuilding, word count goals (Master+) | None |
| **Edge** | **WA wins — KT has nothing here** |

---

## MEDIA MANAGEMENT

| | WorldAnvil | KnowThing |
|---|---|---|
| Image upload | Yes, with credit tracking, galleries, folder organization | Yes, with auto-thumbnails (150/300/600px), categories, usage tracking |
| Image processing | Basic | Sharp.js: dimensions, mime detection, hash dedup |
| Usage tracking | Not clear | Yes — which pages use which images, "unused" filter |
| History | Not clear | Full action log: upload, reupload, delete, describe |
| Storage limits | 100MB (free) to 10GB (Sage) | Self-hosted — unlimited |
| **Edge** | **KT wins — auto-thumbnails, usage tracking, no storage limits** |

---

## COLLABORATION

| | WorldAnvil | KnowThing |
|---|---|---|
| Roles | Co-owner, Editor, Writer with different permissions | Admin, Editor (2 roles) |
| Co-author limits | 2-20 depending on tier | Unlimited (self-hosted) |
| Subscriber groups | Per-group content visibility (Master+) | None |
| Secret content | Per-group secrets within articles | None |
| Private worlds | Master+ | Self-hosted — inherently private |
| Live collab editing | No | Planned (Yjs/CRDT) — not built |
| **Edge** | **WA wins on granularity (secrets, groups). KT wins on no paywalling** |

---

## COMMUNITY / SOCIAL

| | WorldAnvil | KnowThing |
|---|---|---|
| Follows/likes | Yes | None |
| Comments | Yes (toggleable) | None |
| Community challenges | WorldEmber, Summer Camp, Flash Challenges with prizes | None |
| Badges/achievements | Yes | None |
| World discovery | Browse others' worlds | None |
| Discussion boards | Per-world forums | None |
| **Edge** | **WA wins completely — network effect moat** |

---

## SEARCH

| | WorldAnvil | KnowThing |
|---|---|---|
| Article search | Yes | PostgreSQL FTS with ts_rank, ts_headline, snippet highlighting |
| Wordbook search | Dictionary search | Multi-strategy ranking with filters (language, tag, letter, POS) |
| Structured queries | No | Planned: `{{#query: type=country \| population > 1000000}}` — not built |
| **Edge** | **KT wins slightly — FTS is more sophisticated** |

---

## AUTH & ACCESS

| | WorldAnvil | KnowThing |
|---|---|---|
| Auth | Email/password, social login | Username/password, bcrypt, session-based |
| Tiers/paywalling | 4 tiers, aggressive feature gating | None — all features available |
| Rate limiting | Not clear | In-memory rate limiter on requests |
| **Edge** | **Different models — SaaS vs self-hosted** |

---

## DEPLOYMENT

| | WorldAnvil | KnowThing |
|---|---|---|
| Hosting | SaaS only | Self-hosted via Docker (Caddy reverse proxy) |
| Offline | No | Run locally if desired |
| Custom domain | Sage tier (~$175/6mo) | Free (your server) |
| White-label | Sage tier | Default — no branding to remove |
| Data ownership | Locked in (limited export) | Full — PostgreSQL you own |
| **Edge** | **KT wins for power users who want control** |

---

## MISC TOOLS

| | WorldAnvil | KnowThing |
|---|---|---|
| Whiteboards | Freeform canvas with mind mapping (Grandmaster+) | None |
| Content trees | Custom tree structures (Grandmaster+) | None |
| Random generators | NPC/town/encounter generators, rollable tables | None |
| Notebooks | Mobile-friendly quick capture | None |
| World meta prompts | Creativity questionnaire for genre/themes | None |
| CSS customization | Tier-gated with restrictions | Full control (self-hosted) |
| Export | ZIP archive, CSV | JSON export of all wiki pages (slug, title, content) — admin-only. No media or structured data export yet |

---

## SCORECARD

| Domain | WA | KT | Notes |
|---|---|---|---|
| Wiki/Articles | ★★★★ | ★★★★★ | 12 infobox types, recursive templates, unified data model |
| Linguistics | ★★ | ★★★★★ | Inflections, etymology, dialects, families, homographs — all built |
| Celestial/Astronomy | ☆ | ★★★★ | Interactive system maps, orbital mechanics, spectral classification — WA has nothing |
| Maps | ★★★★ | ★★ | KT has SVG region maps; no pins, journeys, or 3D globe yet |
| Calendar | ★★★ | ★★★★★ | KT is deeper, WA's is stalled |
| Timelines | ★★★★ | ☆ | KT has nothing built |
| Characters/Relations | ★★★ | ★★ | KT has person/royalty/officeholder infoboxes, knowledge graph planned |
| RPG Tools | ★★★★★ | ☆ | Not KT's fight |
| Novel Writing | ★★★ | ☆ | Not KT's fight |
| Media | ★★★ | ★★★★ | KT's processing pipeline is better |
| Collaboration | ★★★★ | ★★ | WA has secrets/groups, KT has simplicity |
| Community/Social | ★★★★★ | ☆ | Network effect — don't compete here |
| Search | ★★★ | ★★★★ | KT's FTS is more robust |
| Deployment/Ownership | ★★ | ★★★★★ | Self-hosted is a real differentiator |

---

## STRATEGIC TAKEAWAY

**WorldAnvil is wide. KnowThing is deep where it matters.**

WA needs three features across three siloed templates to do what KT does on one page. KT's architecture is **data-first with wiki as the universal glue** — every domain entity has a `pageSlug`, so structured infoboxes and freeform prose coexist on a single page. WA can't retrofit this without rebuilding from scratch.

KT should not chase WA on RPG tools, novel writing, social features, or community. Those require network effects and years of accumulated users.

KT wins on:
1. **Unified data model** — one page per entity, structured data + wiki prose, not 26 siloed templates
2. **Linguistics depth** — inflections, etymology, dialects, families, homographs — all built and working
3. **Celestial mechanics** — interactive system maps, orbital parameters, spectral classification — a domain WA doesn't touch
4. **Calendar sophistication** — deeper system, WA's is stalled
5. **Data ownership** — self-hosted, no paywalls, no storage limits
6. **Performance** — SvelteKit SSR vs WA's notoriously slow pages

The path: ship CarveCraft (glyphs, font generation), build the knowledge graph, deepen maps (pins, time slider), then expand outward.

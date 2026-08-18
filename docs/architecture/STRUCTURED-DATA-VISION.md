# Structured Objects, Facets, and Displays

**Status:** Product architecture direction
**Decision date:** 18 August 2026
**Applies to:** all KnowThing domains, structured authoring, relationships, queries, and WikiText displays
**Related documents:** [Atlas Architecture](./Atlas-Architecture.md), [Celestial Views, Authoring, and Wiki Embeds](./celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md), [Celestial Sector and System Model](./celestial/Celestial-Sector-and-System-Model.md)

> **Maturity:** KnowThing currently implements several typed structured-data systems with their own tables and services. Wiki templates already render some of that data as page content. The generic object/facet model described here is future architecture. Current systems should evolve toward its contracts through adapters rather than being prematurely replaced by an unvalidated property bag.

## Thesis

KnowThing is intended to feel like MediaWiki from another century and another dimension: narrative pages remain central, but structured knowledge is not trapped in prose or template arguments.

Authors define facts, relationships, rules, and evidence once. KnowThing turns them into the display appropriate to the context:

- an infobox;
- a table or comparison;
- an article section;
- a relationship graph;
- a map or celestial view;
- a calendar or timeline;
- a search result or generated list;
- a specialized editor that writes the same underlying fields.

The long-term unit is one stable **object** with declared **facets**. Facets contribute typed fields, relationships, validation, and display capabilities. A page is one display of an object, not the object's entire meaning.

## Core Model

```text
object
  -> stable identity and revisions
  -> zero or more typed facets
       -> fields
       -> relationships
       -> validation
       -> display capabilities
  -> prose and media
  -> displays and saved views
```

### Object

An object is anything KnowThing can identify, revise, link, query, or display: a person, language, word, star, planet, calendar, event, polity, route, map layer, saved view, or something a setting invents later.

Object identity must remain stable when titles, slugs, relationships, or classifications change. Links and structured references resolve through identity, not copied names.

### Facet

A facet is a typed declaration that an object supports a coherent set of facts and behaviours. Examples might include:

- article content;
- celestial body;
- spatial position or geometry;
- orbit;
- language;
- organization;
- event or temporal interval;
- calendar rules;
- ordered network;
- population observation;
- saved view.

Facets are composable. A settlement can carry article, location, population, organization, and temporal facets. A station may carry artificial-structure, orbit, population, polity, and article facets. The system should not need a bespoke top-level application type for every useful combination.

A facet is not arbitrary JSON. It has a schema version, field semantics, validation, query/index needs, and migration rules.

### Field

A field records an authored, imported, derived, overridden, or illustrative value with declared semantics. Its unit, uncertainty, provenance, validity interval, and derivation state matter where applicable.

Unknown is a valid state. Missing, not applicable, not yet authored, invalid, and deliberately withheld must not collapse into the same accidental `null` when the distinction matters.

### Relationship

Relationships are first-class typed records between stable objects. They may carry direction, roles, ordering, dates, confidence, provenance, and domain-specific qualifiers.

Examples include:

- orbits;
- contained by;
- member of;
- capital of;
- spoken in;
- descended from;
- participated in;
- claims;
- located at;
- connects to.

A relationship may render as a tree in one context and as a graph, breadcrumb, map layer, backlink, or table row in another. The presentation is not the canonical relationship.

### Display

A display consumes declared facet capabilities and produces a readable or interactive representation. Displays do not own duplicate domain truth.

Some displays are passive. Others are bidirectional authoring surfaces: dragging an object on a map can edit a position field; reordering a relationship list can edit an order field; manipulating a timeline can edit an interval. These interactions must use the same validation and mutation contracts as ordinary forms.

### View

A view records how one or more displays are composed: focus, camera, time, fields, filters, layers, selection, and interaction policy. Views may be saved, revised, linked, and transcluded into WikiText.

The detailed view contract for celestial and spatial displays is defined in [Celestial Views, Authoring, and Wiki Embeds](./celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md) and should generalize beyond that domain.

## Fields Become Displays

The normal flow is:

```text
author or import
  -> validate typed fields and relationships
  -> store canonical assertions and provenance
  -> project capabilities
  -> render the chosen display
```

Editing a fact updates every display that derives from it. A phoneme change can update an inventory, orthography table, infobox, comparison, and query result. A system-position change can update a sector map, an apparent sky, a distance table, and a cited saved view.

Displays may derive presentation values, but a renderer must not silently write them back as authored truth. Screen-space marker size, procedural terrain, inferred colour, layout coordinates, and automatic labels are presentation unless explicitly promoted through an author action with provenance.

## WikiText Is the Composition Language

Narrative pages remain a primary interface. WikiText should be able to cite structured objects and transclude displays without copying their values into markup.

The intended pattern includes:

```wikitext
{{infobox|from=Nacre}}
{{orthography|Oncheran}}
{{compare|Nacre,Serein|mass,radius,gravity}}
{{view:Orison Fold/Nacre overview}}
{{#query: facet=settlement | located-in=Onchera | sort=population desc}}
```

Exact syntax is an implementation decision. The architectural requirements are:

- references use stable identity after resolution;
- structured data is loaded in batches during server rendering where practical;
- transclusions respect permissions and publication state;
- dependencies and backlinks are recorded;
- invalid optional displays fail locally instead of taking down the page;
- live and revision-pinned resolution are both possible;
- print and reduced-capability fallbacks remain readable.

Infoboxes are ordinary displays selected by available facets and page composition. They should not become a separate schema or a hand-maintained copy of object fields.

## Query and Computed Content

Objects and facets must be queryable across domains. Query results can power generated lists, comparison tables, dashboards, map layers, timelines, and computed article sections.

Queries need a permission-aware, bounded execution model. Arbitrary WikiText must not become unrestricted SQL. A query contract should declare:

- required facets or object kinds;
- field and relationship predicates;
- temporal and spatial scope;
- ordering and limits;
- selected display profile;
- live or revision-pinned resolution.

Computed content records its dependency set so affected pages and previews can be invalidated when source objects change.

## Cross-Domain Composition

Domains are useful authoring and validation packages, not permanent data silos.

| Object | Possible facets | Example displays |
|---|---|---|
| Language | language, phonology, orthography, lineage, article | inventory, family tree, lexicon, infobox |
| Celestial body | physical properties, orbit, spatial representation, surface, article | Orrery, sector map, fact sheet, apparent sky |
| Calendar | calendar rules, cultural ownership, reforms, article | calendar grid, date formatter, timeline axis |
| Event | interval, participants, locations, sources, article | timeline, map overlay, related-events section |
| Polity | organization, territory claims, population observations, article | infobox, historical map, graph, comparison |
| Route | ordered network, spatial references, traversal rules, validity | sector map, Atlas layer, itinerary, table |
| Saved view | view specification, permissions, preview, article | WikiText embed, infobox map, full viewer |

An event that involves a faction at a settlement on a planet should not be copied into separate calendar, faction, settlement, and celestial records. Those displays resolve the same event and its relationships.

## Current Systems and Migration Direction

KnowThing currently has purpose-built schemas for content, Wordbook, calendars, celestial bodies, sectors, media, and WorldMap data. These tables are real implementation, not a mistake to hide behind a generic abstraction.

The transition strategy is:

1. Define stable identity and capability contracts at application boundaries.
2. Expose current typed tables through projections or adapters.
3. Make new displays consume capabilities rather than table-specific payloads where practical.
4. Introduce generic object/facet persistence only after its validation, indexing, revision, and permission model is concrete.
5. Migrate one domain at a time with explicit compatibility and rollback paths.
6. Remove old tables and adapters only after identity, query, revision, and display parity is verified.

Do not build a second generic write model that merely mirrors every current table into JSON. The future model earns its place by enabling safe composition, not by erasing useful types.

## Authoring and Publication

The authoring experience should assemble an object from compatible facets and then offer the displays those facets enable.

Authors may work through:

- exact field forms;
- relationship, hierarchy, map, timeline, and other visual lenses;
- imports with explicit mappings and provenance;
- reusable facet bundles or templates;
- bulk operations with preview and rollback;
- draft previews before publication.

Draft objects may be incomplete. Publication requires the schemas and cross-object invariants needed by their selected displays. Permissions apply independently to objects, facets, source evidence, drafts, published revisions, and saved views where necessary.

## Integrity

Generic composition increases the importance of integrity. Enforce invariants at the lowest practical layer:

- foreign keys for object and relationship identity;
- schema-versioned facet validation;
- uniqueness and required-field constraints;
- relationship cardinality, role, and cycle rules;
- transactional multi-object mutations;
- optimistic concurrency or explicit revision checks;
- provenance and validity metadata where claims can conflict or change;
- publish-time validation for cross-facet rules that cannot be expressed locally;
- localized display failure for obsolete or malformed payloads.

The application must not infer canonical facts merely because a display requires a value. It may offer an explicit illustrative fallback, leave the value unavailable, or ask the author.

## Non-Goals

- replacing narrative prose with forms;
- forcing every object to have an article;
- defining one universal hierarchy for all relationships;
- flattening every domain into schema-free JSON;
- making one renderer serve every spatial or temporal scale;
- storing display layout as canonical domain data;
- inventing missing canon to make generated pages look complete;
- migrating all current systems before capability contracts prove useful.

## Acceptance Criteria

This direction is working when:

1. one authored fact updates every dependent display without copied markup;
2. objects can combine independently useful facets without bespoke top-level types;
3. relationships can render through multiple lenses without duplicate records;
4. current typed systems and future facet-backed objects can satisfy the same display contract;
5. WikiText can transclude permission-aware live or pinned structured views;
6. direct manipulation remains a validated field mutation;
7. unknown and invalid data remain distinguishable;
8. cross-domain queries and displays do not require domain-owned copies of objects;
9. obsolete facet or view payloads fail locally and can be migrated deliberately.

## Review Triggers

Review this document when:

- a generic object/facet schema is proposed;
- the first non-celestial saved view or bidirectional display is implemented;
- permissions or revisions move from content records to generic objects;
- structured WikiText queries enter implementation;
- a domain migration reveals that the capability boundary cannot preserve its semantics.

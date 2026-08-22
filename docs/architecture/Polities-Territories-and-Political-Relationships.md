# Polities, Territories, and Political Relationships

**Status:** Product architecture direction
**Decision date:** 21 August 2026
**Applies to:** countries, states, provinces, empires, political organizations, territorial authority, political hierarchies, and their displays
**Related documents:** [Structured Data Vision](./STRUCTURED-DATA-VISION.md), [Atlas Architecture](./Atlas-Architecture.md), [Celestial Views, Authoring, and Wiki Embeds](./celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md)

> **Maturity:** KnowThing currently has a WorldMap-owned countries table, country CRUD services, Country namespace resolution, map-region assignments, and a WikiText country infobox. Country detail pages are not yet wired up. The first proposed polity slice is limited to polity identity, polity-to-polity relationships, and temporal classifications. Territory, authority, organization, asset, network, and political-map contracts remain design intent and are not prerequisites for that slice. The existing country system should be exposed through a polity capability adapter before its persistence is generalized.

## Decision Summary

KnowThing will not distinguish countries, states, provinces, republics, federations, and empires with one permanent object-type enum or one political parent tree.

These words describe different dimensions:

- a **polity** can exercise or claim political authority and participate in political relationships;
- a **territory** is a spatial extent;
- a **jurisdiction** is an assertion that an actor has some kind of authority over a scope;
- an **administrative unit** occupies a role established by another polity;
- a **government form** describes how a polity is constituted or governed during an interval;
- a **designation** records the context-dependent label used for an object or relationship;
- constitutional, administrative, diplomatic, spatial, and territorial relationships remain distinct.

An object may support several of these capabilities at once. A constituent republic can be a polity, administer a territory, participate in a federation, and be described as a country by one source and as a province by another. Composition is the model; labels select authoring and display profiles rather than determining identity.

Territory is optional. A polity may govern one territory, several disconnected territories, a changing territory, or no territory at all. A fleet republic, government in exile, or other landless political community remains a polity because political agency—not land—is the defining capability.

## Why a Single Taxonomy Fails

Political labels are overloaded and change without the underlying subject necessarily becoming a different object.

- **Republic** normally describes a government or constitutional form. It does not say whether the polity is sovereign, federated, dependent, planetary, or interstellar.
- **Federation** describes a constitutional structure and a set of constituent relationships. A federation may itself be a sovereign polity or a constituent of a larger polity.
- **State** may mean a sovereign country, a federated member, an institutional apparatus, or a historical status.
- **Province**, **canton**, **oblast**, and similar labels usually describe an administrative role local to a particular constitutional system.
- **Country** is a useful reader-facing and authoring category, but it is not a reliable universal test for sovereignty or political capacity.
- **Empire** may describe a polity, a government style, or a network of unequal political relationships. Its territory may be discontinuous or span planets and star systems.

A record whose sole type is republic cannot answer whether that republic is an independent country, a member of a federation, a government-in-exile, or a former province. A single political parent cannot distinguish constitutional membership from occupation, vassalage, administration, alliance, or mere spatial containment.

## Conceptual Model

    stable object identity
      -> optional polity capability
      -> optional organization capability
      -> optional spatial region or territory capability
      -> time-varying classifications and designations
      -> typed relationships
           -> constitutional
           -> administrative
           -> diplomatic
           -> territorial authority
           -> spatial
           -> historical succession
      -> prose, media, sources, and displays

The same stable object may acquire or lose classifications and relationships without being deleted and recreated. Whether two concepts share one object or use related objects depends on whether their identities and lifecycles can diverge.

## Core Concepts

### Polity

A polity is a political actor or political community capable of exercising, delegating, contesting, or claiming public authority. Sovereignty is not required.

Polities may include:

- sovereign states and countries;
- federations and confederations;
- constituent republics, states, kingdoms, or cantons;
- dependencies, protectorates, vassals, and governments in exile;
- autonomous or self-governing subdivisions;
- empires whose members or holdings span several spatial contexts;
- historical polities that no longer exercise authority.

Polity identity persists through ordinary changes of ruler, constitution, government form, capital, borders, and international status. A monarchy becoming a republic is normally a change to the same polity, not automatic creation of a replacement object. Authors may record a successor relationship when canon treats the change as a genuine political discontinuity.

A polity does not require a territory row, geometry, map region, capital, population, or sovereign status. Those capabilities and relationships become available when the author has data for them.

### Government and Organization

A polity is not necessarily identical to the organization currently governing it. A cabinet, crown, council, colonial administration, ministry, or occupying authority may have its own organization identity, membership, offices, and lifecycle.

The two may remain one object for shallow authoring when no distinction is useful. They should become related objects when the government can be replaced, exiled, divided, or discussed independently of the polity. Displays may still present them together.

Organization and polity are independent capabilities. A trade league may be an organization whose members possess territories without the league possessing one. A fleet republic may be both an organization and a polity while possessing only vessels and other assets. KnowThing does not infer polity status from organizational size, influence, property, or military power.

### Territory and Region

A territory is a spatial object or region. Geometry does not itself imply ownership, sovereignty, recognition, population, or control.

A territory may be:

- administered by one polity;
- claimed by several polities;
- occupied or controlled by another actor;
- recognized by a source as belonging to a particular jurisdiction;
- located on a planet, across several bodies, or within a celestial sector;
- discontinuous, overlapping, disputed, or historically bounded.

Polities and territories therefore have a many-to-many relationship. A star empire may claim several planets and orbital habitats. Several polities may occupy one planet. One disputed region may have multiple simultaneous claim and control assertions.

An object may carry both polity and spatial capabilities when those identities genuinely coincide, but authority relationships must still be explicit. Displays must not infer political ownership from spatial containment.

### Jurisdiction and Territorial Authority

Jurisdiction is a typed assertion from an actor to a scope. Its scope may be a territory, population, institution, activity, subject matter, or another object.

A jurisdiction or territorial-authority assertion may record:

- actor;
- target or scope;
- authority type;
- validity interval;
- whether authority is claimed, recognized, administered, or exercised de facto;
- source or asserting perspective;
- confidence or publication state where applicable;
- domain-specific qualifiers.

Claims, control, occupation, administration, and ownership are not aliases. They must not be collapsed into one belongs-to relationship.

### Administrative Unit

An administrative unit is defined by its role in another polity's organization of authority. The role is normally represented by an administrative relationship, not by a universal top-level kind.

For example, Northreach may be related to the Red Republic as an administrative subdivision, with the local designation province and an authored tier. Northreach may additionally carry a polity capability if it has political agency or constitutionally protected powers. A directly administered district may require only a territory or place capability plus the administrative relationship.

If Northreach later becomes independent, its identity can remain stable. The administrative relationship ends, new authority and recognition relationships begin, and its display profile changes. KnowThing does not convert a disposable province record into an unrelated country record.

### Classification

Classifications describe independent, time-varying axes.

| Axis | Example values | Notes |
|---|---|---|
| Government form | republic, monarchy, council | Does not imply sovereignty or hierarchy level |
| State structure | unitary, federation, confederation | Describes internal constitutional organization |
| Political status | independent, constituent, dependent, disputed | May require an asserting perspective rather than one universal truth |
| Administrative role | province, state, canton, district | Usually local to a parent relationship |
| Display profile | country, empire, province | Controls authoring defaults and presentation, not canonical identity |

These values require schema definitions and migration rules. They are not an unrestricted tag bag. A classification should carry a validity interval when it can change historically.

### Designation

A designation records what an object or relationship is called in a declared context. It may include:

- a label, such as country, state, province, or a setting-specific term;
- language or locale;
- source or asserting polity;
- validity interval;
- whether it is the preferred display label in a particular view.

Designations permit disagreement without duplicating identity. One polity may recognize an entity as an independent country while another describes it as a rebellious province. Those are sourced assertions about the same object, not necessarily two objects or one globally authoritative enum value.

## Relationship Semantics

Relationships are directed, typed, and independently revisionable. Political structure is a graph, not one universal tree.

Potential relationship families include:

| Family | Example relationships |
|---|---|
| Constitutional | constituent of, federated with, in personal union with, delegates authority to |
| Administrative | administrative subdivision of, administered by, capital of, seat of |
| Dependency | dependency of, protectorate of, vassal of, tributary of |
| Membership and diplomacy | member of, allied with, recognized by, guaranteed by |
| Territorial authority | claims, controls, occupies, administers, cedes to |
| Spatial | located in, contains region, located on, overlaps |
| Historical continuity | predecessor of, successor of, seceded from, merged into, annexed by |

The final vocabulary should remain curated. Similar-looking relationships must have documented direction, cardinality, cycle, symmetry, temporal, and validation rules. Setting-specific labels may specialize a declared semantic relationship without inventing an incompatible data shape.

No political relationship should be named only parent, child, part of, or belongs to. Those names are acceptable only inside a display projection after the display has selected a particular relationship family.

## Time, Perspective, and Conflicting Claims

Political facts are frequently historical or contested. Records that can change must support validity rather than overwriting the past.

At minimum, a relationship or classification may carry:

    valid from
    valid until
    asserted by
    provenance or source
    revision and publication state

Temporal values have two representations with different jobs. The authored calendar expression—the date as written, with the pinned calendar revision used to resolve it—is retained as the record of intent. A normalized world-epoch coordinate may additionally be derived for comparison, ordering, and cross-calendar display through the rimecraft calendar engine. Revising the current calendar definition does not silently change a coordinate resolved through an older pinned revision. Re-resolution requires an explicit correction, rebase, or migration. Approximate and partial dates are legal: normalization records their precision instead of inventing false exactness, and a setting epoch is required only when cross-calendar comparison is first needed.

The model distinguishes:

- a claim from effective control;
- control from lawful administration;
- administration from sovereignty;
- self-description from external recognition;
- current status from historical status;
- unknown status from an absent or invalid record.

Perspective is opt-in per fact, and perspective is not provenance. An absent asserted-by means the encyclopedia's canonical perspective — the default stance of an omniscient author. An absent source means the assertion is unsourced. Neither absence means unknown; unknown remains its own state. The asserted-by field earns its place the first time an author records a genuinely contested fact.

A display may choose an authored perspective, compare perspectives, or show contested status. It must not silently resolve a dispute merely because a map needs one colour.

## Worked Example

Consider a republic inside a federation that is treated as a country and belongs to a star empire:

    Asterion Empire                         polity
      Helian Federation                    polity; country display profile
        Red Republic                       polity; republican government form

    Red Republic
      constituent of -> Helian Federation

    Helian Federation
      state structure: federation
      member of / dependency of / vassal of -> Asterion Empire

The exact relationship between the federation and empire must be authored: membership, dependency, vassalage, and constitutional membership mean different things. The phrase \"belongs to an empire\" is insufficient canonical data.

This structure requires only polity identities, temporal classifications, and typed polity-to-polity relationships. It does not require territory, maps, populations, or a generic facet database.

Later capabilities may add Northreach as an administrative unit, connect the polities to territories, record claims or control over Planet Orra, and show different political map modes. Those additions consume the same polity identities; they do not redefine the initial hierarchy.

A landless fleet republic also fits the initial model: it is a polity with classifications and political relationships but no territory. Its vessels, membership, routes, portals, and other assets belong to organization, asset, and network capabilities rather than being disguised as territory.

## Science-Fiction and Fantasy Scope Tests

The initial model should accommodate common speculative settings without adding one-off political types:

- A **fleet republic** is a polity without required territory. Its ships, inhabitants, and routes are future asset, population, organization, and network relationships.
- A **trade or city league** is an organization whose members may be polities. The league receives polity capability only if the author treats the league itself as a political actor.
- A **portal empire** controls portal objects and a network connecting them. Disconnected territorial holdings remain ordinary multiple territories; the portal network is not territory.
- A **sentient planet who is also a king** is two objects whose lifecycles diverge. Geridxxa is one object with celestial and person facets; the Kingdom of Geridxxa is a distinct polity he rules, related to him by an office relationship rather than a shared identity. The kingdom's eventual territory may span his own surface alongside his subjects' conquests: a territory's spatial anchor and the polity's monarch may be the same object, and no authority is inferred from that coincidence. The polity domain does not create a special sentient-world type.
- A **hive polity** initially needs no special schema. It is a polity or organization with whatever membership facts the future organization capability can support.
- A **splitting or merging artificial intelligence state** uses the same split, merge, predecessor, successor, and continuity relationships needed by ordinary historical polities.
- A **necromantic population** is still a population. Population values must not implicitly mean living biological humans; demographic categories are added only when a real authoring or query need exists.

Conditional nocturnal rule, prophetic legitimacy, belief-dependent borders, and similar setting-specific metaphysics remain prose until a real workflow requires structured validation, querying, or display. Their possibility does not justify fields in the first polity schema.

## Authoring and Displays

Authors should not need to understand the complete ontology before creating an object. Profiles provide shallow entry paths:

- **Country** may preselect a polity capability and offer common government, structure, symbol, and relationship displays. Capital and territorial displays appear only when compatible place and territory capabilities exist.
- **Federation** may additionally offer constituent-polity authoring.
- **Province** may start with a territory or place plus an administrative relationship.
- **Empire** may emphasize member, dependency, claim, and control relationships across spatial contexts.

Profiles are reusable authoring and display configurations. They are not permanent storage types and do not prevent later composition.

The first slice needs only Country, Federation, and Empire profiles over polity data. Province remains a future cross-capability profile because a directly administered province may be a place or territory without being a polity.

The same underlying records may render as:

- a country or polity infobox;
- a constitutional hierarchy;
- a relationship graph;
- a current or historical map;
- a list of constituent polities;
- a territorial-claims comparison;
- a succession timeline;
- an article section or WikiText query.

A hierarchy display must declare which relationships it is projecting. A constitutional tree, administrative tree, territorial-control layer, and spatial containment tree are different views of the graph.

## Current-System Migration Direction

The existing country implementation is useful typed data and must not be mirrored into a second generic write model.

The transition should be:

1. Define a presentation-neutral polity document or capability contract.
2. Project existing country identity, prose, media, and profile-compatible fields through that contract. Keep map-region assignments behind the existing WorldMap boundary.
3. Wire Country pages and the country infobox to the same projection.
4. Treat **Country** as the first authoring and display profile rather than the canonical object kind.
5. Add typed polity-to-polity relationships and temporal classifications within the polity domain.
6. Keep existing WorldMap country assignments as legacy cartographic data; do not promote them into canonical ownership assertions.
7. Add territory, organization, asset, network, and other cross-domain relationships only when their capability and identity contracts exist.
8. Migrate persistence deliberately when generic objects and facets can preserve identity, revisions, permissions, validation, and map integration.

Until that transition, do not broaden the existing extra property bag into the future polity schema. Leaders, languages, predecessors, memberships, populations, claims, and territorial history should remain prose or existing WikiText fields rather than becoming comma-separated or unvalidated JSON copies of future relationships.

The conceptual polities table may be realized by generalizing the existing countries table or by transactionally migrating it. KnowThing must not keep independently mutable country and polity rows for the same subject.

## Minimal Implementation Model

The preceding sections describe the end state. The first persistence slice is deliberately smaller: three tables forming one polity graph and a classification timeline.

    polities                identity, name, slug, display profile, prose
    polity_relationships    from polity -> to polity, relationship kind, local designation, validity interval
    polity_classifications  polity, axis (government form | structure), value, validity interval

Rules that keep the slice honest:

- **Polities are one flat table.** Anything with political agency — empire, federation, republic, autonomous province — is a polity row. There is no kind column and no parent column. Structure lives entirely in edges.
- **A relationship-relative designation lives on the relationship.** The Red Republic's constitutional relationship to the Helian Federation may call it a *constituent republic*. Objects keep their own names and self-designations; relationships carry labels that are meaningful only within that connection.
- **Government form and structure live in the classification table from day one.** A polity with no authored history has a single open-ended interval row, so shallow authoring still looks like a dropdown. A monarchy becoming a republic closes one interval and opens another; no schema migration is required for the most predictable historical event in the domain.
- **Relationship kinds are a small curated enum.** Constitutional, dependency, diplomatic, and succession relationships share one polity-relationship table distinguished by kind (constituent of, member of, vassal of, allied with, successor of, split from, merged from).
- **Country is never stored as a canonical kind.** It may be stored as an authored display profile — presentation configuration carrying no political semantics — or answered by a query over edges. Canon is authored, not derived.
- **Territory is not required.** No polity row requires geometry, a map region, or an authority edge. Landless and mobile polities use the same model as territorial polities.
- **Assets and networks are not territories.** Vessels, stations, portals, routes, and similar resources remain separate objects or future capabilities. Owning a portal network does not require inventing territorial geometry around it.
- **Organizations are not inferred to be polities.** A league, guild, company, church, or government organization receives polity capability only when the author intends to represent it as a political actor. Organization membership and assets are deferred rather than copied into polity fields.

In the worked example above, the federation–empire question is forced at authoring time: the author must choose the relationship kind because "belongs to an empire" is a prompt for a fact, not a fact. Northreach is deferred unless it has enough political agency to be authored as a polity; an ordinary directly administered province belongs to the later place, territory, and administrative-relationship model.

### Deferred Features

Each deferral names its upgrade trigger. Deferral is sequencing, not rejection.

| Deferred | Interim answer | Build when |
|---|---|---|
| Territories, territorial authority, claims, and political map modes | Existing WorldMap assignments remain cartographic data; political facts remain prose | Atlas and generic spatial capabilities have stable identity and temporal contracts |
| Organizations, membership, offices, and governments | Prose or an independent organization feature | The organization facet or a concrete cross-domain workflow enters implementation |
| Assets and networks, including fleets, stations, portals, and routes | Existing celestial or future network records; polity connection remains prose | Stable asset and network capabilities can expose cross-domain relationships |
| Population observations and demographic categories | Prose and existing infobox presentation | A queryable population-observation capability is designed |
| Perspective and recognition (asserted by, recognized-by edges) | Omniscient canon: one unsourced assertion per fact | The first contested recognition or other perspective-dependent political fact is authored |
| Perspective-dependent classification axes (political status) | Government form and structure via the classification table; status read from edges | The first status assertion that needs an asserting perspective |
| Generic object/facet persistence | These three purpose-built tables exposed through a polity capability | The facet model's identity, revision, and permission contracts are concrete |

Deferral is a boundary, not permission to add comma-separated or unvalidated substitutes to polity records. A fleet republic needs no special field in the first slice: it is simply a polity without territory. Its fleet, members, and routes become related capabilities later.

## Integrity Rules

The eventual implementation must enforce:

- stable identity across classification and relationship changes;
- explicit relationship direction and allowed endpoint capabilities;
- validity interval ordering and non-overlap rules where semantics require them;
- cycle prevention for relationship types that must be acyclic;
- symmetry for relationships declared symmetric;
- complete, reference-system-aware spatial geometry;
- no inference of authority from spatial containment;
- no inference of recognition from control or administration;
- transactional structural mutations;
- revision and publication checks for cross-object changes;
- provenance for contested or externally sourced assertions;
- localized display failure for obsolete or invalid records.

Unknown, unrecognized, disputed, defunct, and not yet authored are distinct states. The model must not collapse them into one nullable status field.

## Non-Goals

- defining one objective worldwide hierarchy of political units;
- treating sovereignty as a boolean;
- requiring every province or territory to be a polity;
- requiring every polity to control or claim a mappable territory;
- treating territory, map regions, population, organizations, assets, or networks as prerequisites for polity authoring;
- implementing political map modes or a territorial-authority graph in the first polity slice;
- forcing governments, polities, populations, and territories to share one identity;
- encoding every historical or legal nuance before shallow country authoring works;
- inferring canonical ownership from a map colour or containment tree;
- replacing the future facet model with a polity-specific generic property bag;
- making the Country infobox the authority for political data.

## Acceptance Criteria

### First polity slice

The first slice is complete when:

1. a polity can be created, revised, linked, and displayed without territory or map data;
2. Country, Federation, and Empire profiles provide shallow authoring without becoming canonical kinds;
3. a constituent republic can be related to a federation that is related to a larger empire without ambiguous parent links;
4. government form and state structure can change over authored time without replacing polity identity;
5. predecessor, successor, split, and merge relationships preserve explicit political continuity;
6. the country infobox and Country page consume the same presentation-neutral polity projection;
7. existing country records are adapted or migrated without a second competing write model;
8. no initial polity field stores copied territory, organization, asset, network, population, or map truth.

### End-state direction

The broader direction is working when:

1. a constituent republic can exist inside a federation that participates in a larger empire without ambiguous parent links;
2. one polity may administer, claim, or control several territories and one territory may have several simultaneous assertions;
3. a province may become independent without losing its stable identity or historical relationships;
4. government form, constitutional structure, political status, and display designation can change independently over time;
5. disputed recognition can be represented without duplicating the disputed object;
6. political, administrative, territorial, and spatial displays can project different relationships from the same records;
7. existing countries and future facet-backed polities can satisfy the same display capability contract;
8. WorldMap can display political data without owning the canonical polity model;
9. invalid optional political displays fail locally without breaking the surrounding article.

## Review Triggers

Review this document when:

- the first Country detail or authoring page is implemented;
- a generic object, facet, relationship, or designation schema is proposed;
- WorldMap country ownership is moved or adapted behind a public capability;
- the first territorial claim, administrative hierarchy, or historical political map enters implementation;
- an authored setting cannot express its political structure using these distinctions;
- a deferred feature's build trigger in the Minimal Implementation Model fires;
- permissions, revisions, or publication rules are added to cross-object political assertions.

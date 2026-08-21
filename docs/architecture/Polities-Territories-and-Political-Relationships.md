# Polities, Territories, and Political Relationships

**Status:** Product architecture direction
**Decision date:** 21 August 2026
**Applies to:** countries, states, provinces, empires, political organizations, territorial authority, political hierarchies, and their displays
**Related documents:** [Structured Data Vision](./STRUCTURED-DATA-VISION.md), [Atlas Architecture](./Atlas-Architecture.md), [Celestial Views, Authoring, and Wiki Embeds](./celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md)

> **Maturity:** KnowThing currently has a WorldMap-owned countries table, country CRUD services, Country namespace resolution, map-region assignments, and a WikiText country infobox. Country detail pages are not yet wired up, and the general polity, territorial-authority, designation, recognition, and temporal-relationship model described here is design intent. The existing country system should be exposed through a polity capability adapter before its persistence is generalized.

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

### Government and Organization

A polity is not necessarily identical to the organization currently governing it. A cabinet, crown, council, colonial administration, ministry, or occupying authority may have its own organization identity, membership, offices, and lifecycle.

The two may remain one object for shallow authoring when no distinction is useful. They should become related objects when the government can be replaced, exiled, divided, or discussed independently of the polity. Displays may still present them together.

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
    asserted by or source
    revision and publication state

The model distinguishes:

- a claim from effective control;
- control from lawful administration;
- administration from sovereignty;
- self-description from external recognition;
- current status from historical status;
- unknown status from an absent or invalid record.

A display may choose an authored perspective, compare perspectives, or show contested status. It must not silently resolve a dispute merely because a map needs one colour.

## Worked Example

Consider a republic inside a federation that is treated as a country and belongs to a star empire:

    Asterion Empire                         polity
      Helian Federation                    polity; country display profile
        Red Republic                       polity; republican government form
          Northreach                       administrative unit; territory

    Red Republic
      constituent of -> Helian Federation
      administers -> Red Republic Territory

    Helian Federation
      state structure: federation
      member of / subject to -> Asterion Empire
      administers -> Federation Territory

    Northreach
      administrative subdivision of -> Red Republic
        designation: province
      located on -> Planet Orra

    Asterion Empire
      claims -> Planet Orra
      controls -> Orra Orbital Corridor

The exact relationship between the federation and empire must be authored: membership, dependency, vassalage, and constitutional membership mean different things. The phrase \"belongs to an empire\" is insufficient canonical data.

The planet is spatially related to its system. It does not politically belong to the empire merely because the empire's hierarchy display contains it. Political authority is represented by claims, control, administration, recognition, and constitutional relationships.

## Authoring and Displays

Authors should not need to understand the complete ontology before creating an object. Profiles provide shallow entry paths:

- **Country** may preselect a polity capability and offer common government, capital, symbol, and territorial displays.
- **Federation** may additionally offer constituent-polity authoring.
- **Province** may start with a territory or place plus an administrative relationship.
- **Empire** may emphasize member, dependency, claim, and control relationships across spatial contexts.

Profiles are reusable authoring and display configurations. They are not permanent storage types and do not prevent later composition.

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
2. Project existing countries records, prose, map-region assignments, and media through that contract.
3. Wire Country pages and the country infobox to the same projection.
4. Treat **Country** as the first authoring and display profile rather than the canonical object kind.
5. Keep WorldMap as a consumer of polity and territorial capabilities; it should not permanently own political identity.
6. Add typed relationship and temporal contracts only when stable cross-domain object references are available.
7. Migrate persistence deliberately when generic objects and facets can preserve identity, revisions, permissions, validation, and map integration.

Until that transition, do not broaden the existing extra property bag into the future polity schema. Leaders, languages, predecessors, memberships, populations, claims, and territorial history should remain prose or existing WikiText fields rather than becoming comma-separated or unvalidated JSON copies of future relationships.

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
- forcing governments, polities, populations, and territories to share one identity;
- encoding every historical or legal nuance before shallow country authoring works;
- inferring canonical ownership from a map colour or containment tree;
- replacing the future facet model with a polity-specific generic property bag;
- making the Country infobox the authority for political data.

## Acceptance Criteria

This direction is working when:

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
- permissions, revisions, or publication rules are added to cross-object political assertions.

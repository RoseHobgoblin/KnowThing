# Calendar and Celestial Boundaries

**Status:** Architecture direction; replaces the pre-unified celestial integration proposal
**Decision date:** 18 August 2026
**Applies to:** calendar rules, optional celestial references, historical drift, and calendar/celestial displays
**Related documents:** [Structured Data Vision](../STRUCTURED-DATA-VISION.md), [Celestial Sector and System Model](./Celestial-Sector-and-System-Model.md), [Celestial Views, Authoring, and Wiki Embeds](./Celestial-Views-Authoring-and-Wiki-Embeds.md)

> **Maturity:** Calendars currently store validated rule data in `calendars.static_data` and may carry an optional `planet_id` reference to the unified `celestial_bodies` table. Calendar rendering, months, weekdays, eras, seasons, and configured moon displays exist. The richer relationship, reform, historical-state, and observer-sky capabilities described here remain design intent.

## Decision Summary

A calendar is a cultural and historical rule system. It is not a derived ephemeris and is not required to agree with celestial mechanics.

Celestial objects may provide context, observations, comparison values, or authored references. They do not silently rewrite the calendar. If a culture defines a 231-day year while its planet takes 231.4 local days to orbit, both facts remain true in their own domains.

KnowThing validates a calendar against the rules it declares. Physical consistency is required only for a field that explicitly claims to represent physical reality.

## Sources of Truth

The two domains answer different questions:

| Domain | Authoritative for | Not automatically authoritative for |
|---|---|---|
| Calendar | named units, month and week rules, eras, reforms, intercalation, cultural seasons, ceremonial cycles | orbital period, rotation, physical moon state |
| Celestial | authored physical properties, orbital state, rotation, spatial relationships, physical existence | cultural year length, legal date rules, religious cycles |

A display may compare the domains. Comparison does not merge them.

Examples of valid divergence include:

- a civil calendar with a rounded year;
- a religious cycle based on a moon that never physically existed;
- a calendar that preserves the cycle of a destroyed moon;
- an imperial standard inherited from another world;
- a pre-reform calendar known by its users to drift;
- a seasonal calendar whose named seasons are cultural rather than climatic;
- a calendar authored before its associated world has celestial data.

## Calendar Rule Contract

A calendar definition must be able to express its own mechanics without a celestial binding. Its schema may include:

- the duration of its basic day or another declared base unit;
- weekdays and week structure;
- fixed, variable, intercalary, or rule-computed months;
- leap and intercalation rules;
- eras and year-numbering direction;
- culturally defined seasons;
- displayed moon or ceremonial cycles;
- epoch and date-conversion rules;
- reforms or successor relationships where supported.

The rule payload is schema-versioned. Reads and writes validate against that version, and obsolete shapes require explicit migration. A malformed rule set must produce an actionable validation error rather than failing when a page renders.

The editor may offer common presets and derived suggestions, but every resulting rule is inspectable as calendar-owned data.

## Optional Celestial Relationships

The current `planet_id` field is an optional contextual link to a unified celestial object. Until a more precise relationship model exists, it must not be interpreted as permission to overwrite calendar rules from that body.

Future object/facet architecture should replace an overloaded binding with typed relationships such as:

- **used on:** the place or population for which the calendar is conventional;
- **historically based on:** the body or cycle that influenced its construction;
- **observes:** a moon, star, conjunction, or other phenomenon displayed by the calendar;
- **compared with:** the physical cycle used for a drift readout;
- **reformed from / succeeded by:** another calendar definition;
- **recognized by:** a culture, polity, institution, or religion.

One calendar may be used across many places. One place may use many calendars. The relationship is not naturally a single ownership foreign key.

## Referenced Cycles

A displayed moon or astronomical cycle must declare how it resolves:

- **Calendar-owned:** a symbolic or conventional cycle defined entirely by calendar rules.
- **Live reference:** resolves selected physical facts from a stable celestial object at the display's declared epoch.
- **Snapshot:** preserves explicitly copied values from a celestial object at a named historical or authoring moment.
- **Historical reference:** relates to a celestial object that existed or was believed to exist during a declared interval.

The UI must make the mode visible. A snapshot is not an accidental stale copy, and a calendar-owned symbolic moon is not a fake physical body.

Deleting, merging, or revising a referenced celestial object requires dependency review. The calendar may preserve a snapshot, select a replacement, retain an unresolved historical reference, or remove the display entry. It must not silently lose part of its rule system.

## Drift and Comparison

Drift is a derived display comparing two independently valid facts. For example:

```text
calendar year: 365 days
current physical orbit: 365.2422 local days
derived drift: calendar dates move relative to the orbit
```

The drift calculation must state:

- which calendar rule and revision it uses;
- which celestial object and physical value it uses;
- the relevant unit conversion;
- the epoch or validity interval;
- whether the celestial state is current, historical, approximate, or unavailable.

Drift never “fixes” the calendar. Reform is an authored cultural event represented by a new rule interval, revision, or successor calendar according to the eventual temporal model.

## Time and Historical State

Calendar time, narrative time, application viewer time, and physical ephemeris time must not be conflated.

A view that shows celestial state on a calendar date needs an explicit conversion pipeline:

```text
calendar date
  -> calendar revision and era rules
  -> absolute application time
  -> celestial state at that time
  -> display
```

If historical celestial state is unavailable, the display says so. It must not pretend current orbital values describe the past.

Calendar reforms need validity semantics beyond ordinary edit history. Editing a typo in a rule and recording an in-world legal reform are different operations. The future temporal facet must preserve that distinction.

## Seasons

Calendar seasons are authored cultural intervals. They may describe agriculture, ritual, administration, weather expectations, daylight, or something setting-specific.

Physical seasons, climate observations, and illumination are separate structured facts. A display may compare them when sufficient planetary, orbital, atmospheric, spatial, and temporal data exists. It may not redefine the calendar's named seasons from axial tilt.

## Displays

Calendar data may become:

- month, year, or agenda displays;
- date formatting in prose and infoboxes;
- a timeline axis;
- an Orrery or sky view at a converted date;
- phase or ceremonial-cycle indicators;
- reform and drift comparisons;
- tables comparing calendars used by one culture or place.

These are displays over calendar rules and relationships. The system-map calendar tray is optional context, not permanent viewer furniture. Saved views may lock a calendar date and celestial composition for WikiText transclusion.

## Validation and Integrity

Validation has separate layers:

1. **Structural:** the schema version and required rule fields are valid.
2. **Mechanical:** the declared rules can resolve dates without impossible or ambiguous transitions.
3. **Referential:** linked objects and pinned revisions exist or have an explicit unresolved state.
4. **Temporal:** reforms, snapshots, and validity intervals have coherent ordering.
5. **Physical:** only fields explicitly asserting physical facts are checked against applicable celestial constraints.

An unusual, drifting, symbolic, or deliberately inaccurate calendar can pass validation. An obsolete JSON shape, broken object reference, zero-length month produced accidentally, or ambiguous reform boundary cannot pass silently.

Validation runs on writes and again before publication. Renderers still guard their boundary so one invalid calendar display cannot cause a page-level 500.

## Transition from the Current Schema

1. Treat `static_data` as calendar-owned rules and keep its Zod schema versioned.
2. Document `planet_id` as optional context, not automatic derivation authority.
3. Introduce typed relationship records when the generic object/facet model can preserve cardinality, revisions, and provenance.
4. Add explicit cycle resolution modes before allowing live celestial values and snapshots to coexist.
5. Add calendar-reform validity only with a broader temporal object contract.
6. Build observer-sky and historical Orrery displays on an explicit calendar-date-to-application-time conversion.
7. Migrate existing calendar payloads transactionally, with preview and rollback, when a new schema version is adopted.

## Non-Goals

- forcing calendar years to match orbital periods;
- deriving month structure from moons unless an author chooses that rule;
- treating symbolic moons as physical celestial bodies;
- silently snapshotting live physical values;
- rewriting a calendar when celestial data changes;
- representing an in-world reform as ordinary revision history alone;
- requiring a planet or culture before a calendar can exist;
- promising historical celestial playback without historical state data.

## Acceptance Criteria

This boundary is implemented correctly when:

1. a calendar can be fully authored and rendered without celestial data;
2. physical references state whether they are live, snapshot, historical, or calendar-owned;
3. changing a celestial orbit cannot silently change calendar rules;
4. drift is presented as a comparison rather than an error correction;
5. cultural seasons remain authored even when physical-season data exists;
6. invalid rule payloads are rejected before publication and fail locally at render time;
7. calendar dates can drive saved celestial views only through an explicit time conversion;
8. many-to-many relationships among calendars, places, cultures, and observed objects remain possible.

## Review Triggers

Review this document when:

- calendar payload versioning or a visual rule builder enters implementation;
- `planet_id` is replaced by generic relationships;
- calendar reforms or historical celestial state receive a concrete model;
- observer-sky views consume calendar dates;
- a real authored calendar cannot be represented without violating this boundary.

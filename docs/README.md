# KnowThing Documentation

This directory contains product architecture, delivery plans, audits, reference material, and engineering process notes. Documents are grouped by purpose so that current decisions are easier to distinguish from historical analysis and future work.

## Start Here

- [Structured Data Vision](./architecture/STRUCTURED-DATA-VISION.md) — product-wide structured worldbuilding direction.
- [Atlas Architecture](./architecture/Atlas-Architecture.md) — multiscale spatial publishing architecture.
- [Celestial Sector and System Model](./architecture/celestial/Celestial-Sector-and-System-Model.md) — adopted sector, root-system, interstellar-object, and Orrery transition model.
- [Celestial Part 1 Launch Plan](./plans/celestial/Part-1-Launch-Plan.md) — current personal-instance launch boundary and gates.
- [Code Review Rules](./process/CODE-REVIEW.md) — repository review expectations.

## Directory Guide

### `architecture/`

Durable product and technical decisions. These documents define target boundaries and contracts, although individual sections may still be design intent.

- [Atlas Architecture](./architecture/Atlas-Architecture.md)
- [Structured Data Vision](./architecture/STRUCTURED-DATA-VISION.md)
- [Legacy WorldMap Vision](./architecture/WORLDMAP-VISION.md)
- [Celestial architecture](./architecture/celestial/)
  - [Sector and System Model](./architecture/celestial/Celestial-Sector-and-System-Model.md)
  - [Calendar Integration](./architecture/celestial/Celestial-Calendar-Integration.md)
  - [Data Provenance and Ingest](./architecture/celestial/Celestial-Data-Provenance-and-Ingest.md)
  - [Surface Models](./architecture/celestial/Celestial-Surface-Models.md)

### `adr/`

Narrow architecture decision records backed by concrete investigation or implementation evidence.

- [ADR 0001: Planetary CRS and focused viewer](./adr/0001-planetary-crs-and-focused-viewer.md)

### `plans/`

Sequenced delivery work, roadmaps, and phase-specific implementation plans. Plans may become stale after delivery and should link back to the architecture they implement.

- Celestial
  - [Part 1 Launch Plan](./plans/celestial/Part-1-Launch-Plan.md)
  - [Orrery Roadmap](./plans/celestial/Celestial-Orrery-Roadmap.md)
  - [Celestial Upgrades](./plans/celestial/Celestial-Upgrades.md)
- Wordbook
  - [Orthography](./plans/wordbook/Orthography.md)

### `audits/`

Point-in-time findings, comparisons, and gap analyses. These are evidence, not automatically current architecture.

- [Migration Phase 0 Audit](./audits/MIGRATION-PHASE-0-AUDIT.md)
- [Wordbook Audit](./audits/WORDBOOK-AUDIT.md)
- [WorldAnvil Comparison](./audits/WORLDANVIL-COMPARISON.md)
- [Structural Gaps](./audits/Ten-Issues.md)

### `references/`

Research catalogues and supporting material used by architecture and implementation work.

- [Planetary Data Acquisition Catalogue](./references/Planetary-Data-Acquisition-Catalogue.md)

### `process/`

Engineering and collaboration procedures.

- [Code Review Rules](./process/CODE-REVIEW.md)

### `notes/`

Uncommitted ideas and exploratory notes that have not yet become architecture or plans.

- [Other Ideas](./notes/Other-Ideas.md)

## Document Conventions

New architecture and plan documents should include:

- a clear status;
- the date of the decision or latest material update;
- related-document links;
- a maturity note separating implemented behavior from design intent;
- explicit non-goals;
- a review trigger when the document can become stale.

When a decision supersedes an older document, keep the older document if it remains useful evidence, mark it as legacy or superseded at the top, and link to the replacement. Do not leave conflicting documents appearing equally current.

Package-specific scientific documentation remains beside its package under [`packages/tungolcraft/docs`](../packages/tungolcraft/docs/), where its generation and packaging checks expect it.

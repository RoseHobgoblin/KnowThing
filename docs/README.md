# KnowThing Documentation

This directory contains product architecture, delivery plans, audits, reference material, and engineering process notes. Documents are grouped by purpose so that current decisions are easier to distinguish from historical analysis and future work.

## Start Here

- [Polities, Territories, and Political Relationships](./architecture/Polities-Territories-and-Political-Relationships.md) — political identity, territorial authority, classifications, and nested political structures.
- [Structured Data Vision](./architecture/STRUCTURED-DATA-VISION.md) — product-wide structured worldbuilding direction.
- [Atlas Architecture](./architecture/Atlas-Architecture.md) — multiscale spatial publishing architecture.
- [Celestial Sector and System Model](./architecture/celestial/Celestial-Sector-and-System-Model.md) — adopted sector, root-system, interstellar-object, and Orrery transition model.
- [Celestial Views, Authoring, and Wiki Embeds](./architecture/celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md) — field-driven authoring displays, generated apparent skies, serializable views, and WikiText transclusion.

## Directory Guide

### `architecture/`

Durable product and technical decisions. These documents define target boundaries and contracts, although individual sections may still be design intent.

- [Polities, Territories, and Political Relationships](./architecture/Polities-Territories-and-Political-Relationships.md)
- [Atlas Architecture](./architecture/Atlas-Architecture.md)
- [Structured Data Vision](./architecture/STRUCTURED-DATA-VISION.md)
- [Celestial architecture](./architecture/celestial/)
  - [Sector and System Model](./architecture/celestial/Celestial-Sector-and-System-Model.md)
  - [Views, Authoring, and Wiki Embeds](./architecture/celestial/Celestial-Views-Authoring-and-Wiki-Embeds.md)
  - [Calendar Integration](./architecture/celestial/Celestial-Calendar-Integration.md)
  - [Data Provenance and Ingest](./architecture/celestial/Celestial-Data-Provenance-and-Ingest.md)
  - [Surface Models](./architecture/celestial/Celestial-Surface-Models.md)

### `adr/`

Narrow architecture decision records backed by concrete investigation or implementation evidence.

- [ADR 0001: Planetary CRS and focused viewer](./adr/0001-planetary-crs-and-focused-viewer.md)

### `plans/`

Sequenced delivery work, roadmaps, and phase-specific implementation plans. Plans may become stale after delivery and should link back to the architecture they implement.

- Celestial
  - [Orrery Roadmap](./plans/celestial/Celestial-Orrery-Roadmap.md)

### `audits/`

Point-in-time findings, comparisons, and gap analyses. These are evidence, not automatically current architecture.

- [Migration Phase 0 Audit](./audits/MIGRATION-PHASE-0-AUDIT.md)
- [Wordbook Audit](./audits/WORDBOOK-AUDIT.md)
- [KnowThing and World Anvil Comparison](./audits/WORLDANVIL-COMPARISON.md)

### `references/`

Research catalogues and supporting material used by architecture and implementation work.

- [Planetary Data Acquisition Catalogue](./references/Planetary-Data-Acquisition-Catalogue.md)
- [AstroSynthesis 3 Ring-System Distillation](./references/AstroSynthesis-3-Ring-Systems.md)

## Document Conventions

New architecture and plan documents should include:

- a clear status;
- the date of the decision or latest material update;
- related-document links;
- a maturity note separating implemented behavior from design intent;
- explicit non-goals;
- a review trigger when the document can become stale.

Git history is the documentation archive. When a plan is completed or a proposal is superseded, move any still-valid decision into current architecture and delete the obsolete document. Keep an old document in-tree only when it remains useful evidence that cannot be understood from history alone; label it as a dated audit or accepted ADR, not as current guidance.

Documents that make claims about current implementation must name a review trigger. Completed implementation plans, undated competitor comparisons, conversational brainstorm transcripts, and warning banners over otherwise obsolete content do not belong in the live documentation set.

Package-specific scientific documentation remains beside its package under [`packages/tungolcraft/docs`](../packages/tungolcraft/docs/), where its generation and packaging checks expect it.

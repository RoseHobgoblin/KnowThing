# Wordbook System Audit

> Branch: `language-audit` · Date: 2026-07-04 · Scope: full Wordbook surface — data model,
> API/services, UI, search, cross-system integration, tests.
> Empirical basis: code reading, live-DB inspection, test-suite run, and a real modelling
> trial (three invented languages: Sarnavi / Kesseti / Tsevoki, `scripts/trial-wordbook-roun.sql`).

> **STATUS: substantially RESOLVED on this branch** (same day). All quick wins,
> all of P0, P1, and P2, plus pagination (P3) and the perf/test items of P4 are
> implemented — see the `fix(wordbook)`/`feat(wordbook)` commit series. Still
> open (deliberately deferred, larger design work): §1.5's phonotactics layer,
> conscript glyph storage, clade entities, and language code fields; the
> `pageSlug`/`body*` Phase-9 completion (pageSlug links remain, now that bodies
> render natively the retirement path is clear); shared `<WordSearchInput>`
> extraction; and the repo's pre-existing non-wordbook type errors (parser,
> media, ui primitives).

## Verdict (TL;DR)

The Wordbook's **core is sound** — the language tree, lexicon/definitions, phoneme/grapheme
inventories, and a surprisingly good hybrid search (ILIKE + trigram + dual FTS + inflected-form
lookup) store and find real conlang data. But the system is **half-migrated, un-transactional at
its write paths, permission-inconsistent at its edit routes, split across two rendering worlds
(Wordbook page vs Know article), double-counted in global search, red-link-blind, and almost
untested**. Several of the highest-value fixes are startlingly cheap: the `{{Infobox
language|from=}}` bridge is one ~30-line resolver; red links for wordbook targets need only to
consume existence data that is *already computed and discarded*; search dedup is one merge pass.

Rework order: **(P0)** stabilize writes + access control, **(P1)** finish half-done migrations
and the revision system, **(P2)** unify the two rendering worlds and the integration seams,
**(P3)** extend the model where the invented-language trial proved it can't express real
features (phonotactics, gemination, diphthongs, scripts, clades), **(P4)** performance + tests
throughout.

---

## 1. Data model (schema-level)

### 1.1 What's good
- Clean entity separation: `languages` (tree via `parentLanguageId` + `languageType:
  proto|language|historical`), `language_dialects`, `phonemes` (full articulatory feature
  columns), `graphemes` + `grapheme_phonemes` (ordered many-to-many), `lexicon` →
  `definitions` (senses) / `lexicon_variants` (per-dialect) / `lexicon_relations` (etymology)
  / `lexicon_revisions`, and a real inflection engine (`inflection_dimensions` →
  `paradigm_classes` → `paradigm_rules` → `lexicon_inflections` + materialized
  `inflected_forms`).
- Phoneme axes are free text (normalized to lowercase only), and the grid renderer *appends*
  unknown axis values (`phoneme-ordering.ts`) — invented/conlang-specific values are
  accepted rather than rejected. Confirmed empirically in the trial.

### 1.2 ORM ↔ DB drift (the ORM is blind to the FTS layer)
- `lexicon.search_vector` (tsvector) **exists in the live DB but not in `schema.ts`**.
- `definitions.search_vector` — same.
- Trigger functions `lexicon_search_update` and `definitions_touch_parent` + triggers
  `trg_lexicon_search`, `trg_definitions_touch` exist live (from `drizzle/0002_wordbook.sql`)
  and are invisible to the ORM. Any Drizzle-managed schema regeneration would silently
  drop/miss them.
- Indexes live but undeclared in ORM: `idx_lexicon_tags` (GIN), `idx_lexicon_word_trgm`
  (pg_trgm), `idx_lexicon_search` (GIN tsvector), and — importantly —
  `lexicon_word_lang_hom_unique` UNIQUE `(word, language_id, homograph_number)`.
  Note: this unique index is **case-sensitive** while the app-level homograph check is
  case-insensitive (`lower(word)`), so the DB does not actually back the app's invariant.

### 1.3 Missing constraints (DB lets the app lie)
- No UNIQUE on `paradigm_rules (class_id, cell_key)` → duplicate rules possible; read path
  silently last-wins.
- No UNIQUE on `inflected_forms (entry_id, cell_key)` → the `.onConflictDoNothing()` in
  `rebuildInflectedForms` is a no-op; correctness rests entirely on the preceding DELETE.
- No UNIQUE on `lexicon_relations (source_id, target_id, relation_type)` → duplicate
  relations possible; bulk-create's `.onConflictDoNothing()` is likewise a no-op.
- No UNIQUE on `lexicon_variants (entry_id, dialect_id)` → one-per-dialect is app-enforced
  only (raceable).
- `language_dialects.slug` not unique (even per-language).
- No CI-unique backing homographs (see 1.2).

### 1.4 Deprecation half-done ("Phase 9" limbo)
Fields marked `DEPRECATED: removed in Phase 9` are still **read and written** everywhere:
- `lexicon.pageSlug` — accepted by create/update schemas, written by services, selected by reads.
- `languages.pageSlug` — read/written in services; the Wordbook UI links to Know via it.
- `lexicon.description` — dead (never read/written).
- `lexicon.body*` (5 columns) — scaffolding, no write path populates them.
- `definitions.dialect_id` — dead column, no endpoint touches it; also its `onDelete: set
  null` is inconsistent with `lexicon_variants.dialectId`'s `cascade`.

### 1.5 Modelling gaps found by the trial (invented-language stress test)
1. **No phonotactics layer.** Cluster/syllable-structure rules (Sarnavi `-lg-/-rn-/-shv-`,
   Tsevoki final `-tš/-ks/-sk`) have no home; `/kʃ/` is a cluster, not a segment, and cannot
   be entered at all. Prose is the only refuge.
2. **Gemination isn't first-class.** Kesseti `pː` must be faked as a separate phoneme row
   with `subtype='geminate'`, conflating length with manner.
3. **Diphthongs are storable but invisible.** `type='diphthong'` exists; `PhonemeGrid` only
   renders `consonant`/`vowel`. Stored `ai/au/ei` render nowhere.
4. **Invented scripts can't be represented.** `graphemes.grapheme` is text; a conscript with
   no Unicode has no glyph-image path — only romanization stand-ins.
5. **Branch vs language conflation.** Intermediate clades ("Ollaric", "Tsevic") only exist if
   created as fake `languages` rows; `family` free-text, `parentLanguageId`, and
   `languageType` triple-encode ancestry, redundantly and divergibly.
6. **No ISO/Glottolog-style code fields** in Wordbook, though the Know `{{Infobox language}}`
   renders them — the two models disagree about what a language *is*.

---

## 2. API & services layer

*(Full endpoint inventory with roles/validation in appendix A.)*

### 2.1 Validation is bimodal
`createWordSchema`/`updateWordSchema` + language/dialect/phoneme/grapheme/dimension schemas
are proper Zod. But **every definition, variant, relation, and per-entry inflection write is
a raw `await request.json()` + `as`-cast** — unvalidated `dialectId`, unchecked `overrides`
jsonb stored verbatim, etc. This directly violates the project's own guard rail ("API
mutations MUST validate with Zod").

### 2.2 Transactions missing at every compound write
- `createWordbookEntry`: homograph check + `max(homograph_number)` computed **outside** the
  insert transaction → concurrent creates race to duplicate numbers.
- `updateEntryInflection`: select → upsert → `rebuildInflectedForms` (delete+insert), no tx.
- `updateParadigmClass`: update + delete-all-rules + reinsert + rebuild all class forms, no tx —
  mid-failure wipes the class's rules.
- `deleteDimension`: dimension delete + per-class stale-rule cleanup + rebuilds, no tx.
- Revision snapshots are taken *before* their mutation and not in the same tx — a snapshot can
  persist for a write that then failed.
(Also violates the stated guard rail: "use transactions for multi-step writes.")

### 2.3 Error handling leaks
`handleServiceCall` re-throws non-`HttpError`s → FK violations, unique violations, and
`generateCellKeys`' plain `Error` ("too many cells") all surface as raw 500s. Guard rail
violated ("NEVER let raw Postgres errors reach the client"). Error shapes differ across three
paths (service JSON, `requireRole` Response, manual ID guards); Zod failures return only the
first issue.

### 2.4 Revision system is write-only
Snapshots written on headword/definition updates only — **never** for variants, relations, or
inflection changes; `addEntryDefinition` doesn't snapshot either. **No history/restore API
exists at all** (unlike `pages`). `lexicon_revisions` cascade-deletes with the entry, so
deleting an entry destroys its own audit trail. Decide: build history/restore + widen
snapshot coverage, or delete the dead weight.

### 2.5 Semantics bugs
- `updateWordbookEntry` can rename `word`/move `languageId` with **no homograph re-check** —
  the create-time guard is bypassable via update.
- `addEntryVariant` doesn't check the dialect belongs to the entry's language.
- Relation deletion only works from the source side; targets can't remove incoming edges.
- `compound_of` is accepted on write but silently excluded from all etymology/cognate
  recursion — a dead relation type for the features that justify it.
- Homograph numbers gap forever after deletes; display sorts by number.
- Role tiers are unprincipled: DELETE entry = admin, but bulk-replace all its definitions =
  editor; language inflection metadata = admin while entry inflection = editor.

### 2.6 Query efficiency
- First-definition correlated subqueries (two per row) in every list/search read.
- GET relations runs `getDirectRelations` + `computeCognates` + `getEtymologyChain` = 3+
  recursive CTEs per word-page view; `computeCognates` runs one recursive CTE **per root** in
  a JS loop.
- `rebuildClassForms`: sequential per-entry delete+recompute, O(entries × cells) writes.
- `listWordbookTags`: full-table UNNEST+GROUP BY per request.
- `queryLanguagesWithFamily`: recursive CTE + per-row correlated wordCount.

---

## 3. Rendering split (Wordbook page vs Know article)

- The Wordbook language page **never renders `language.body`** — it links out via deprecated
  `pageSlug` ("Read the full article →"). Phoneme/grapheme data entered in Wordbook is only
  *visible* when a **Know article** embeds `{{Consonants|slug}}` / `{{Vowels|slug}}` /
  `{{Orthography|slug}}`.
- `{{Phonology|slug}}` was broken until this branch (emitted a `phonology:` collection key
  nothing read; fixed in `src/lib/parser/index.ts` by fanning out to `consonants:` +
  `vowels:`). `COLLECTION_RESOLVERS.phonology` / `loadPhonology` is now dead code.
- Three prose fields compete: `languages.description`, `languages.body` (unrendered), and the
  linked Know article. Writers cannot know where text should live (trial confirmed: body
  prose is silently invisible).
- Wordbook has **no `from=` infobox mechanism** like celestial's `{{Infobox planet|from=slug}}`;
  `{{Infobox language}}` fields in Know articles are hand-typed and drift freely from the
  structured `languages` row.

## 4. Tests

300 tests pass, but Wordbook coverage is: IPA chart data, axis normalization, phoneme-grid
builder, collection-ref extraction. **Zero tests** for: the inflection engine (cell keys ×
pattern application × rebuild — the most algorithmic code in the domain), homograph
allocation, revisions, relations/etymology recursion, variants, search, language tree, or any
service/route. Celestial, by contrast, has 7 dedicated test files.

---

## 5. UI / UX

### 5.1 Access-control mismatches (security-adjacent)
- **All four `contribute/**` server loads gate on `if (!locals.user)` only** — any logged-in
  non-editor who types the URL gets a fully functional form and is rejected only at the API
  (`contribute/+page.server.ts:6`, `contribute/[id]/+page.server.ts:9`,
  `contribute/language/[slug]/+page.server.ts:12`). Display buttons gate on
  `canManageWordbook`; the routes don't. Language add/edit pages aren't gated on it at all.
- **`EtymologySection` gates edit/delete on `isAuthenticated`** (lines 75, 188, 384), not
  `canManageWordbook` — any authenticated user sees relation edit controls the rest of the
  wordbook denies them.
- The unused `canManageLanguages` permission exists (`permissions.ts:11`) but no wordbook UI
  consults it — decide its fate in the rework.
- Hub CTAs ("+ Add word"/"+ Add language") show to logged-out users and bounce to login.

### 5.2 Data-loss & broken-behavior bugs
- **`EntryForm` silently discards etymology relations in edit mode**: it collects
  `relations` (`EntryForm.svelte:179`) but the edit handler
  (`contribute/[id]/+page.svelte:52-61`) never sends them; the widget also never loads
  existing relations. Looks editable; does nothing.
- **`LanguageBadge` breaks on non-hex colors** (`LanguageBadge.svelte:12`): builds
  `background-color: {c}15` by hex-alpha concatenation; the *default* stored color is the
  string `var(--color-accent)` → invalid CSS, silently unstyled badges.
- POS color lookup is case-inconsistent (`WordEntry.svelte:24` lowercases;
  `[word]/+page.svelte:187` doesn't) and the POS palette is hardcoded dark-mode-only Tailwind
  classes (`constants.ts:26-44`).

### 5.3 Missing CRUD (dead ends)
- **No delete-language UI** anywhere (the API endpoint exists, unreached).
- **Dialects: read-only** — no create/edit/delete UI. **Dialect variants: read-only** — no
  way to add spelling/pronunciation variants from any page.
- No sense/definition reorder; no language slug edit after creation.
- `/wordbook/search` has **no UI at all** — a bare 307 to `/search?scope=wordbook`.

### 5.4 UX gaps
- **No pagination anywhere**: a language page renders every entry for a letter (or all
  entries); recent-entries is a hard cap of 10 with no "see all".
- **Alphabet nav is Latin-naive**: buckets key on `word[0].toUpperCase()` — diacritics,
  digraphs, non-Latin scripts and punctuation each become singleton buckets
  (`[language]/+page.svelte:33-41`, `AlphabetNav.svelte:9`). For a *conlang* wordbook this is
  a core defect, not an edge case.
- `pageSlug` "Read the full article →" renders unconditionally with no existence check, even
  though `resolvedLinks` is right there.
- Most mutations `invalidateAll()` with no optimistic UI (phoneme/grapheme editors are the
  good exception — optimistic + undo toasts); etymology search has no loading state; no
  custom 404/empty styling for words.

### 5.5 Duplication & dead code
- Word-search-autocomplete implemented 3× (EntryForm, EtymologySection, language filter) —
  should be one `<WordSearchInput>`.
- `siteConfig.wordbookName` fallback repeated in all 7 pages; three `<title>` tags hardcode
  `'Wordbook'` and ignore the config; the `/Wordbook` URL segment is hardcoded ~30× (config
  renames labels but not URLs).
- `wordbookLanguageBreadcrumbs` helper exists and is never imported (breadcrumbs built inline
  instead); `LanguageTree.svelte` is dead; `knowBreadcrumbs(title, _ctx)` declares a
  wordbook-backlink context param and ignores it — the Know→Wordbook backlink is stubbed,
  unimplemented.
- Dialog/draft/undo logic copy-pasted between `PhonemeEditor` and `GraphemeEditor`.
- Inflection presets are English/Indo-European-centric with literal `'cat'`/`'dog'` preview
  stems — ironic for a conlang tool.

### 5.6 A11y
- Reordering (graphemes, phoneme sequences) is mouse-drag only — no keyboard path.
- `GraphemeEditor` cells use `role="button"` with `tabindex={-1}` on most targets.
- Icon-only delete buttons lack `aria-label`; a form label lacks `for`.

## 6. Search & integration

### 6.1 Wordbook search itself: solid
A genuine hybrid (`search/wordbook.ts:60-67`): exact + prefix ILIKE, pg_trgm fuzzy, dual FTS
(`lexicon.search_vector` + `definitions.search_vector`), and exact `inflected_forms` lookup
(inflection-aware search!), with CASE-based ranking. The FTS triggers are **live and
correct** (rebuilt in `0006_polysemy.sql`, never dropped; `trg_definitions_touch` keeps the
vector coherent across sense edits).

**Not searchable anywhere:** `pronunciation`, `usage_example`, `usage_translation`, `notes`.
**Not in wordbook-scope FTS:** `lexicon.body_plain_text` — the trigger predates 0035 and was
never updated, so entry prose matches in `scope=all` (via the pages union) but not in
`scope=wordbook`. Inconsistent by scope.

### 6.2 Global search double-counts wordbook rows
Two independent paths surface the same lexicon row in `scope=all`: the pages UNION
(`pages.ts:161-188`, badged "Page", body snippet) and `searchWordbookEntries` (badged
"Word", definition snippet). **No dedup** — one entry can appear twice with different
badges, snippets, and ranks; counts are inflated the same way. Languages meanwhile surface
*only* via the pages path, so they're always badged "Page" and never counted under Wordbook.

### 6.3 Wordbook links can never render red
- There is deliberately no `Wordbook:` namespace (slash-path section instead) — fine.
- But `WikiWordbookLink.svelte` builds a static href and **never consults
  `ctx.resolvedLinks`**; `{{wt}}` likewise. Broken wordbook links are styled live-blue.
- The bitter part: `resolveWordbookFallthrough` (`resolved-links.ts:165-225`) **already
  computes** existence flags into `wordbook:<slug>` keys — and no renderer reads them. The
  red-link data is generated and thrown away.
- Plain `[[word]]` can never reach the wordbook (cross-domain fallthrough checks only
  know/celestial/calendar) — acceptable design, but should be a documented decision.

### 6.4 The `{{Infobox language|from=}}` gap — one resolver away
The generic `from=` machinery already fires for `{{Infobox language|from=slug}}` (extraction
is subtype-agnostic, `parser/index.ts:125-138`), but `DOMAIN_RESOLVERS`
(`structured-data.ts:82-97`) registers only celestial types — **no `language` entry**. So the
ref resolves to null and every field must be hand-typed, drifting freely from the
`languages` row. Fix ≈ 30 lines mirroring the `system` resolver: map name/native_name/family/
script/color(→familycolor)/dialects/speaker data into the FieldMap. No schema change needed.
The same gap applies to lexicon entries (no `from=` for word infoboxes at all).

### 6.5 Other seams
- `{{lang}}`/`{{native name}}` templates have zero linkage to the `languages` table (don't
  validate or link codes) — only `{{wt}}` bridges into the Wordbook.
- Entity categories/media scaffolding (`entity_categories`, 0035) not wired for wordbook
  sources — languages/entries can't be categorized.
- Backlink *tracking* (content_links with `sourceKind='language'/'lexicon'`) works; only the
  visual/red-link layer is missing.

---

## 7. Prioritized rework plan

### Quick wins (disproportionate value, ≤ a day each)
- **QW1.** `{{Infobox language|from=slug}}`: register a `language` entry in
  `DOMAIN_RESOLVERS` (~30 lines, mirrors the `system` resolver). Kills infobox↔DB drift.
- **QW2.** Red links for wordbook targets: make `WikiWordbookLink` + `{{wt}}` consult
  `ctx.resolvedLinks` — the existence flags are already computed by
  `resolveWordbookFallthrough` and currently discarded.
- **QW3.** Global-search dedup: merge pages-union and wordbook hits on (domain, entity id),
  prefer the "Word" badge, fix the inflated counts.
- **QW4.** FTS completeness: update `lexicon_search_update()` to include
  `body_plain_text` (+ optionally `pronunciation`, weighted D); one migration.
- **QW5.** `LanguageBadge` color bug: use `color-mix()` or a hex guard instead of string
  concatenation.
- **QW6.** Contribute-route auth: change the four `if (!locals.user)` gates to editor-role
  checks; fix `EtymologySection` to gate on `canManageWordbook`.

### P0 — Stop the bleeding (correctness & access control)
1. Zod schemas for definitions/variants/relations/inflection writes (match existing pattern
   in `http/wordbook/schemas.ts`); validate `overrides` shape; reject unknown dialect/class
   ids with 400s, not FK 500s.
2. Transactions around every compound write in §2.2; homograph allocation inside the insert
   tx; homograph **re-check on update** (rename/move bypass).
3. `handleServiceCall`: catch non-HTTP errors → structured `json({error}, {status:500})`,
   log the original; unify the three error shapes; return all Zod issues.
4. DB constraints: UNIQUE CI `(language_id, lower(word), homograph_number)` (replacing the
   case-sensitive one); `(class_id, cell_key)`; `(entry_id, cell_key)`;
   `(source_id, target_id, relation_type)`; `(entry_id, dialect_id)`; per-language dialect
   slug uniqueness.
5. Declare `search_vector` columns/indexes/triggers in the ORM layer (or a checked-in `sql`
   escape hatch) so schema regeneration can't silently destroy FTS.
6. Route-level authz (QW6) + rationalize role tiers (entry delete=admin vs definitions
   bulk-replace=editor makes no sense; pick a principle and apply it).

### P1 — Finish what's half-done
7. Complete or revert Phase-9 deprecations (`pageSlug`, `lexicon.description`,
   `lexicon.body*`, `definitions.dialect_id`); the UI's pageSlug links become resolved-link
   aware in the interim (no dead "Read the full article →").
8. Revision system: history list + restore endpoints (mirror `pages`), snapshot *all*
   entry-shaped mutations (incl. variants/relations/inflection) inside their tx, stop
   cascade-deleting revisions with the entry.
9. Fix `EntryForm` edit mode: load existing relations, submit relation changes (or remove
   the widget in edit mode and point to EtymologySection).
10. Ship the missing CRUD: delete language (UI), dialect CRUD, dialect-variant add/edit,
    sense reorder.
11. Dead code: `loadPhonology` resolver, `normalizeEnvironment` duplicate,
    `wordbookLanguageBreadcrumbs`, `LanguageTree.svelte`; wire `compound_of` into etymology
    or drop the type; decide `canManageLanguages`'s fate.
12. Inflection hygiene: tx + batched rebuilds; prune/rekey rules on dimension-value rename;
    snapshot inflection edits; catch cell-key overflow as a 400.

### P2 — Unify the two worlds
13. Render `language.body` (and `entry.body`) on Wordbook pages with the full renderer —
    prose + structured grids on one page; the renderer context is already wired, only the
    render call is missing. Then retire `pageSlug` outbound links.
14. QW1 (`from=` resolver) + a lexicon-entry equivalent so word infoboxes can pull
    pronunciation/POS/definitions.
15. Implement the stubbed Know→Wordbook backlink (`knowBreadcrumbs` `_ctx`).
16. Surface diphthongs (third grid/row group) and geminates (length column, not a fake
    manner row) in `PhonemeGrid`.
17. Unicode-aware alphabet nav: bucket by `Intl.Segmenter` grapheme + locale collation, with
    a configurable per-language collation order (conlangs need custom alphabet order — this
    is a *feature*, not just a fix).

### P3 — Model extensions (the trial's wishlist)
18. Phonotactics: per-language syllable template + cluster tables; "Phonotactics" render
    section; soft validation of new lexicon entries against it.
19. Script/glyph support: optional glyph image per grapheme (media filename), grid falls
    back to romanization; per-language font/PUA support as a cheaper alternative.
20. Clade entities (`languageType:'branch'` or a clades table); stop triple-encoding
    ancestry across `family`/`parentLanguageId`/`languageType`.
21. Language code fields to match the Know infobox; pronunciation made searchable.
22. Pagination for entry lists; "see all" for recent entries.

### P4 — Performance & tests (gates the rest)
23. Replace correlated first-definition subqueries with lateral joins or a denormalized
    `primary_definition` maintained by the existing touch trigger.
24. Cognates: cache or compute on demand (3+ recursive CTEs per word view today); batch
    `rebuildClassForms`; cache the tags aggregate.
25. Tests for the engine (cell keys, pattern application, rebuild idempotence), homograph
    races, revision round-trips, search ranking/dedup, and the resolvers — the domain
    currently has near-zero coverage while celestial has 7 suites.
26. Shared components: `<WordSearchInput>`, dialog/draft/undo helpers, POS palette from
    theme tokens (light-mode compatible).

---

## Appendix A — API inventory

| Method / Path | Role | Validation |
|---|---|---|
| GET `/api/wordbook` | – | ad-hoc query params |
| POST `/api/wordbook` | editor | `createWordSchema` ✅ |
| GET/PUT/DELETE `/api/wordbook/:id` | –/editor/**admin** | manual / `updateWordSchema` ✅ / manual |
| GET `/api/wordbook/tags` | – | none |
| POST/PUT `/api/wordbook/:id/definitions` (+`/:defId` PUT/DELETE) | editor | ❌ raw casts |
| GET/POST `/api/wordbook/:id/variants` (+`/:variantId` DELETE) | –/editor | ❌ raw casts |
| GET/POST `/api/wordbook/:id/relations` (+`/:relationId` DELETE) | –/editor | ❌ raw casts |
| GET/PUT `/api/wordbook/:id/inflection` | –/editor | ❌ raw casts; GET unwrapped |
| GET/POST `/api/languages` | –/**admin** | ✅ |
| GET/PUT `/api/languages/:slug` | –/admin | ✅ |
| `/dialects` writes | admin | ✅ |
| `/phonemes`, `/graphemes` (+reorder) writes | editor | ✅ |
| `/inflections/dimensions|classes` writes | admin | ✅ |

Key: ✅ Zod · ❌ unvalidated cast · – public read.

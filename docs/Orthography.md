# Phase 2: Graphemes & Orthography

> Define how a language's sounds map to written characters, and render orthography tables on wiki pages via `{{orthography|slug}}`.

Builds on Phase 1. Reuses the collection resolver pattern, `ArticleShell`, dirty-check + Enter-to-save, undo-delete toast, `ConfirmDialog`, Zod-validated API.

---

## Context

Phase 1 answered "what sounds does this language have?" Phase 2 answers "how are those sounds written?"

This plan is designed up front to support every non-logographic writing system a conlanger might build, not just alphabets. The shape that falls out is different from a naive "one grapheme, one phoneme" schema — see §Schema for the structural call.

Writing-system families we must fit:

- **Alphabets** (Latin, Cyrillic, Shavian) — `a` → /a/
- **Digraph-heavy alphabets** (English `th`, German `sch`, Welsh `ll`) — `th` → /θ/
- **Context-dependent mappings** — `c` → /k/ before a/o/u, `c` → /s/ before e/i (same grapheme string, different environments)
- **Silent letters and punctuation** — French `h`, `.`, `,`
- **Tone-marked alphabets** (Pinyin, Vietnamese, Yoruba) — handled via Phase 1 modeling tone-bearing vowels as separate phonemes
- **Abjads** (Arabic, Hebrew, Semitic conlangs) — consonants as graphemes, optional vowel diacritics as their own graphemes
- **Syllabaries** (Japanese kana, Cherokee, conlang syllabaries) — `か` → /k/ + /a/ (two phonemes, ordered)
- **Abugidas** (Devanagari, Ethiopic, Thai, inherent-vowel conlang scripts) — `क` → /k/ + /a/, `कि` → /k/ + /i/
- **Featural / syllable-block scripts** (Hangul, Tengwar-descended conlang blocks) — `발` → /p/ + /a/ + /l/
- **Multi-codepoint sequences** — PUA glyphs from future CarveCraft scripts

The schema decision that unlocks most of this list is making grapheme→phoneme a **many-to-many ordered relation**, not a single FK.

---

## Branch

`feat/phonology-phase-2` (branch from `main` after Phase 1 merges).

---

## Schema

Migration `drizzle/NNNN_graphemes.sql` (pick the next number in sequence — don't jump ahead). Two new tables in [src/lib/server/db/schema.ts](../src/lib/server/db/schema.ts) after `phonemes`.

```
graphemes
  id            serial PK
  language_id   integer NOT NULL FK → languages(id) ON DELETE CASCADE
  grapheme      text NOT NULL                    -- "th", "x", "か", "क", PUA char
  romanization  text                             -- Latin fallback for non-Latin scripts
  environment   text                             -- "before front vowels", "word-initial", "isolated form"
  notes         text
  sort_order    integer NOT NULL DEFAULT 0
  created_at    timestamptz NOT NULL DEFAULT NOW()
  updated_at    timestamptz NOT NULL DEFAULT NOW()

INDEX idx_graphemes_language ON graphemes(language_id, sort_order)

grapheme_phonemes
  grapheme_id   integer NOT NULL FK → graphemes(id) ON DELETE CASCADE
  phoneme_id    integer NOT NULL FK → phonemes(id) ON DELETE CASCADE
  position      smallint NOT NULL                -- 0-indexed order within the grapheme
  PRIMARY KEY (grapheme_id, position)

INDEX idx_grapheme_phonemes_phoneme ON grapheme_phonemes(phoneme_id)
```

Decisions baked in:

1. **Grapheme→phoneme is many-to-many ordered, not a single FK.** `か` maps to [/k/, /a/]; `발` maps to [/p/, /a/, /l/]. Alphabets are just the degenerate one-row case. This is the load-bearing call — without it, syllabaries and abugidas are second-class.
2. **Silent letters = zero rows in the join, not a nullable column.** No `NULL` phoneme_id to reason about. The editor shows "— (silent / punctuation)" when the join is empty.
3. **`ON DELETE CASCADE` on both FK sides of the join.** Deleting a phoneme removes its join rows; the grapheme itself survives as "silent" (zero-row join). Deleting a grapheme removes its join rows. No orphaned links.
4. **`grapheme` is a string, not a char, with no uniqueness constraint.** Digraphs, trigraphs, multi-codepoint PUA, and duplicate graphemes across environments (`c`/`k` and `c`/`s`) are all first-class. Case-sensitive — `A` and `a` are distinct.
5. **No normalization of `grapheme` or `romanization`.** Case matters. `normalizeAxis` applies to `environment` only.

### Undo-delete semantics across phonemes

Deleting a phoneme cascades its join rows. If the user then hits Undo on the phoneme toast, the phoneme restores with a **new id** and its graphemes stay silent — the original links are gone. This is acceptable and worth surfacing:

- The undo toast for phoneme deletion should read: *"Phoneme deleted. N graphemes became silent."* when `N > 0`.
- The grapheme editor's "re-link" affordance (see §Editor) makes recovery cheap.

Do not try to auto-restore links by matching IPA strings. It's fragile (homophones, edits between delete and undo) and users will not expect silent magic.

---

## Server data-loading

In [src/lib/server/structured-data.ts](../src/lib/server/structured-data.ts):

```ts
async function loadOrthography(slug: string): Promise<StructuredCollection | null> {
  const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
  if (!lang) return null

  const rows = await db
    .select({
      id: graphemes.id,
      grapheme: graphemes.grapheme,
      romanization: graphemes.romanization,
      environment: graphemes.environment,
      notes: graphemes.notes,
      sortOrder: graphemes.sortOrder,
    })
    .from(graphemes)
    .where(eq(graphemes.languageId, lang.id))
    .orderBy(asc(graphemes.sortOrder), asc(graphemes.id))

  const links = await db
    .select({
      graphemeId: graphemePhonemes.graphemeId,
      position: graphemePhonemes.position,
      ipa: phonemes.ipa,
      type: phonemes.type,
    })
    .from(graphemePhonemes)
    .innerJoin(phonemes, eq(graphemePhonemes.phonemeId, phonemes.id))
    .where(inArray(graphemePhonemes.graphemeId, rows.map(r => r.id)))
    .orderBy(asc(graphemePhonemes.graphemeId), asc(graphemePhonemes.position))

  // Fold links into rows keyed by graphemeId.
  return mergeGraphemePhonemes(rows, links) as unknown as StructuredCollection
}

COLLECTION_RESOLVERS['orthography'] = loadOrthography
```

Two queries beat a leftJoin here because the fanout is 1-to-N on phonemes per grapheme — a join would duplicate grapheme rows and require dedup work client-side.

Extend `extractCollectionRefs` in [src/lib/parser/index.ts](../src/lib/parser/index.ts): add `'orthography'` to `COLLECTION_TEMPLATE_NAMES`.

---

## Wiki template: `{{orthography|slug}}`

Register in [src/lib/templates/registry.ts](../src/lib/templates/registry.ts):

```ts
'orthography': { component: OrthographyTable },
```

### `OrthographyTable.svelte`

New file `src/lib/renderer/structured/OrthographyTable.svelte`. Columns:

| Script | Romanization | IPA | Environment |

- **Script** — the grapheme string, rendered in the language's script class if set (Phase 3 hook, left empty for now).
- **Romanization** — suppressed entirely if no row in the language uses it.
- **IPA** — rendered as `/{ipa0}{ipa1}…/` concatenating ordered phoneme IPA. Empty join renders `—` with tooltip "silent / punctuation".
- **Environment** — suppressed entirely if no row in the language uses it. (Matches the romanization rule; keeps alphabet tables tight.)
- **Notes** — superscript footnotes below, same pattern as `PhonemeGrid`.

Leave `PhonologySection.svelte` alone. Editors compose `{{phonology|slug}}\n\n{{orthography|slug}}` explicitly — less magic, more control.

---

## API

`src/routes/api/languages/[slug]/graphemes/+server.ts` — GET, POST
`src/routes/api/languages/[slug]/graphemes/[id]/+server.ts` — PATCH, DELETE
`src/routes/api/languages/[slug]/graphemes/reorder/+server.ts` — POST (bulk sort_order update)

Mirrors the phonemes API:

- `requireRole('editor')` on mutations
- `parseBody` with Zod
- `db.transaction()` wraps grapheme insert + join row inserts atomically
- `normalizeAxis` applied to `environment` only
- Raw Postgres errors never reach the client

```ts
const createGraphemeSchema = z.object({
  grapheme: z.string().min(1, 'Grapheme is required'),
  phonemeIds: z.array(z.number().int()).default([]),  // ordered; empty = silent
  romanization: z.string().nullish(),
  environment: z.string().nullish(),
  notes: z.string().nullish(),
})

const reorderSchema = z.object({
  order: z.array(z.number().int()),  // grapheme ids in desired order
})
```

**Same-language constraint on every `phonemeId`**: one `SELECT id FROM phonemes WHERE id = ANY($1) AND language_id = $2` before insert, check returned count matches input length. Cheap, prevents cross-language bugs across the whole sequence in one round-trip.

**Reorder endpoint** runs inside a transaction, updates `sort_order` to array-index, validates every id belongs to the language.

---

## Editor route

`/wordbook/[language]/orthography` — mirrors `/wordbook/[language]/phonology`.

### Page

`+page.server.ts` loads language (recursive-ancestry CTE), graphemes with folded phoneme sequences for display, and the full phoneme inventory for the dialog's sequence builder.

`+page.svelte` wraps in `ArticleShell`:

- Breadcrumbs: `Wordbook › [ancestry…] › {language} › Orthography`
- Title: "Orthography"
- Badges: language name, grapheme count
- Description: mentions that the table is *documentation*, not a live transliterator — `{{orthography|slug}}` renders the mapping, it doesn't convert text.

### `GraphemeEditor.svelte`

New at `src/lib/components/phonology/GraphemeEditor.svelte`. Flat **drag-reorderable** table — reuse the grid-reorder primitive from `feat/phonology-phase-1` (commit `1d6ed06`).

| ⋮⋮ | Script | → | IPA | Environment | Notes | |
|---|---|---|---|---|---|---|
| ⋮⋮ | `th` | → | /θ/ | | | ✎ 🗑 |
| ⋮⋮ | `c`  | → | /k/ | before a/o/u | | ✎ 🗑 |
| ⋮⋮ | `c`  | → | /s/ | before e/i | | ✎ 🗑 |
| ⋮⋮ | `h`  | → | — | word-initial | French | ✎ 🗑 |
| ⋮⋮ | `か` | → | /ka/ | | | ✎ 🗑 |
| ⋮⋮ | `क`  | → | /ka/ | | inherent vowel | ✎ 🗑 |

- Row click → edit dialog.
- "+ Add grapheme" button at bottom.
- Empty state: "No graphemes defined yet. Add the first one to build the orthography."
- Drag commits on drop via the reorder endpoint; no explicit save.

**Drag-reorder is required, not optional.** 1D flat tables with meaningful grouping (digraphs near base letters, syllabary rows in gojūon order) are unusable without it.

### Edit dialog

Fields:

- `grapheme` — `<Input>`, case-sensitive, multi-char allowed
- **Phoneme sequence** — ordered multi-select. Reuse the same Select primitive from Phase 1, but render as a horizontal chip row with drag-reorder and an "+ add phoneme" button at the end. Empty row = silent. Each chip labeled `/{ipa}/` with type as tooltip.
- `romanization` — `<Input>`, optional
- `environment` — `<Input>`, hint "e.g. 'before front vowels', 'word-initial', 'isolated form'"
- `notes` — `<Input>`
- Footer: Save / Cancel; Delete and Duplicate when editing

Reuses every Phase 1 polish mechanism: dirty tracking + confirm-on-discard, Enter-to-save, Save disabled when grapheme empty, Duplicate clears `editingId`, undo-delete toast via `pushUndoable`.

### Phoneme-editor integration (required, not optional)

In the Phase 1 phoneme edit dialog, add a read-only "Written as" section listing graphemes whose join points to this phoneme:

> **Written as:** `th`, `Th` (word-initial) — [edit](…)

This is the discoverability bridge between Phase 1 and Phase 2. Without it, users build a phoneme inventory and never find the orthography editor unless they read docs. Promoting this from "optional 15-min polish" to required scope is the single highest-leverage call in this plan.

---

## Seed data

`scripts/seed-orthography.sql` — populate Oncerhan's orthography. Idempotent via the same `DO $$ DECLARE` pattern as `seed-phonology.sql`. Seed at least one multi-phoneme grapheme (even if Oncerhan is Latin-script, seed a token `{{` → /ʔa/ or similar test case) so the many-to-many path is exercised end-to-end against real data, not just tests.

---

## Tests

- **`graphemes` API**
  - Zod rejects bad payloads
  - Transaction rollback when any `phonemeId` fails the same-language check
  - Empty `phonemeIds` accepted (silent)
  - Multi-phoneme sequence preserves `position` order through round-trip
- **Reorder endpoint** — order array must exactly cover the language's graphemes; rejects partial or foreign ids
- **`loadOrthography`** — sort_order respected, empty join renders as silent, multi-phoneme sequence folds in position order
- **`extractCollectionRefs`** — add an `{{orthography|X}}` case
- **Phoneme delete cascade** — deleting a phoneme leaves its graphemes intact with empty join; integration test

### Manual end-to-end (`npm run dev`)

1. `/wordbook/oncerhan/orthography` → empty state.
2. Add `th` → [/θ/] → appears in table.
3. Add `c` → [/k/] environment "before a/o/u"; add `c` → [/s/] environment "before e/i"; both rows coexist.
4. Add `h` → [] environment "word-initial"; IPA column shows `—`.
5. Add `か` → [/k/, /a/]; IPA column renders `/ka/`. Reorder the phoneme chips in the dialog, save, confirm order persists.
6. Drag-reorder rows in the main table; reload, confirm persistence.
7. Edit a grapheme, change phoneme sequence, save; table updates.
8. Delete a grapheme → undo toast → Undo → row restored (new id, sequence preserved).
9. Create a Know page containing `{{orthography|oncerhan}}` → renders server-side.
10. Navigate to phonology, delete a phoneme linked to graphemes → toast reads "N graphemes became silent"; orthography table shows `—` for those rows.
11. Open a phoneme edit dialog; "Written as" section lists graphemes pointing to it.

---

## Critical files

**New:**
- `drizzle/NNNN_graphemes.sql`
- `src/lib/renderer/structured/OrthographyTable.svelte`
- `src/lib/components/phonology/GraphemeEditor.svelte`
- `src/lib/components/phonology/PhonemeSequenceInput.svelte` (the ordered chip-row picker)
- `src/routes/wordbook/[language]/orthography/+page.server.ts`
- `src/routes/wordbook/[language]/orthography/+page.svelte`
- `src/routes/api/languages/[slug]/graphemes/+server.ts`
- `src/routes/api/languages/[slug]/graphemes/[id]/+server.ts`
- `src/routes/api/languages/[slug]/graphemes/reorder/+server.ts`
- `scripts/seed-orthography.sql`

**Modified:**
- `src/lib/server/db/schema.ts` — `graphemes` and `grapheme_phonemes` tables
- `src/lib/server/structured-data.ts` — `loadOrthography`, register in `COLLECTION_RESOLVERS`
- `src/lib/parser/index.ts` — add `'orthography'` to `COLLECTION_TEMPLATE_NAMES`
- `src/lib/templates/registry.ts` — register `'orthography'` builtin
- `src/lib/components/phonology/PhonemeEditor.svelte` — "Written as" read-only section
- `src/routes/wordbook/[language]/+page.svelte` — "Orthography" link next to Phonology

---

## Out of scope

- **CarveCraft scripts / PUA glyph palettes / custom font upload** — Phase 3. The `grapheme` column already accepts PUA characters; we just don't offer a palette or load fonts.
- **Input methods / typing-based auto-transliteration** — Phase 4. The orthography table is *documentation*, not a live converter. State this in the editor description so users don't expect IME behavior.
- **Dialect orthography overlays** — deferred with dialect phonology overlays.
- **Cross-language orthography comparison** — Phase 5.
- **Abugida base-plus-diacritic composition UI sugar** — Phase 3+. The current schema *represents* abugidas correctly (`क` and `कि` as independent graphemes each with their own phoneme sequence), but doesn't offer a "base + vowel mark" authoring shortcut. Users enumerate the syllables manually.
- **Conjunct consonant ligatures** (Devanagari क्ष) — same as above; users add each conjunct as its own grapheme row.

---

## Effort estimate

| Task | Time |
|---|---|
| Schema + migration (two tables, indexes) | 30 min |
| API: CRUD + reorder + same-language batch check | 1h 15min |
| Resolver (two-query fold) + parser + template registration | 30 min |
| `PhonemeSequenceInput.svelte` (reorderable chip picker) | 1h 30min |
| `OrthographyTable.svelte` renderer | 1h |
| Editor route + page shell | 30 min |
| `GraphemeEditor.svelte` + drag-reorder + edit dialog | 4h |
| `PhonemeEditor.svelte` "Written as" section | 30 min |
| Seed script | 20 min |
| Tests | 1h 15min |
| Manual verification | 30 min |

**Total: ~11–13 hours.** Larger than a naive single-FK plan (~7h) because of the many-to-many join, the sequence-picker component, and reorder UX being in-scope from day one. The alternative — ship the alphabet-only schema and migrate later — costs more: schema migrations against live data, editor rework, and a second round of undo-delete semantics. Pay the cost once.

---

## Design calls — positions, not hedges

1. **Grapheme→phoneme is many-to-many ordered.** Syllabaries, abugidas, and featural blocks are first-class.
2. **Silent = empty join, not nullable FK.** Cleaner semantics, no NULL branch in the renderer.
3. **Phoneme delete cascades link rows; orthography rows survive as silent.** Undo-delete does not auto-relink — the toast tells the user how many graphemes became silent.
4. **Drag-reorder is required.** 1D tables without it are unusable at realistic sizes.
5. **Suppress both romanization and environment columns when no row uses them.** Keeps alphabet tables tight.
6. **Duplicate grapheme strings are allowed and intentional.** Context-dependent mappings (`c` → /k/, `c` → /s/) are two rows by design; no unique constraint.
7. **"Written as" section on the phoneme editor is required, not optional.** Sole discoverability bridge between Phase 1 and Phase 2.
8. **Orthography is documentation, not transliteration.** Stated in the editor description; transliteration UX is Phase 4.

# KnowThing: Structured Worldbuilding Data

> **The thesis:** MediaWiki treats everything as flat documents. KnowThing treats everything as structured, queryable, interconnected data that *renders* as documents. You don't describe your world in markup — you define it in structured data and the documentation writes itself.

This document lays out the full vision for KnowThing's structured data systems and how they interconnect. It covers phonology, orthography, custom scripts (CarveCraft), and the template bridge that surfaces structured data on wiki pages.

---

## Architecture Overview

KnowThing has four top-level sections. Each is useful alone. Together they form a worldbuilding platform where data flows between systems.

```
KnowThing
├── Know        Wiki articles — narrative documentation
├── Wordbook    Languages, words, inflections, phonology, graphemes
├── CarveCraft  Scripts, glyphs, fonts, input methods
└── Calendar    Time systems, months, eras, events
```

**Data flows downward into Know.** Wiki articles pull live structured data from Wordbook, CarveCraft, and Calendar via templates. Edit a phoneme in Wordbook, and every wiki article referencing that language's consonant table updates automatically.

### How the Sections Relate

```
CarveCraft                    Wordbook                     Calendar
(scripts & glyphs)            (languages & words)          (time systems)
       │                             │                          │
       │  script_id                  │                          │
       └──────────► Language ◄───────┘                          │
                        │                                       │
                   Graphemes                                    │
                   (bridge: glyph ↔ phoneme)                    │
                        │                                       │
                        ▼                                       ▼
                ┌─────────────────────────────────────────────────┐
                │                    Know                         │
                │  {{consonants|Oncheran}}  → phoneme grid        │
                │  {{orthography|Oncheran}} → glyph/IPA table     │
                │  {{lang|oncheran|...}}    → custom font render  │
                │  {{date|...}}            → calendar formatting  │
                └─────────────────────────────────────────────────┘
```

A **script** is not owned by a single language. Latin serves dozens of languages; a conworld's proto-script gets inherited and forked by descendant cultures. Scripts live in CarveCraft. Languages in Wordbook *reference* a script — that's a relationship, not a hierarchy.

**Graphemes are the bridge.** They sit between CarveCraft (what symbols exist) and Wordbook (what sounds exist), defining how *this specific language* maps *this script's symbols* to *its sounds*. Two languages sharing a script will have different grapheme mappings.

```
CarveCraft Glyph  ◄──  Grapheme  ──►  Wordbook Phoneme
U+E003 (tha)           "th" → /θ/      /θ/ (dental fricative)
```

---

## Data Model

### Phonemes (Wordbook)

The sounds a language has. Each phoneme carries articulatory features that determine its position in the standard linguistics grids (manner × place for consonants, height × backness for vowels).

```
phonemes
  id            serial PK
  language_id   FK → languages
  ipa           text        -- "/p/", "/θ/", "/ks/"
  type          text        -- 'consonant' | 'vowel' | 'diphthong' | 'special'

  -- Consonant features (null for vowels)
  place         text        -- "bilabial", "alveolar", "alveolo-palatal", "uvular", etc.
  manner        text        -- "nasal", "plosive", "fricative", "approximant", etc.
  subtype       text        -- null | "plain" | "tense" | "aspirated" (for Korean-style sub-rows)
  voicing       text        -- 'voiced' | 'voiceless' | null

  -- Vowel features (null for consonants)
  height        text        -- "close", "mid", "open"
  backness      text        -- "front", "central", "back"
  rounded       boolean

  notes         text        -- Footnote: "only at end of syllable", allophonic rules
  sort_order    integer
```

**Key design decisions:**

- **Place/manner/height/backness are freeform text, not enums.** Languages invent categories. Japanese has "Special moras." Korean has "Alveolo-palatal." A fixed enum would break on the first creative conlang. The renderer derives grid axes from the distinct values present in the data.
- **Subtype handles sub-rows.** Korean's Plosive/Affricate splits into plain/tense/aspirated. Rather than duplicating manner values, `subtype` creates nested rows within a manner group.
- **Notes are per-phoneme footnotes.** These are essential in real phonology tables — allophonic rules, positional variants, merger notes. Rendered as superscript references below the grid.
- **IPA can be multi-character.** `/ks/` for clusters, `/t͡ʃ/` for affricates.

### Graphemes (Wordbook, bridging to CarveCraft)

The mapping between writing and sound. Each grapheme connects a written form (one or more characters) to a phoneme.

```
graphemes
  id            serial PK
  language_id   FK → languages
  grapheme      text        -- "th", "x", "ㅂ", or PUA: "\uE003"
  phoneme_id    FK → phonemes (nullable — silent letters, punctuation)
  romanization  text        -- "th", "p" (required for non-Latin scripts, optional otherwise)
  environment   text        -- "before front vowels", "word-initial" (nullable)
  notes         text        -- Footnote text
  sort_order    integer
```

**Key design decisions:**

- **Grapheme is a string, not a single character.** Digraphs ("th", "ch"), trigraphs ("sch"), and multi-codepoint sequences are first-class.
- **Environment handles context-dependent mappings.** The letter "c" → /k/ before a,o,u but /s/ before e,i. Two grapheme rows, same grapheme string, different phoneme IDs, different environment values.
- **Romanization is the Latin-script fallback.** Optional for Latin-script languages. Essential for custom scripts (CarveCraft), Hangul, Cyrillic, etc. Also drives the input method — type the romanization, get the glyph.
- **Nullable phoneme_id** for silent letters, punctuation, numerals — graphemes that exist in the script but don't map to a sound.

### Scripts (CarveCraft)

A writing system as a standalone entity, independent of any specific language.

```
scripts
  id            serial PK
  name          text unique -- "Oncheran Script", "Imperial Runes"
  slug          text unique
  script_type   text        -- 'alphabet' | 'abugida' | 'syllabary' | 'logographic' | 'abjad'
  direction     text        -- 'ltr' | 'rtl' | 'ttb'
  description   text
  page_slug     text        -- FK-like link to a Know wiki page
  created_at    timestamptz
  updated_at    timestamptz
```

### Glyphs (CarveCraft)

Individual symbols in a script. For custom (PUA-based) scripts, each glyph is assigned a Unicode Private Use Area code point.

```
glyphs
  id            serial PK
  script_id     FK → scripts
  name          text        -- "letter tha", "vowel sign a"
  codepoint     text        -- "U+E003" (PUA assignment)
  character     text        -- "\uE003" (the actual character for storage/rendering)
  category      text        -- 'consonant' | 'vowel' | 'modifier' | 'punctuation' | 'numeral'
  sort_order    integer

  -- For scripts with positional variants (Arabic-style)
  initial_form  text        -- nullable, alternate glyph in word-initial position
  medial_form   text        -- nullable, alternate glyph in word-medial position
  final_form    text        -- nullable, alternate glyph in word-final position
```

**PUA ranges:** Unicode reserves U+E000 through U+F8FF (6,400 code points) on the BMP, plus U+F0000–U+FFFFD and U+100000–U+10FFFD for supplementary PUA. 6,400 BMP slots is enough for any single script. Multiple scripts can share or partition the range.

### Script Fonts (CarveCraft)

Font files that make PUA code points render as custom glyphs.

```
script_fonts
  id            serial PK
  script_id     FK → scripts
  font_name     text        -- CSS font-family name: "Oncheran Script"
  font_file     text        -- filename in uploads: "oncheran-script.woff2"
  unicode_range text        -- "U+E000-E040" (for CSS unicode-range)
  weight        text        -- 'normal' | 'bold' (nullable)
  style         text        -- 'normal' | 'italic' (nullable)
  uploaded_at   timestamptz
```

**CSS generation:** The layout dynamically generates `@font-face` declarations for scripts with uploaded fonts. The `unicode-range` property ensures browsers only download the font when PUA characters are actually present on the page — zero cost otherwise.

```css
@font-face {
  font-family: 'Oncheran Script';
  src: url('/api/media/fonts/oncheran-script.woff2') format('woff2');
  unicode-range: U+E000-E040;
}
```

### Language ↔ Script Link

The existing `languages` table in Wordbook gains a foreign key to CarveCraft:

```
languages (existing, modified)
  ...existing columns...
  script_id     FK → scripts (nullable — null means standard Unicode script)
```

The existing `script` text column ("Latin", "Cyrillic") remains for languages using standard scripts. `script_id` links to CarveCraft for custom scripts. Both can coexist.

---

## Rendering on Wiki Pages

### Template Dispatch

The existing WikiTemplate.svelte has a 6-tier dispatch chain. Structured data templates slot into tier 4 (built-in templates), each dispatching to a dedicated Svelte component:

```
{{consonants|Oncheran}}         → PhonemeGrid.svelte (type=consonant)
{{vowels|Oncheran}}             → PhonemeGrid.svelte (type=vowel)
{{orthography|Oncheran}}        → OrthographyTable.svelte
{{phonology|Oncheran}}          → Full phonology section (consonants + vowels + notes)
{{lang|oncheran|...}}           → Inline text with custom font class
{{script-sample|Oncheran}}      → CarveCraft glyph inventory display
```

### Server-Side Data Loading

Templates that pull structured data need that data available at render time. Since rendering is SSR, this means loading phonology/grapheme/script data in the page server load function.

**Approach:** When loading a wiki page, scan the AST for structured-data templates (`consonants`, `vowels`, `orthography`, etc.), extract the language slugs referenced, batch-query the required data, and pass it via the render context.

```typescript
// In +page.server.ts load function (pseudocode)
const ast = parseWikitext(page.content)
const languageSlugs = extractStructuredDataRefs(ast)  // find {{consonants|X}}, etc.
const phonologyData = await loadPhonologyForLanguages(languageSlugs)
// Pass via context for WikiTemplate to consume
```

This avoids client-side fetch waterfalls and ensures SSR works.

### Consonant/Vowel Grid Rendering

The consonant grid groups phonemes by manner (rows) × place (columns). Axes are derived from the data — no hardcoded list of places or manners.

```
SELECT ipa, place, manner, subtype, voicing, notes
FROM phonemes
WHERE language_id = ? AND type = 'consonant'
ORDER BY sort_order
```

Renderer:
1. Collect distinct `place` values → column headers, ordered by sort_order
2. Collect distinct `manner` + `subtype` pairs → row headers
3. Place each phoneme in its cell. Empty cells are valid (sparse grid).
4. Voiced/voiceless pairs share a cell (like Wikipedia's convention).
5. Footnotes rendered below the grid with superscript references.

Same logic for vowels with height (rows) × backness (columns).

### Orthography Table Rendering

```
SELECT g.grapheme, g.romanization, p.ipa, g.environment, g.notes
FROM graphemes g
LEFT JOIN phonemes p ON g.phoneme_id = p.id
WHERE g.language_id = ?
ORDER BY g.sort_order
```

Columns: **Script** | **Romanization** | **IPA** | **Environment**

If the language has a CarveCraft custom script, the Script column renders in the custom font via CSS class. Romanization column always renders in the default font.

### Custom Font Rendering

When a language has a `script_id` pointing to CarveCraft:

1. `@font-face` is injected for that script's font (with `unicode-range`)
2. A CSS class `.script-{slug}` applies the font-family
3. `{{lang|oncheran|...}}` wraps content in that class
4. Wordbook entry displays use the class automatically
5. Orthography table grapheme column uses the class

---

## Input Method for Custom Scripts

When editing content in a language with a custom script, users need to be able to type characters that don't exist on any keyboard.

### Virtual Keyboard

A click-to-insert glyph palette, shown in the editor when the target language has a CarveCraft script. The palette IS the glyph table — pulled directly from CarveCraft data. Click a glyph, it inserts the PUA character at the cursor.

### Romanization IME

More ambitious, but far more usable. The grapheme table already contains romanization → glyph mappings. This doubles as an input method definition:

1. User types `th` in the editor
2. IME consults grapheme table: `romanization: "th"` → `grapheme: "\uE003"`
3. Auto-converts to PUA character, rendered in custom font

This is exactly how Korean (Hangul) and Japanese (Romaji) IMEs work — the user types Latin characters and the system converts based on mapping rules. The difference is that KnowThing generates the IME from your grapheme data automatically.

### Fallback

PUA characters are stored in the database. If the custom font fails to load, the user sees empty boxes — so romanization tooltips on hover are essential for resilience.

---

## CarveCraft Dashboard

```
/carvecraft                           Script gallery
/carvecraft/create                    Create new script
/carvecraft/[script]                  Script overview, glyph inventory, font preview
/carvecraft/[script]/glyphs           Glyph editor — define symbols, assign PUA codes
/carvecraft/[script]/font             Font file upload and management
/carvecraft/[script]/preview          Full character chart with all glyphs rendered
```

### Glyph Editor

Grid interface for defining a script's symbols. Each row:
- **Name** — "letter tha", "vowel sign i"
- **PUA code point** — auto-assigned sequentially or manually chosen
- **Category** — consonant / vowel / modifier / punctuation / numeral
- **Positional variants** — initial, medial, final forms (for scripts like Arabic)

### Font Upload

Upload .woff2 files. The system validates that the font covers the PUA code points defined in the glyph table. Preview renders all glyphs in the uploaded font.

---

## Wordbook Phonology Dashboard

```
/wordbook/[language]/phonology        Phoneme inventory editor
/wordbook/[language]/orthography      Grapheme mapping editor
```

### Phoneme Editor

**Input model: IPA picker, not feature dropdowns.** Don't make the user construct a phoneme from dropdowns (place + manner + voicing) — show the actual IPA chart as a clickable grid. User clicks a symbol, features auto-populate.

The IPA chart is a finite, well-defined grid (~200 symbols). A static JSON lookup maps every symbol to its features. The picker renders it as a styled interactive chart with sections for:

- Pulmonic consonants (the standard manner × place grid)
- Affricates (t͡s, d͡z, t͡ʃ, d͡ʒ, etc.)
- Non-pulmonic consonants (clicks, implosives, ejectives)
- Co-articulated consonants (k͡p, ɡ͡b, ɫ, etc.)
- Vowels (height × backness)
- Diphthongs

**Flow:** Click symbol → IPA + features auto-fill → features are editable for grid placement override → add.

**Fantasy sound checkbox** disables the picker and switches to manual entry — type any IPA string, manually set features for grid placement. For conlang-specific sounds that don't exist in natural language.

**Why not dropdowns:** The IPA doesn't decompose cleanly into independent features. Affricates have two manners (stop + fricative). Co-articulated consonants have two places. Denti-alveolars fall between place categories. A dropdown form can't represent these without becoming a monster. The chart IS the standard UI — every linguistics textbook uses it.

**Feature fields are freeform text, not enums.** If a conlang needs "denti-alveolar" or "labial-velar" as a place, they edit the auto-filled value. The grid renderer derives its columns from whatever values are present in the data, so custom values just work.

### Grapheme/Orthography Editor

Mapping editor connecting script symbols to phonemes:

- Select a grapheme (type it, or pick from CarveCraft glyph palette)
- Link to a phoneme from this language's inventory
- Add romanization, environment, notes
- Preview renders the orthography table in real time

---

## Dialects and Phonology

**Open design question.** The Wordbook already has `languageDialects` (name, slug, region, description) used for lexicon variants. But dialects also affect phonology — how do we model that?

### How Dialects Affect Sound Inventories

Dialects rarely have completely different phoneme inventories. The changes are usually:

- **Mergers** — Two sounds collapse into one. /ɑ/ and /ɔ/ merge (cot-caught merger). The phoneme exists in the base language but this dialect doesn't distinguish it.
- **Splits** — One sound becomes two in certain contexts.
- **Shifts** — A phoneme moves to a different articulation. The "slot" is the same but the realization changes (e.g., /a/ → [æ]).
- **Additions** — The dialect has a sound the standard language lost or never had.
- **Losses** — The dialect drops a sound entirely.

### Recommended Approach: Dialect Overlays

Phonemes belong to the language (the base/standard inventory). Dialects store *differences from the base* — a thin overlay table.

```
dialect_phoneme_overrides
  id
  dialect_id     FK → languageDialects
  phoneme_id     FK → phonemes (the base language phoneme)
  status         'merged' | 'shifted' | 'added' | 'lost'
  realization    text    -- actual IPA in this dialect (e.g., /æ/ instead of /a/)
  merged_into_id FK → phonemes (nullable — which phoneme it merged with)
  notes          text    -- "before front vowels", "word-final only"
```

**Example:** Base Oncheran has /θ/ and /ð/. The Eastern dialect override: `/θ/ merged into /s/`.

**Why overlays, not per-dialect inventories:** No data duplication. The base inventory is the source of truth. Differences are explicit and queryable ("which dialects lost /θ/?"). Updates to the base propagate automatically.

**Rendering:**

- Default view: base language phonemes
- Dialect view: base phonemes with overrides applied — merged sounds grayed out, shifted sounds showing dialect realization, added sounds highlighted
- Comparison view: side-by-side diff

**Wiki templates:**
```
{{consonants|Oncheran}}                   ← base inventory
{{consonants|Oncheran|dialect=Eastern}}   ← with dialect overrides applied
```

**Implementation note:** This is an additive schema change — the overlay table doesn't modify the existing phonemes table. Build it when dialect-level phonology is actually needed, not before. Nothing in the current phoneme design prevents it.

---

## Phase Plan

### Phase 1: Phonemes — Sound Inventory

**Goal:** Define what sounds a language has. Render consonant and vowel grids on wiki pages.

**Schema changes:**
- Create `phonemes` table

**Backend:**
- API endpoints: CRUD for phonemes (`/api/languages/[slug]/phonemes`)

**Frontend:**
- Phoneme editor UI on `/wordbook/[language]/phonology`
- `PhonemeGrid.svelte` renderer component (manner × place / height × backness)

**Wiki integration:**
- `{{consonants|Language}}` and `{{vowels|Language}}` templates
- Server-side data loading in page load function
- New dispatch case in WikiTemplate.svelte

**This phase is useful immediately.** Even without custom scripts or orthography tables, the phoneme inventory grid is the most common phonology display on any language wiki page.

### Phase 2: Graphemes — Orthography Mapping

**Goal:** Define how sounds map to written characters. Render orthography tables on wiki pages.

**Schema changes:**
- Create `graphemes` table

**Backend:**
- API endpoints: CRUD for graphemes (`/api/languages/[slug]/graphemes`)

**Frontend:**
- Grapheme editor UI on `/wordbook/[language]/orthography`
- `OrthographyTable.svelte` renderer component

**Wiki integration:**
- `{{orthography|Language}}` template
- Extend server-side data loading to include graphemes

**This phase handles Latin-script conlangs fully.** Digraphs, clusters, context-dependent mappings, footnotes — all covered without needing CarveCraft. The grapheme field stores plain Latin characters.

### Phase 3: CarveCraft — Custom Scripts

**Goal:** Define custom writing systems with PUA glyphs and custom fonts.

**Schema changes:**
- Create `scripts`, `glyphs`, `script_fonts` tables
- Add `script_id` FK to `languages`

**Backend:**
- API endpoints: CRUD for scripts, glyphs, font upload
- Dynamic `@font-face` CSS generation

**Frontend:**
- CarveCraft dashboard: script list, glyph editor, font upload, preview
- Top-level navigation entry alongside Know, Wordbook, Calendar
- CSS class injection for custom font rendering

**Wiki integration:**
- `{{lang|language|...}}` applies custom font class when script exists
- Orthography table grapheme column renders in custom font
- `{{script-sample|Script}}` template for displaying full glyph inventory

### Phase 4: Input Methods

**Goal:** Enable typing in custom scripts within the wiki editor and wordbook forms.

**Frontend:**
- Virtual keyboard component (glyph palette from CarveCraft data)
- Integration with CodeMirror editor
- Language selector in editor that activates the appropriate keyboard

**Advanced (optional):**
- Romanization-based IME using grapheme table as transliteration rules
- Auto-conversion as user types

### Phase 5: Cross-System Queries

**Goal:** Templates that query across the structured data layer.

**Wiki templates:**
- `{{languages-with-phoneme|/θ/}}` — list languages containing a phoneme
- `{{cognates|word|Language}}` — pull lexicon relations across languages
- `{{inflection-summary|Language}}` — paradigm class overview from Wordbook
- `{{lexicon-stats|Language}}` — word count by POS, coverage metrics
- `{{language-tree|Language}}` — ancestry visualization from structured data
- `{{script-comparison|Script1|Script2}}` — side-by-side glyph comparison

**Backend:**
- Generic structured query executor for template expansion
- Potential `{{#query:...}}` syntax for ad-hoc queries in wikitext

This phase is where the "data writes the documentation" vision fully materializes.

---

## What Makes This Novel

No existing platform does all of this:

- **MediaWiki/Wikipedia** — Flat documents. Phonology tables are hand-maintained wikitext. No structured data without the Wikibase extension (which is a separate massive system). No custom font support.
- **ConWorkShop** — Has phoneme inventories and script tools, but no wiki integration. Features are isolated. No "edit the phoneme, wiki updates automatically."
- **Wiktionary** — Linguistic data trapped in templates and Lua modules. Not queryable. No relational model.
- **World Anvil / Campfire** — Worldbuilding tools with wiki-like features but no deep linguistic or script modeling.

KnowThing's advantage: **the structured data systems (Wordbook, CarveCraft, Calendar) feed directly into the documentation layer (Know).** Define your world's languages, scripts, and time systems as structured data. Write articles that reference them. The articles stay current because they render from live data, not static markup.

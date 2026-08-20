# Phase 0 Audit — Monster Migration Baseline

**Status:** Historical database snapshot; not current implementation guidance

Captured 2026-05-08 against prod (`knowthing-db-1`).

## 1. content_records by domain

| Domain | Records | Bytes | Last update |
|---|---|---|---|
| know | 44 | 34,068 | 2026-05-08 |
| celestial | 10 | 6,555 | 2026-05-08 |
| calendar | 2 | 0 | 2026-03-31 |

Total 56 records. Calendar is empty (zero size) — both rows are stub records auto-created by `createCalendar`.

## 2. pageSlug glue references (15 total)

All pageSlug → content_records joins (case-insensitive on slug):

| Table | Entity slug | pageSlug | Resolves to |
|---|---|---|---|
| stars | sun | `Sun` | celestial |
| stars | therne | `Therne` | celestial |
| star_systems | sunly | `Sunly_system` | celestial |
| languages | classical-myreni | `Classical_Myreni` | know |
| languages | krelitseran | `krelitseran_language` | know |
| languages | nilscoddish | `nilscoddi_language` | know |
| languages | oncheran | `Oncheran_language` | know |
| languages | proto-mira | `proto-mira_language` | know |
| languages | mazarean | `mazarean_language` | **DANGLING** |
| lexicon | Krėlıtse | `Krelitser` | know |
| lexicon | Nilscodd | `Nilscodd` | know |
| lexicon | Ontssera | `Onchera` | know |
| lexicon | Rabekareta | `Rabekareta` | know |
| lexicon | Tornamm | `Tornamm` | know |
| lexicon | kıraŧar | `Kıraŧar` | **DANGLING** |

**Findings:**
- 2 dangling pageSlug references (mazarean language, kıraŧar word) — pageSlug points to a content_records row that doesn't exist.
- Celestial entities already use the `celestial` domain on content_records (Phase 4 migration extracts prose from this domain, not from `know`).
- Wordbook entities (languages + lexicon) still have prose in the `know` domain — Phase 5 migration extracts from there.
- No countries, planetary_bodies, or world_maps have pageSlug set.

**Migration script implications:**
- Phase 4 extractor: read from `domain='celestial'` for stars/planets/systems.
- Phase 5 extractor: read from `domain='know'` for languages/lexicon, with case-insensitive slug match.
- Migration must skip (or log + warn) on the 2 dangling references, not error.

## 3. Slug collisions (Know vs structured entities)

4 collisions found, all lexicon vs Know:

| Kind | Structured slug | Know slug | Title |
|---|---|---|---|
| lexicon | Nilscodd | nilscodd | Nilscodd |
| lexicon | Rabekareta | rabekareta | Rabekareta |
| lexicon | Tornamm | tornamm | Tornamm |
| lexicon | elekoneta | Elekoneta | Elekoneta |

The first three are the same identifier as the lexicon entry's `pageSlug` — that's the existing shadow article that holds prose. Post-Phase-5, these go away (prose moves into `lexicon.body`, the Know article is deleted).

`elekoneta` is a soft collision — the lexicon row has no `pageSlug` (so no shadow link is declared), but a Know article also exists with that title. Will likely need manual resolution: either merge the Know prose into the lexicon row, or rename the Know article.

**Phase 9 lockdown implication:** the slug-collision check (`assertNoNamespaceCollision`) will refuse to create a Know slug that matches a structured slug. After Phase 5 migration, this should pass clean — confirm before enabling the check.

## 4. Infobox `from=` template usages

Only 2 in production:

| domain:slug | template | from= |
|---|---|---|
| celestial:Therne | Infobox star | `from=therne` |
| celestial:sun | Infobox star | `from=the-sun` |

**`from=the-sun` is broken** — no star with slug `the-sun`. Actual star slug is `sun`. Likely a stale reference left over from an earlier rename. Phase 4 migration script must either:
- Fix the broken arg before extracting prose (rewrite `from=the-sun` → `from=sun` in the wikitext when copying to `stars.body`), or
- Leave it broken and let the new `{{Celestial:Sun}}` form be used post-migration. Since the entity now owns its own page, the embed inside its own prose is redundant anyway — Phase 4 migration could strip the leading infobox call from extracted prose entirely.

## 5. Wikilink prefix distribution

| Prefix | Occurrences | Distinct targets |
|---|---|---|
| (no prefix) | 244 | 173 |
| Category: | 2 | 2 |
| File: | 1 | 1 |
| Image: | 1 | 1 |

**No `[[domain:target]]` style links in prod content** — the `domain_link` AST node was supported but never used. Confirms it can be deprecated cleanly in Phase 9 with no rewriting of existing content. Wordbook subpath links (`[[Wordbook/lang/word]]`) and the legacy `wb:` form also don't appear — no rewriting needed.

The 244 bare-target links currently resolve via cross-domain fallthrough; under the new model they'll route through the same fallthrough but with structured tables also probed.

## 6. Templates in use

| Template | Occurrences | Notes |
|---|---|---|
| ipa | 6 | Inline parser function — unaffected by migration |
| infobox country | 5 | `countries` table exists, has `pageSlug` (NOT NULL). Embed works post-migration. |
| infobox country (\\r variant) | 2 | Same as above; trailing CR from Windows line endings |
| infobox star | 2 | Phase 4 covers |
| infobox settlement | 3 | **No structured table.** Stays as legacy wikitext infobox. |
| infobox royalty | 2 | **No structured table.** Stays legacy. |
| infobox language | 1 | Wordbook covers in Phase 5 |
| infobox religion | 1 | **No structured table.** Stays legacy. |
| infobox officeholder | 1 | **No structured table.** Stays legacy. |
| vowels, consonants | 2 each | Wordbook collection embeds; already structured |

**Implication:** The legacy `{{Infobox X|...}}` path in `WikiTemplate.svelte` cannot be removed in Phase 9 unless settlement/royalty/religion/officeholder either (a) get their own structured domains, or (b) have their inline-arg infobox calls preserved as-is. Recommend (b): keep the legacy parser path indefinitely for hand-authored infoboxes that don't have structured backing. Phase 9 only removes `{{Infobox X|from=slug}}` resolution, not the inline-arg path.

## 7. Link graph health

| target_domain | links | resolved | unresolved |
|---|---|---|---|
| know | 158 | 62 | 96 |
| celestial | 39 | 8 | 31 |

127/197 (64%) of all wikilinks are unresolved (red links). High but not unusual for an early-stage worldbuilding wiki. Migration must preserve unresolved state — Phase 4/5 link repointing only updates rows where the target actually moves; redlinks stay redlinks.

## 8. Numbers to expect after Phases 4 + 5

| Metric | Before | After (expected) |
|---|---|---|
| content_records.know | 44 | 44 − 5 (languages) − 5 (lexicon shadows) − ~1 (`Elekoneta` merge?) = ~33 |
| content_records.celestial | 10 | 0 (all extracted to stars/planets/systems body) |
| content_records.calendar | 2 | 0 (Phase 6 strips them) |
| content_records (total) | 56 | ~33 |
| Tables with `pageSlug` | 6 | 0 (dropped Phase 9) |
| `entity_revisions` rows | 0 | sum of moved `content_revisions` (need separate query to count) |

## 9. Open questions to resolve before Phase 4

1. **`from=the-sun` broken arg**: fix in migration, or leave broken and let new embed form supersede? Recommend strip leading entity-self-reference infobox during prose extraction.
2. **`elekoneta` soft collision**: manual triage required. Inspect both rows before Phase 5 migration runs.
3. **Wordbook pageSlug capitalization**: pageSlug values are TitleCase (`Oncheran_language`), but lexicon slugs are lowercase or contain unicode (`Krėlıtse`, `kıraŧar`). The new URL is `/Wordbook/Oncheran/Krėlıtse` — confirm the URL builder + matcher handles non-ASCII identifiers (likely yes, modern URL handling is unicode-clean, but needs explicit test).

## Verify command

```sh
ssh -p 1488 debian@51.83.199.99 \
  "docker exec knowthing-db-1 psql -U knowthing -d knowthing -c '<query>'"
```

All Phase 0 queries can be re-run from this command pattern; raw queries archived in this PR's commit history if needed.

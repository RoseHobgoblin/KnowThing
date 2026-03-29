# Code Review Rules

Rules for writing and reviewing code in this codebase. Apply proactively — don't wait to be asked.

## Svelte 5

- Use `$derived` for anything computed from reactive props/state — plain `const` captures initial value only.
- Put stable constants and pure functions in `<script module lang="ts">`.
- Use `useId()` from `bits-ui` for unique IDs (SVG gradients, clip paths) — not module-level counters.
- Side effects in `$effect` must be guarded against re-runs with a flag if they arm promises, start timers, or begin sequences.

## Tailwind / CSS

- Use Tailwind classes over inline styles where possible (`left-1/2` not `style:left="50%"`).
- Icon sizing: use `em`-relative (`size-[1.75em]`) not hardcoded `size-5`.
- Don't use `@apply` for single CSS properties — just write the property directly.
- CSS values derived from props must use CSS custom properties (`style:--var` + `var()` in CSS).
- Don't duplicate CSS custom property hex values in JS — use `var(--color-token-name)`.
- Use existing color tokens from `app.css` `@theme` block — never hardcode hex colors or Tailwind color classes like `bg-amber-600`.

## Component Patterns

- Always key `{#each}` blocks with the most stable unique identifier — never concatenate with loop index.
- Format `{#if}` blocks to multi-line — no one-liner if blocks.
- Follow existing patterns in sibling files — don't invent a new approach in one file.
- Don't shadow outer variables in nested callbacks.
- Use UI primitives from `$lib/components/ui/` (Dialog, ConfirmDialog, Input, Select, Tooltip, TabNavigation, CollapsibleInput, Notifications) — never use raw `confirm()`, `alert()`, or unstyled `<input>`/`<select>` elements.
- Use `pushSuccess()` / `pushError()` from `$lib/notifications.svelte` after every mutation (create, update, delete).

## Code Organization

- Shared constants in a `constants.ts` file if used in 2+ files.
- Extract repeated calculations into module-level helpers.
- Don't repeat derived state across mobile/desktop views — extract a shared component.

## Data Integrity

- Wrap multi-step database mutations in `db.transaction()`.
- Validate all API inputs with Zod schemas before touching the database.
- Return `json({ error: message }, { status: 400 })` on validation failure — never let raw Postgres errors reach the client.

## URL & API

- Use `URLSearchParams` for query strings — never concatenate.
- Always add `headers: { 'Content-Type': 'application/json' }` on JSON fetches.
- Read the actual API response shape — don't guess field names.
- Add loading/disabled state to mutating buttons to prevent double-clicks.

## Defensive Access

- Guard array indexing on async-populated data (`participants[0]?.userId` not `participants[0].userId`).
- Don't rely on `Object.values(map)[0]` iteration order for lookups — use an explicit key.

## Merge / Dead Code

- Combine adjacent `{#if}` blocks checking the same condition.
- Remove unused imports, commented-out code, and write-only variables.
- Never leave `@deprecated` aliases — update callers and delete the alias.

## Cleanup & Lifecycle

- Clear timers/subscriptions on unmount — `onDestroy(() => clearTimeout(timer))`.
- Null out stale state in catch/abort paths of async pipelines.

## DOM & Transitions

- Keep the same DOM element across state changes for CSS transitions to work — swap inner content, not the element.
- Use blank `alt=""` for decorative images.

## Quick Reference

| Instead of | Use |
|---|---|
| `let nextId = 0` (module counter) | `useId()` from `bits-ui` |
| Hardcoded CSS matching a prop | CSS custom property from prop |
| Same constant in 2+ files | Shared `constants.ts` |
| `Object.values(map)[0]` for lookup | Explicit key: `map[knownKey]` |
| Manual query string concat | `new URLSearchParams({...})` |
| Hex color duplicating a CSS var | `var(--color-token-name)` |
| Mutating button without loading guard | `disabled={isLoading}` + try/finally |
| Side effect in `$effect` without re-run guard | Flag variable to ensure one-shot |
| `fetch(POST)` without Content-Type | Add `headers: { 'Content-Type': 'application/json' }` |
| Timer without cleanup | `onDestroy(() => clearTimeout(timer))` |
| State set before `await` without abort cleanup | Null out in catch path |
| `index + len` / `index - len` (wrap) | `((i % n) + n) % n` |
| Raw `confirm()` / `alert()` | `ConfirmDialog` from `$lib/components/ui/` |
| Raw `<input>` / `<select>` | `Input` / `Select` from `$lib/components/ui/` |
| `console.log` in server code | Structured error in API response |
| `body as { field: type }` | Zod schema + `safeParse` |
| Multi-step DB mutation without transaction | `db.transaction(async (tx) => { ... })` |

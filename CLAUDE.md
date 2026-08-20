# Project: KnowThing
SvelteKit 2 with Svelte 5 (runes), Bun 1.4, Elysia, TypeScript strict, Drizzle ORM on PostgreSQL, and Tailwind v4.

## Commands
- `bun install --frozen-lockfile` — install exactly from `bun.lock`
- `bun run dev` — development server
- `bun run test` — Vitest unit tests
- `bun run lint` — ESLint check (includes `eslint-plugin-local/` custom rules)
- `bun run check` — Svelte and TypeScript checks
- `bun run db:migrate` — Drizzle migrations
- `bun run build && bun run start` — production build and Elysia server



## Code Style
- Svelte 5 runes (`$state`, `$derived`, `$effect`) — no legacy reactive syntax
- Tailwind utility classes with custom theme tokens from `src/app.css`
- UI primitives from `$lib/components/ui/` — never raw HTML inputs/selects
- Zod validation on all API inputs before database access
- `db.transaction()` for multi-step mutations

## Guard Rails
- NEVER commit `.env` files
- NEVER let raw Postgres errors reach the client — return `json({ error }, { status })`
- NEVER hardcode hex colors — use `@theme` tokens from `app.css`
- API mutations MUST validate with Zod, use transactions for multi-step writes, and return structured errors


## Prod
- `ssh -p 1488 debian@51.83.199.99` Use it as you need it.

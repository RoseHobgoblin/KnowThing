# Project: KnowThing
SvelteKit 2 with Svelte 5 (runes), TypeScript strict, Drizzle ORM on PostgreSQL, Tailwind v4.

## Commands
- `npm run dev` — dev server
- `npm run test` — Vitest unit tests
- `npm run lint` — ESLint check (includes `eslint-plugin-local/` custom rules)
- `npm run check` — svelte-check type checking
- `npm run db:migrate` — Drizzle migrations



## Code Style
- Svelte 5 runes (`$state`, `$derived`, `$effect`) — no legacy reactive syntax
- Tailwind utility classes with custom theme tokens from `src/app.css`
- UI primitives from `$lib/components/ui/` — never raw HTML inputs/selects
- Zod validation on all API inputs before database access
- `db.transaction()` for multi-step mutations
- See `docs/CODE-REVIEW.md` for detailed review guidelines

## Guard Rails
- NEVER commit `.env` files
- NEVER let raw Postgres errors reach the client — return `json({ error }, { status })`
- NEVER hardcode hex colors — use `@theme` tokens from `app.css`
- API mutations MUST validate with Zod, use transactions for multi-step writes, and return structured errors


## Prod
- `ssh -p 1488 debian@51.83.199.99` Use it as you need it.
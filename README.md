# KnowThing

KnowThing is a SvelteKit 2 / Svelte 5 application backed by PostgreSQL. Bun is
the package manager and production runtime; Elysia owns the HTTP listener and
delegates application routes to SvelteKit.

## Requirements

- Bun 1.4.0
- PostgreSQL 16 (or Docker Compose)

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Copy the required values into `.env` before running database-backed routes.
Useful validation commands are:

```sh
bun run check
bun run test
bun run lint
```

## Production

The application image is built and run with Bun:

```sh
docker compose -f docker-compose.prod.yml up --build -d
```

The container runs migrations before Elysia starts listening. Its health probe
is `GET /healthz`; all other requests pass through the Bun SvelteKit adapter.

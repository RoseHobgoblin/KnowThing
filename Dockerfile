FROM oven/bun:1.4.0-alpine AS build

WORKDIR /app

# Include workspace manifests so Bun can resolve local packages before the
# source-copy layer changes. This keeps dependency installs cacheable.
COPY package.json bun.lock bunfig.toml .npmrc ./
COPY packages/rimecraft/package.json ./packages/rimecraft/package.json
COPY packages/tungolcraft/package.json ./packages/tungolcraft/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --workspaces --if-present build
RUN BETTER_AUTH_SECRET=build-stage-placeholder-only-7f53a91d9c4e2b68 bun run build
RUN bun prune --production

FROM oven/bun:1.4.0-alpine AS runtime

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json /app/bun.lock /app/bunfig.toml ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /app/uploads && chown -R bun:bun /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER bun
EXPOSE 3000

CMD ["bun", "scripts/start.ts"]

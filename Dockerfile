# ── Build stage ──────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Build the workspace packages first. `tungolcraft` exports compiled `./dist`
# (its `dist/` is gitignored, so absent on a clean checkout); without this,
# `vite build` fails with "Failed to resolve entry for package tungolcraft".
RUN npm run build --workspaces --if-present
RUN npm run build
RUN npm prune --omit=dev

# ── Production stage ─────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
# node_modules/{tungolcraft,rimecraft} are workspace symlinks into packages/;
# copy the real dirs so they resolve at runtime rather than dangling.
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=http://localhost:3000

EXPOSE 3000

CMD ["node", "scripts/start.js"]

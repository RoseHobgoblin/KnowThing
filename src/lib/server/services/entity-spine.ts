// ============================================================================
// Entity spine service — compatibility writers (migration 0049, Phase 1).
//
// The spine's identity lifecycle: an entity and its canonical route are
// created in ONE transaction, never separately; renames demote the old
// canonical before inserting the new one; published entities are archived,
// never hard-deleted. Legacy create paths call into here so no spine-less
// rows exist after 0049; rows that predate the spine keep entity_id NULL
// until the backfill phase.
//
// Slugs come from the shared minting path in $lib/utils/slugify.ts —
// NFC → slug rules → store → never recompute.
// ============================================================================

import { error } from '@sveltejs/kit'
import { and, eq, sql } from 'drizzle-orm'
// Type-only: this module never touches the connection singleton — every
// function runs on the executor (usually a transaction) the caller passes in.
import type { db } from '$lib/server/db/index.js'
import { entities, entityRoutes } from '$lib/server/db/schema.js'
import { mintEntitySlug, type RouteNamespace } from '$lib/utils/slugify.js'

export type EntitySpineDatabase = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>

export interface RouteAddress {
	namespace: RouteNamespace
	slug: string
	/** Required for 'wordbook' (the language entity), forbidden elsewhere. */
	scopeEntityId?: number | null
}

export interface CreateEntityInput {
	displayName: string
	namespace: RouteNamespace
	/** Pre-minted canonical slug; defaults to mintEntitySlug(namespace, displayName). */
	slug?: string
	scopeEntityId?: number | null
	/**
	 * Legacy addresses (hyphen-style slugs, old page slugs) preserved as
	 * noncanonical routes → they 301 to the canonical. Best-effort: an alias
	 * already claimed by another address is skipped, never an error.
	 */
	legacySlugs?: string[]
}

function isUniqueViolation(error_: unknown): boolean {
	const code = (error_ as { code?: string } | null)?.code
		?? ((error_ as { cause?: { code?: string } } | null)?.cause?.code)
	return code === '23505'
}

async function findRouteByAddress(dbx: EntitySpineDatabase, address: RouteAddress) {
	const scope = address.scopeEntityId ?? null
	const [route] = await dbx
		.select()
		.from(entityRoutes)
		.where(and(
			eq(entityRoutes.namespace, address.namespace),
			scope === null ? sql`${entityRoutes.scopeEntityId} IS NULL` : eq(entityRoutes.scopeEntityId, scope),
			sql`LOWER(${entityRoutes.slug}) = LOWER(${address.slug})`,
		))
		.limit(1)
	return route ?? null
}

interface AddressLike {
	namespace: string
	slug: string
	scopeEntityId?: number | null
}

function sameAddress(a: AddressLike, b: AddressLike): boolean {
	return a.namespace === b.namespace
		&& (a.scopeEntityId ?? null) === (b.scopeEntityId ?? null)
		&& a.slug.toLowerCase() === b.slug.toLowerCase()
}

/**
 * Add a noncanonical alias route. Skips silently when the address is already
 * taken (by anyone — retired slugs are never reused) or the slug is empty;
 * the address index backstops races.
 */
async function addAliasRoute(dbx: EntitySpineDatabase, entityId: number, address: RouteAddress): Promise<void> {
	const slug = address.slug.trim().normalize('NFC')
	if (!slug) return

	const existing = await findRouteByAddress(dbx, { ...address, slug })
	if (existing) return

	try {
		await dbx.insert(entityRoutes).values({
			entityId,
			namespace: address.namespace,
			scopeEntityId: address.scopeEntityId ?? null,
			slug,
			isCanonical: false,
		})
	} catch (error_) {
		if (!isUniqueViolation(error_)) throw error_
	}
}

/**
 * Mint an entity with its canonical route (and legacy alias routes) — one
 * atomic identity. MUST run inside the caller's transaction so a failed
 * facet insert can't leave a routeless entity or an entityless route.
 */
export async function createEntityWithRoute(
	dbx: EntitySpineDatabase,
	input: CreateEntityInput,
): Promise<number> {
	const displayName = input.displayName.trim()
	const slug = (input.slug ?? mintEntitySlug(input.namespace, displayName)).normalize('NFC')
	if (!slug) throw error(400, 'Cannot derive a URL slug from this name')

	const [entity] = await dbx
		.insert(entities)
		.values({ displayName })
		.returning({ id: entities.id })

	try {
		await dbx.insert(entityRoutes).values({
			entityId: entity.id,
			namespace: input.namespace,
			scopeEntityId: input.scopeEntityId ?? null,
			slug,
			isCanonical: true,
		})
	} catch (error_) {
		if (isUniqueViolation(error_)) {
			throw error(409, `The address "${slug}" is already in use`)
		}
		throw error_
	}

	for (const legacy of input.legacySlugs ?? []) {
		if (legacy.toLowerCase() === slug.toLowerCase()) continue
		await addAliasRoute(dbx, entity.id, {
			namespace: input.namespace,
			scopeEntityId: input.scopeEntityId ?? null,
			slug: legacy,
		})
	}

	return entity.id
}

/**
 * Returns the existing entity id, or mints entity + routes when the facet row
 * predates the spine (entity_id NULL). Compatibility writers call this so
 * touching an old row lazily attaches it.
 */
export async function ensureFacetEntity(
	dbx: EntitySpineDatabase,
	currentEntityId: number | null,
	input: CreateEntityInput,
): Promise<number> {
	if (currentEntityId != null) return currentEntityId
	return createEntityWithRoute(dbx, input)
}

export interface MintOrAttachInput extends CreateEntityInput {
	/** Does this entity already carry the facet being created? (One row per facet table per entity.) */
	hasFacet: (entityId: number) => Promise<boolean>
}

export type MintOrAttachResult =
	| { entityId: number, attached: false }
	| { entityId: number, attached: true }

/**
 * Mint an entity for a new facet row — or ATTACH to an existing one. A country
 * and the know article about it are one referent: when the canonical address
 * is already owned by an active entity that lacks this facet, the new row
 * joins that entity ("Add facet attaches to the same page — no second record
 * or URL"). Anything else — the entity already has the facet, the address is
 * a retired (noncanonical) slug, the owner is archived — is a 409: retired
 * slugs are never reused, and conflicting singleton facets are never
 * silently overwritten.
 */
export async function mintOrAttachFacetEntity(
	dbx: EntitySpineDatabase,
	input: MintOrAttachInput,
): Promise<MintOrAttachResult> {
	const displayName = input.displayName.trim()
	const slug = (input.slug ?? mintEntitySlug(input.namespace, displayName)).normalize('NFC')
	if (!slug) throw error(400, 'Cannot derive a URL slug from this name')

	const existing = await findRouteByAddress(dbx, {
		namespace: input.namespace,
		scopeEntityId: input.scopeEntityId ?? null,
		slug,
	})

	if (existing) {
		const [owner] = await dbx
			.select({ id: entities.id, status: entities.status })
			.from(entities)
			.where(eq(entities.id, existing.entityId))

		const attachable = existing.isCanonical
			&& owner?.status === 'active'
			&& !(await input.hasFacet(owner.id))

		if (!attachable) throw error(409, `The address "${slug}" is already in use`)

		for (const legacy of input.legacySlugs ?? []) {
			if (legacy.toLowerCase() === slug.toLowerCase()) continue
			await addAliasRoute(dbx, owner.id, {
				namespace: input.namespace,
				scopeEntityId: input.scopeEntityId ?? null,
				slug: legacy,
			})
		}
		return { entityId: owner.id, attached: true }
	}

	const entityId = await createEntityWithRoute(dbx, { ...input, displayName, slug })
	return { entityId, attached: false }
}

export interface RepointInput extends RouteAddress {
	/** Sync the display identity in the same step when the rename changed it. */
	displayName?: string
	/** Extra legacy alias to preserve alongside the repoint (old hyphen slug). */
	legacySlugs?: string[]
}

/**
 * Move an entity's canonical route to a new address. The old canonical is
 * DEMOTED to a noncanonical route first (demote-before-insert, or the
 * one-canonical index fires), so the old address keeps 301ing forever —
 * retired slugs are never reused. Returning to an address the entity already
 * owns re-promotes that route instead of inserting a duplicate.
 */
export async function repointCanonicalRoute(
	dbx: EntitySpineDatabase,
	entityId: number,
	input: RepointInput,
): Promise<void> {
	if (input.displayName !== undefined) {
		await dbx
			.update(entities)
			.set({ displayName: input.displayName.trim(), updatedAt: new Date() })
			.where(eq(entities.id, entityId))
	}

	const slug = input.slug.trim().normalize('NFC')
	if (!slug) throw error(400, 'Cannot derive a URL slug from this name')
	const target: RouteAddress = { namespace: input.namespace, slug, scopeEntityId: input.scopeEntityId ?? null }

	const [current] = await dbx
		.select()
		.from(entityRoutes)
		.where(and(eq(entityRoutes.entityId, entityId), eq(entityRoutes.isCanonical, true)))
		.limit(1)

	if (current && sameAddress(current, target)) {
		// Same address, possibly a spelling change (case only) — keep the row.
		if (current.slug !== slug) {
			await dbx.update(entityRoutes).set({ slug }).where(eq(entityRoutes.id, current.id))
		}
	} else {
		const existing = await findRouteByAddress(dbx, target)
		if (existing && existing.entityId !== entityId) {
			throw error(409, `The address "${slug}" is already in use`)
		}

		if (current) {
			await dbx
				.update(entityRoutes)
				.set({ isCanonical: false })
				.where(eq(entityRoutes.id, current.id))
		}

		if (existing) {
			await dbx
				.update(entityRoutes)
				.set({ isCanonical: true, slug })
				.where(eq(entityRoutes.id, existing.id))
		} else {
			try {
				await dbx.insert(entityRoutes).values({
					entityId,
					namespace: target.namespace,
					scopeEntityId: target.scopeEntityId ?? null,
					slug,
					isCanonical: true,
				})
			} catch (error_) {
				if (isUniqueViolation(error_)) {
					throw error(409, `The address "${slug}" is already in use`)
				}
				throw error_
			}
		}
	}

	for (const legacy of input.legacySlugs ?? []) {
		if (legacy.toLowerCase() === slug.toLowerCase()) continue
		await addAliasRoute(dbx, entityId, {
			namespace: target.namespace,
			scopeEntityId: target.scopeEntityId ?? null,
			slug: legacy,
		})
	}
}

/**
 * Archive, never hard-delete: when a legacy row is deleted, its entity stays
 * (status 'archived') and every route keeps resolving — the canonical renders
 * with an archived banner, noncanonicals still 301. No-op for NULL (spine-less
 * legacy rows) and for merged entities.
 */
export async function archiveEntity(dbx: EntitySpineDatabase, entityId: number | null): Promise<void> {
	if (entityId == null) return
	await dbx
		.update(entities)
		.set({ status: 'archived', updatedAt: new Date() })
		.where(and(eq(entities.id, entityId), eq(entities.status, 'active')))
}

// ============================================================================
// Invariants — the queries the design doc requires in migrations and health
// checks. Empty results = healthy; violations are returned, never thrown, so
// callers decide whether to gate (migrations) or report (dashboards).
// ============================================================================

export interface CanonicalRouteViolation {
	entityId: number
	displayName: string
	status: string
	canonicalCount: number
}

/**
 * Exactly one canonical route per non-merged entity — strict; merge losers
 * must own no canonical (their routes were repointed at the survivor).
 * Exceptions require amending this invariant with a written reason.
 */
export async function findCanonicalRouteViolations(
	dbx: EntitySpineDatabase,
): Promise<CanonicalRouteViolation[]> {
	const rows = await dbx.execute(sql`
		SELECT
			e.id AS "entityId",
			e.display_name AS "displayName",
			e.status,
			COUNT(r.id) FILTER (WHERE r.is_canonical)::int AS "canonicalCount"
		FROM entities e
		LEFT JOIN entity_routes r ON r.entity_id = e.id
		GROUP BY e.id, e.display_name, e.status
		HAVING
			(e.status <> 'merged' AND COUNT(r.id) FILTER (WHERE r.is_canonical) <> 1)
			OR (e.status = 'merged' AND COUNT(r.id) FILTER (WHERE r.is_canonical) > 0)
	`)
	return rows as unknown as CanonicalRouteViolation[]
}

export interface MergeChainViolation {
	entityId: number
	mergedIntoId: number
}

/**
 * No merge chains: every merged entity points at the FINAL survivor. A loser
 * pointing at another merged entity means a merge forgot to flatten history.
 */
export async function findMergeChainViolations(
	dbx: EntitySpineDatabase,
): Promise<MergeChainViolation[]> {
	const rows = await dbx.execute(sql`
		SELECT loser.id AS "entityId", loser.merged_into_id AS "mergedIntoId"
		FROM entities loser
		JOIN entities survivor ON survivor.id = loser.merged_into_id
		WHERE survivor.status = 'merged'
	`)
	return rows as unknown as MergeChainViolation[]
}

export interface SpinelessRowCount {
	facetTable: string
	rows: number
}

/**
 * Rows still carrying entity_id NULL, per facet table. The writer flip (and
 * entity_id NOT NULL) is gated on this reporting zero everywhere.
 */
export async function countSpinelessRows(
	dbx: EntitySpineDatabase,
): Promise<SpinelessRowCount[]> {
	const rows = await dbx.execute(sql`
		SELECT 'content_records' AS "facetTable", COUNT(*)::int AS rows FROM content_records WHERE entity_id IS NULL
		UNION ALL SELECT 'calendars', COUNT(*)::int FROM calendars WHERE entity_id IS NULL
		UNION ALL SELECT 'languages', COUNT(*)::int FROM languages WHERE entity_id IS NULL
		UNION ALL SELECT 'lexicon', COUNT(*)::int FROM lexicon WHERE entity_id IS NULL
		UNION ALL SELECT 'celestial_bodies', COUNT(*)::int FROM celestial_bodies WHERE entity_id IS NULL
		UNION ALL SELECT 'countries', COUNT(*)::int FROM countries WHERE entity_id IS NULL
		UNION ALL SELECT 'world_maps', COUNT(*)::int FROM world_maps WHERE entity_id IS NULL
		UNION ALL SELECT 'categories', COUNT(*)::int FROM categories WHERE entity_id IS NULL
	`)
	return (rows as unknown as SpinelessRowCount[]).filter(row => row.rows > 0)
}

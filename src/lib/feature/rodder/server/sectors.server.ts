import { error } from '@sveltejs/kit'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { rodderBodies, rodderSectorRoots, rodderSectors } from '$lib/server/db/schema.js'
import { RODDER_TREE_CTE } from '$lib/feature/rodder/server/hierarchy.server.js'
import {
	buildApparentSky,
	type ApparentSkyMemberInput,
	type ApparentSkyRootInput,
	type ApparentSkyResult,
} from '$lib/feature/rodder/apparent-sky.js'
import { createSectorSchema, updateSectorSchema, type CreateSectorInput } from '$lib/feature/rodder/sector-schema.js'

/**
 * Sectors and sector roots (Rodder-Sector-and-System-Model.md).
 *
 * Sector frame authoring plus the root-maintenance helpers used by system
 * writes. Regions and routes remain future layers; sector CRUD and system
 * membership are complete authoring concepts here.
 */

type Dbx = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

export type SectorRow = typeof rodderSectors.$inferSelect
export type SectorRootRow = typeof rodderSectorRoots.$inferSelect

export interface SectorRootEntry {
	rootId: number
	bodyId: number
	name: string
	slug: string
	kind: string
	x: number | null
	y: number | null
	z: number | null
	positionProvenance: string
	positionUncertainty: number | null
	distanceLy: number | null
	starCount: number
	planetCount: number
}

export interface SectorDetail {
	sector: SectorRow
	roots: SectorRootEntry[]
}

/**
 * Fallback sector for API clients that do not choose one explicitly. The
 * lowest id keeps the choice deterministic; a missing sector is recreated
 * rather than failing the first system write.
 */
export async function resolveDefaultSectorId(dbx: Dbx): Promise<number> {
	const [existing] = await dbx
		.select({ id: rodderSectors.id })
		.from(rodderSectors)
		.orderBy(asc(rodderSectors.id))
		.limit(1)
	if (existing) return existing.id
	const [created] = await dbx.insert(rodderSectors).values({
		name: 'Local Sector',
		slug: 'local-sector',
		description: 'Default sector created automatically for the first authored system.',
		units: 'ly',
		originKind: 'frame-centred',
		handedness: 'right-handed',
		provenance: 'authored',
	}).returning({ id: rodderSectors.id })
	return created.id
}

/** Resolve an explicitly selected sector, or the deterministic default. */
export async function resolveSectorId(dbx: Dbx, sectorId?: number | null): Promise<number> {
	if (sectorId == null) return resolveDefaultSectorId(dbx)
	const [sector] = await dbx
		.select({ id: rodderSectors.id })
		.from(rodderSectors)
		.where(eq(rodderSectors.id, sectorId))
	if (!sector) throw error(400, 'Sector not found')
	return sector.id
}

export async function getSectorRootForBody(dbx: Dbx, bodyId: number): Promise<SectorRootRow | null> {
	const [root] = await dbx
		.select()
		.from(rodderSectorRoots)
		.where(eq(rodderSectorRoots.bodyId, bodyId))
	return root ?? null
}

/**
 * Create or update the root record for a body. `position: null` records the
 * root with an explicitly unknown position; a set position is a complete
 * triple by the time it reaches this layer (see sector-position.ts).
 */
export async function upsertSectorRoot(
	dbx: Dbx,
	bodyId: number,
	sectorId: number,
	position: { x: number, y: number, z: number } | null,
	positionProvenance = 'authored',
) {
	const values = {
		sectorId,
		bodyId,
		x: position?.x ?? null,
		y: position?.y ?? null,
		z: position?.z ?? null,
		positionProvenance,
	}
	await dbx.insert(rodderSectorRoots)
		.values(values)
		.onConflictDoUpdate({
			target: rodderSectorRoots.bodyId,
			set: { ...values, updatedAt: new Date() },
		})
}

/** Move a root between frames without rewriting or normalizing its position. */
export async function moveSectorRoot(dbx: Dbx, bodyId: number, sectorId: number) {
	await dbx.update(rodderSectorRoots)
		.set({ sectorId, updatedAt: new Date() })
		.where(eq(rodderSectorRoots.bodyId, bodyId))
}

export async function removeSectorRoot(dbx: Dbx, bodyId: number) {
	await dbx.delete(rodderSectorRoots).where(eq(rodderSectorRoots.bodyId, bodyId))
}

/** All sectors with root/positioned counts, for the atlas index. */
export async function listSectorsForRegistry() {
	return await db.execute(sql`
		SELECT
			s.id, s.name, s.slug, s.description, s.units, s.shape, s.radius,
			s.extent_x AS "extentX", s.extent_y AS "extentY", s.extent_z AS "extentZ",
			s.origin_kind AS "originKind", s.origin_body_id AS "originBodyId",
			s.axes_note AS "axesNote", s.handedness,
			s.reference_epoch AS "referenceEpoch", s.provenance,
			s.created_at AS "createdAt", s.updated_at AS "updatedAt",
			COUNT(r.id)::int AS "rootCount",
			COUNT(r.id) FILTER (WHERE r.x IS NOT NULL AND r.y IS NOT NULL AND r.z IS NOT NULL)::int AS "positionedCount"
		FROM rodder_sectors s
		LEFT JOIN rodder_sector_roots r ON r.sector_id = s.id
		GROUP BY s.id
		ORDER BY s.id
	`) as unknown as Array<{
		id: number
		name: string
		slug: string
		description: string
		units: string
		shape: string | null
		radius: number | null
		extentX: number | null
		extentY: number | null
		extentZ: number | null
		originKind: string
		originBodyId: number | null
		axesNote: string | null
		handedness: string
		referenceEpoch: string | null
		provenance: string
		createdAt: Date
		updatedAt: Date
		rootCount: number
		positionedCount: number
	}>
}

export async function listSectorReferences() {
	return db.select({ id: rodderSectors.id, name: rodderSectors.name, units: rodderSectors.units })
		.from(rodderSectors)
		.orderBy(rodderSectors.name)
}

async function assertSectorSlugAvailable(slug: string, exceptId?: number) {
	const [existing] = await db
		.select({ id: rodderSectors.id })
		.from(rodderSectors)
		.where(eq(rodderSectors.slug, slug))
	if (existing && existing.id !== exceptId) throw error(409, 'A sector with this slug already exists')
}

async function assertOriginBody(originBodyId: number | null) {
	if (originBodyId == null) return
	const [body] = await db
		.select({ id: rodderBodies.id, kind: rodderBodies.kind })
		.from(rodderBodies)
		.where(eq(rodderBodies.id, originBodyId))
	if (!body || body.kind !== 'system') throw error(400, 'Origin system not found')
}

function sectorValues(data: CreateSectorInput) {
	return {
		name: data.name,
		slug: data.slug,
		description: data.description,
		units: data.units,
		shape: data.shape,
		radius: data.shape === 'sphere' ? data.radius : null,
		extentX: data.shape === 'cuboid' ? data.extentX : null,
		extentY: data.shape === 'cuboid' ? data.extentY : null,
		extentZ: data.shape === 'cuboid' ? data.extentZ : null,
		originKind: data.originKind,
		originBodyId: data.originKind === 'object-centred' ? data.originBodyId : null,
		axesNote: data.axesNote || null,
		handedness: data.handedness,
		referenceEpoch: data.referenceEpoch || null,
		provenance: data.provenance,
	}
}

export async function createSector(raw: unknown) {
	const parsed = createSectorSchema.safeParse(raw)
	if (!parsed.success) throw error(400, parsed.error.issues[0].message)
	await assertSectorSlugAvailable(parsed.data.slug)
	await assertOriginBody(parsed.data.originBodyId)
	const [created] = await db.insert(rodderSectors).values(sectorValues(parsed.data)).returning()
	return created
}

export async function updateSector(slug: string, raw: unknown) {
	const [current] = await db.select().from(rodderSectors).where(eq(rodderSectors.slug, slug))
	if (!current) throw error(404, 'Sector not found')
	const patch = updateSectorSchema.safeParse(raw)
	if (!patch.success) throw error(400, patch.error.issues[0].message)
	const merged = createSectorSchema.safeParse({ ...current, ...patch.data })
	if (!merged.success) throw error(400, merged.error.issues[0].message)
	await assertSectorSlugAvailable(merged.data.slug, current.id)
	await assertOriginBody(merged.data.originBodyId)
	const [updated] = await db.update(rodderSectors)
		.set({ ...sectorValues(merged.data), updatedAt: new Date() })
		.where(eq(rodderSectors.id, current.id))
		.returning()
	return updated
}

export async function deleteSector(slug: string) {
	const [sector] = await db.select().from(rodderSectors).where(eq(rodderSectors.slug, slug))
	if (!sector) throw error(404, 'Sector not found')
	const [usage] = await db.select({ count: sql<number>`COUNT(*)::int` })
		.from(rodderSectorRoots)
		.where(eq(rodderSectorRoots.sectorId, sector.id))
	if ((usage?.count ?? 0) > 0) {
		throw error(409, 'Move every root out of this sector before deleting it')
	}
	await db.delete(rodderSectors).where(eq(rodderSectors.id, sector.id))
	return { deleted: true, id: sector.id, slug: sector.slug }
}

/** A sector's frame contract plus every root, annotated for display. 404s on a bad slug. */
export async function getSectorBySlug(slug: string): Promise<SectorDetail> {
	const [sector] = await db.select().from(rodderSectors).where(eq(rodderSectors.slug, slug))
	if (!sector) throw error(404, 'Sector not found')

	const roots = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			r.id AS "rootId", r.body_id AS "bodyId",
			cb.name, cb.slug, cb.kind,
			r.x, r.y, r.z,
			r.position_provenance AS "positionProvenance",
			r.position_uncertainty AS "positionUncertainty",
			cb.distance_ly AS "distanceLy",
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.root_id = cb.id AND t.kind = 'body')::int AS "planetCount"
		FROM rodder_sector_roots r
		JOIN rodder_bodies cb ON cb.id = r.body_id
		WHERE r.sector_id = ${sector.id}
		ORDER BY cb.name
	`) as unknown as SectorRootEntry[]

	return { sector, roots }
}

/** The sector frame a root body belongs to, for the system page sidebar. */
export async function getSectorContextForRoot(bodyId: number) {
	const [row] = await db
		.select({
			sectorId: rodderSectors.id,
			sectorName: rodderSectors.name,
			sectorSlug: rodderSectors.slug,
			units: rodderSectors.units,
			handedness: rodderSectors.handedness,
			originKind: rodderSectors.originKind,
			sectorProvenance: rodderSectors.provenance,
			x: rodderSectorRoots.x,
			y: rodderSectorRoots.y,
			z: rodderSectorRoots.z,
			positionProvenance: rodderSectorRoots.positionProvenance,
		})
		.from(rodderSectorRoots)
		.innerJoin(rodderSectors, eq(rodderSectors.id, rodderSectorRoots.sectorId))
		.where(eq(rodderSectorRoots.bodyId, bodyId))
	return row ?? null
}

type ApparentSkyRow = {
	rootId: number
	rootName: string
	rootSlug: string
	rootKind: string
	x: number | null
	y: number | null
	z: number | null
	positionProvenance: string
	positionUncertainty: number | null
	starId: number | null
	starName: string | null
	starSlug: string | null
	spectralType: string | null
	temperatureK: number | null
	luminosityW: number | null
	radiusM: number | null
	absoluteMagnitude: string | null
}

/**
 * Authored, same-sector apparent sky for one root. Sector-root positions are
 * treated as unresolved barycentres: every stellar member stays attached to
 * one root direction rather than receiving an invented angular separation.
 */
export async function getApparentSkyForRoot(bodyId: number): Promise<ApparentSkyResult> {
	const [observer] = await db
		.select({
			rootId: rodderSectorRoots.bodyId,
			sectorId: rodderSectors.id,
			sectorName: rodderSectors.name,
			sectorSlug: rodderSectors.slug,
			units: rodderSectors.units,
			handedness: rodderSectors.handedness,
			referenceEpoch: rodderSectors.referenceEpoch,
			x: rodderSectorRoots.x,
			y: rodderSectorRoots.y,
			z: rodderSectorRoots.z,
		})
		.from(rodderSectorRoots)
		.innerJoin(rodderSectors, eq(rodderSectors.id, rodderSectorRoots.sectorId))
		.where(eq(rodderSectorRoots.bodyId, bodyId))

	if (!observer) return buildApparentSky(null, [])

	const [rowsResult, incompatibleResult] = await Promise.all([db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			r.body_id AS "rootId",
			root.name AS "rootName",
			root.slug AS "rootSlug",
			root.kind AS "rootKind",
			r.x, r.y, r.z,
			r.position_provenance AS "positionProvenance",
			r.position_uncertainty AS "positionUncertainty",
			star.id AS "starId",
			star.name AS "starName",
			star.slug AS "starSlug",
			star.spectral_type AS "spectralType",
			star.temperature_k AS "temperatureK",
			star.luminosity_w AS "luminosityW",
			star.radius_m AS "radiusM",
			star.absolute_magnitude AS "absoluteMagnitude"
		FROM rodder_sector_roots r
		JOIN rodder_bodies root ON root.id = r.body_id
		LEFT JOIN rodder_tree tree ON tree.root_id = r.body_id AND tree.kind = 'star'
		LEFT JOIN rodder_bodies star ON star.id = tree.id
		WHERE r.sector_id = ${observer.sectorId}
			AND r.body_id <> ${bodyId}
		ORDER BY root.name, star.name
	`), db.execute(sql`
		SELECT COUNT(*)::int AS count
		FROM rodder_sector_roots
		WHERE sector_id <> ${observer.sectorId}
	`)])
	const rows = rowsResult as unknown as ApparentSkyRow[]
	const incompatibleSectorRoots = Number((incompatibleResult as unknown as Array<{ count: number }>)[0]?.count ?? 0)

	const grouped = new Map<number, ApparentSkyRootInput>()
	for (const row of rows) {
		let root = grouped.get(row.rootId)
		if (!root) {
			root = {
				rootId: row.rootId,
				rootName: row.rootName,
				rootSlug: row.rootSlug,
				rootKind: row.rootKind,
				x: row.x,
				y: row.y,
				z: row.z,
				positionProvenance: row.positionProvenance,
				positionUncertainty: row.positionUncertainty,
				stars: [],
			}
			grouped.set(row.rootId, root)
		}
		if (row.starId == null || row.starName == null || row.starSlug == null) continue
		root.stars.push({
			id: row.starId,
			name: row.starName,
			slug: row.starSlug,
			spectralType: row.spectralType,
			temperatureK: row.temperatureK,
			luminosityW: row.luminosityW,
			radiusM: row.radiusM,
			absoluteMagnitude: row.absoluteMagnitude,
		} satisfies ApparentSkyMemberInput)
	}

	return buildApparentSky({
		...observer,
		units: observer.units === 'pc' ? 'pc' : 'ly',
		handedness: observer.handedness === 'left-handed' ? 'left-handed' : 'right-handed',
	}, [...grouped.values()], { incompatibleSectorRoots })
}

export type SectorContext = NonNullable<Awaited<ReturnType<typeof getSectorContextForRoot>>>

import { error } from '@sveltejs/kit'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { celestialBodies, celestialSectorRoots, celestialSectors } from '$lib/server/db/schema.js'
import { CELESTIAL_TREE_CTE } from '$lib/server/celestial/hierarchy.js'
import { createSectorSchema, updateSectorSchema, type CreateSectorInput } from '$lib/celestial/sector-schema.js'

/**
 * Sectors and sector roots (Celestial-Sector-and-System-Model.md).
 *
 * Sector frame authoring plus the root-maintenance helpers used by system
 * writes. Regions and routes remain future layers; sector CRUD and system
 * membership are complete authoring concepts here.
 */

type Dbx = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

export type SectorRow = typeof celestialSectors.$inferSelect
export type SectorRootRow = typeof celestialSectorRoots.$inferSelect

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
		.select({ id: celestialSectors.id })
		.from(celestialSectors)
		.orderBy(asc(celestialSectors.id))
		.limit(1)
	if (existing) return existing.id
	const [created] = await dbx.insert(celestialSectors).values({
		name: 'Local Sector',
		slug: 'local-sector',
		description: 'Default sector created automatically for the first authored system.',
		units: 'ly',
		originKind: 'frame-centred',
		handedness: 'right-handed',
		provenance: 'authored',
	}).returning({ id: celestialSectors.id })
	return created.id
}

/** Resolve an explicitly selected sector, or the deterministic default. */
export async function resolveSectorId(dbx: Dbx, sectorId?: number | null): Promise<number> {
	if (sectorId == null) return resolveDefaultSectorId(dbx)
	const [sector] = await dbx
		.select({ id: celestialSectors.id })
		.from(celestialSectors)
		.where(eq(celestialSectors.id, sectorId))
	if (!sector) throw error(400, 'Sector not found')
	return sector.id
}

export async function getSectorRootForBody(dbx: Dbx, bodyId: number): Promise<SectorRootRow | null> {
	const [root] = await dbx
		.select()
		.from(celestialSectorRoots)
		.where(eq(celestialSectorRoots.bodyId, bodyId))
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
	await dbx.insert(celestialSectorRoots)
		.values(values)
		.onConflictDoUpdate({
			target: celestialSectorRoots.bodyId,
			set: { ...values, updatedAt: new Date() },
		})
}

/** Move a root between frames without rewriting or normalizing its position. */
export async function moveSectorRoot(dbx: Dbx, bodyId: number, sectorId: number) {
	await dbx.update(celestialSectorRoots)
		.set({ sectorId, updatedAt: new Date() })
		.where(eq(celestialSectorRoots.bodyId, bodyId))
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
		FROM celestial_sectors s
		LEFT JOIN celestial_sector_roots r ON r.sector_id = s.id
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
	return db.select({ id: celestialSectors.id, name: celestialSectors.name, units: celestialSectors.units })
		.from(celestialSectors)
		.orderBy(celestialSectors.name)
}

async function assertSectorSlugAvailable(slug: string, exceptId?: number) {
	const [existing] = await db
		.select({ id: celestialSectors.id })
		.from(celestialSectors)
		.where(eq(celestialSectors.slug, slug))
	if (existing && existing.id !== exceptId) throw error(409, 'A sector with this slug already exists')
}

async function assertOriginBody(originBodyId: number | null) {
	if (originBodyId == null) return
	const [body] = await db
		.select({ id: celestialBodies.id, kind: celestialBodies.kind })
		.from(celestialBodies)
		.where(eq(celestialBodies.id, originBodyId))
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
	const [created] = await db.insert(celestialSectors).values(sectorValues(parsed.data)).returning()
	return created
}

export async function updateSector(slug: string, raw: unknown) {
	const [current] = await db.select().from(celestialSectors).where(eq(celestialSectors.slug, slug))
	if (!current) throw error(404, 'Sector not found')
	const patch = updateSectorSchema.safeParse(raw)
	if (!patch.success) throw error(400, patch.error.issues[0].message)
	const merged = createSectorSchema.safeParse({ ...current, ...patch.data })
	if (!merged.success) throw error(400, merged.error.issues[0].message)
	await assertSectorSlugAvailable(merged.data.slug, current.id)
	await assertOriginBody(merged.data.originBodyId)
	const [updated] = await db.update(celestialSectors)
		.set({ ...sectorValues(merged.data), updatedAt: new Date() })
		.where(eq(celestialSectors.id, current.id))
		.returning()
	return updated
}

export async function deleteSector(slug: string) {
	const [sector] = await db.select().from(celestialSectors).where(eq(celestialSectors.slug, slug))
	if (!sector) throw error(404, 'Sector not found')
	const [usage] = await db.select({ count: sql<number>`COUNT(*)::int` })
		.from(celestialSectorRoots)
		.where(eq(celestialSectorRoots.sectorId, sector.id))
	if ((usage?.count ?? 0) > 0) {
		throw error(409, 'Move every system out of this sector before deleting it')
	}
	await db.delete(celestialSectors).where(eq(celestialSectors.id, sector.id))
	return { deleted: true, id: sector.id, slug: sector.slug }
}

/** A sector's frame contract plus every root, annotated for display. 404s on a bad slug. */
export async function getSectorBySlug(slug: string): Promise<SectorDetail> {
	const [sector] = await db.select().from(celestialSectors).where(eq(celestialSectors.slug, slug))
	if (!sector) throw error(404, 'Sector not found')

	const roots = await db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			r.id AS "rootId", r.body_id AS "bodyId",
			cb.name, cb.slug, cb.kind,
			r.x, r.y, r.z,
			r.position_provenance AS "positionProvenance",
			r.position_uncertainty AS "positionUncertainty",
			cb.distance_ly AS "distanceLy",
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = cb.id AND t.kind = 'body')::int AS "planetCount"
		FROM celestial_sector_roots r
		JOIN celestial_bodies cb ON cb.id = r.body_id
		WHERE r.sector_id = ${sector.id}
		ORDER BY cb.name
	`) as unknown as SectorRootEntry[]

	return { sector, roots }
}

/** The sector frame a root body belongs to, for the system page sidebar. */
export async function getSectorContextForRoot(bodyId: number) {
	const [row] = await db
		.select({
			sectorId: celestialSectors.id,
			sectorName: celestialSectors.name,
			sectorSlug: celestialSectors.slug,
			units: celestialSectors.units,
			originKind: celestialSectors.originKind,
			sectorProvenance: celestialSectors.provenance,
			x: celestialSectorRoots.x,
			y: celestialSectorRoots.y,
			z: celestialSectorRoots.z,
			positionProvenance: celestialSectorRoots.positionProvenance,
		})
		.from(celestialSectorRoots)
		.innerJoin(celestialSectors, eq(celestialSectors.id, celestialSectorRoots.sectorId))
		.where(eq(celestialSectorRoots.bodyId, bodyId))
	return row ?? null
}

export type SectorContext = NonNullable<Awaited<ReturnType<typeof getSectorContextForRoot>>>

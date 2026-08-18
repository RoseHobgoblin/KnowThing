import { error } from '@sveltejs/kit'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { celestialSectorRoots, celestialSectors } from '$lib/server/db/schema.js'
import { CELESTIAL_TREE_CTE } from '$lib/server/celestial/hierarchy.js'

/**
 * Sectors and sector roots (Celestial-Sector-and-System-Model.md).
 *
 * Read side of the sector model plus the root-maintenance helpers the system
 * write path uses. Sector authoring (create/edit/delete sectors, regions,
 * routes) is deliberately absent — Part 1 ships a read-only sector view over
 * the one migrated legacy sector.
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
 * The sector new systems are attached to. With sector authoring out of scope
 * there is exactly one sector (seeded by migration 0054); the lowest id keeps
 * the choice deterministic if more ever appear before an explicit picker
 * exists. A missing sector is recreated rather than failing the write.
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

/** All sectors with root/positioned counts, for the atlas index. */
export async function listSectorsForRegistry() {
	return await db.execute(sql`
		SELECT
			s.id, s.name, s.slug, s.units, s.provenance,
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
		units: string
		provenance: string
		rootCount: number
		positionedCount: number
	}>
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

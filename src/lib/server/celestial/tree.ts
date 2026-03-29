import { db } from '../db/index.js'
import { stars, planetaryBodies } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

export interface CelestialTreeNode {
	id: number
	name: string
	slug: string
	type: 'star' | string
	color?: string | null
	children: CelestialTreeNode[]
}

/** Get the full system tree for a star (star + all planets + moons) */
export async function getSystemTree(starId: number): Promise<CelestialTreeNode | null> {
	const [star] = await db.select().from(stars).where(eq(stars.id, starId))
	if (!star) return null

	const bodies = await db
		.select()
		.from(planetaryBodies)
		.where(eq(planetaryBodies.starId, starId))

	// Build planet nodes, then attach moons
	const planets: CelestialTreeNode[] = []
	const moonsByParent = new Map<number, CelestialTreeNode[]>()

	for (const body of bodies) {
		const node: CelestialTreeNode = {
			id: body.id,
			name: body.name,
			slug: body.slug,
			type: body.bodyType,
			children: [],
		}
		if (body.parentId) {
			const existing = moonsByParent.get(body.parentId) ?? []
			existing.push(node)
			moonsByParent.set(body.parentId, existing)
		} else {
			planets.push(node)
		}
	}

	// Attach moons to planets
	for (const planet of planets) {
		planet.children = moonsByParent.get(planet.id) ?? []
	}

	return {
		id: star.id,
		name: star.name,
		slug: star.slug,
		type: 'star',
		color: star.color,
		children: planets,
	}
}

/** Get direct satellites of a planetary body */
export async function getChildren(bodyId: number) {
	return db
		.select()
		.from(planetaryBodies)
		.where(eq(planetaryBodies.parentId, bodyId))
}

/** Check if targetId is a descendant of bodyId (circular reference prevention) */
export async function isDescendant(bodyId: number, targetId: number): Promise<boolean> {
	if (bodyId === targetId) return true

	const result = await db.execute(sql`
		WITH RECURSIVE ancestry AS (
			SELECT id, parent_id, 0 AS depth
			FROM planetary_bodies
			WHERE id = ${targetId}
			UNION ALL
			SELECT pb.id, pb.parent_id, a.depth + 1
			FROM ancestry a
			JOIN planetary_bodies pb ON pb.id = a.parent_id
			WHERE a.depth < 10
		)
		SELECT 1 FROM ancestry WHERE id = ${bodyId} LIMIT 1
	`)

	return result.length > 0
}

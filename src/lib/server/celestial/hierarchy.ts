import { sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'

/**
 * Recursive ancestry annotation over the unified celestial hierarchy.
 *
 * Embed as `sql\`WITH RECURSIVE ${CELESTIAL_TREE_CTE} SELECT … FROM celestial_tree …\``.
 * Produces one row per celestial entity:
 *
 *   celestial_tree(id, kind, parent_id, root_id, root_kind, nearest_star_id, depth)
 *
 * - `root_id`/`root_kind`: the top of the entity's parent chain (the system for
 *   anything placed in one; itself for orphans and field stars).
 * - `nearest_star_id`: the closest star ancestor — a star's own id for itself,
 *   the primary for its planets and their moons, the companion for anything
 *   orbiting the companion. This is the single-table equivalent of the old
 *   `planetary_bodies.star_id` column.
 */
export const CELESTIAL_TREE_CTE = sql`
  celestial_tree AS (
  	SELECT cb.id, cb.kind, cb.parent_id,
  		cb.id AS root_id, cb.kind AS root_kind,
  		CASE WHEN cb.kind = 'star' THEN cb.id END AS nearest_star_id,
  		0 AS depth
  	FROM celestial_bodies cb
  	WHERE cb.parent_id IS NULL
  	UNION ALL
  	SELECT cb.id, cb.kind, cb.parent_id,
  		t.root_id, t.root_kind,
  		CASE WHEN cb.kind = 'star' THEN cb.id ELSE t.nearest_star_id END,
  		t.depth + 1
  	FROM celestial_bodies cb
  	JOIN celestial_tree t ON cb.parent_id = t.id
  )
`

/**
 * The nearest star at-or-above `entityId` in the hierarchy (inclusive: a
 * star resolves to itself). Single-table equivalent of the old
 * `planetary_bodies.star_id` lookup for one entity.
 */
export async function findNearestStarAncestor(entityId: number): Promise<{ id: number, name: string, slug: string, massKg: number | null } | null> {
	const [row] = await db.execute(sql`
		WITH RECURSIVE up AS (
			SELECT id, parent_id, kind, name, slug, mass_kg, 0 AS depth
			FROM celestial_bodies
			WHERE id = ${entityId}
			UNION ALL
			SELECT cb.id, cb.parent_id, cb.kind, cb.name, cb.slug, cb.mass_kg, up.depth + 1
			FROM celestial_bodies cb
			JOIN up ON cb.id = up.parent_id
			WHERE up.depth < 20
		)
		SELECT id, name, slug, mass_kg AS "massKg" FROM up WHERE kind = 'star' ORDER BY depth LIMIT 1
	`)
	return (row as unknown as { id: number, name: string, slug: string, massKg: number | null }) ?? null
}

/**
 * Would re-parenting `entityId` under `newParentId` create a cycle?
 * Walks the full parent chain upward from the proposed parent — self-parenting
 * and multi-hop loops (A→B→C→A) both land here. The depth cap is a safety
 * bound far above any real hierarchy (system→star→star→body→moon→submoon…).
 */
export async function celestialCycleWouldForm(entityId: number, newParentId: number): Promise<boolean> {
	if (entityId === newParentId) return true
	const result = await db.execute(sql`
		WITH RECURSIVE chain AS (
			SELECT id, parent_id, 1 AS depth
			FROM celestial_bodies
			WHERE id = ${newParentId}
			UNION ALL
			SELECT cb.id, cb.parent_id, chain.depth + 1
			FROM celestial_bodies cb
			JOIN chain ON cb.id = chain.parent_id
			WHERE chain.depth < 20
		)
		SELECT 1 FROM chain WHERE id = ${entityId} LIMIT 1
	`)
	return result.length > 0
}

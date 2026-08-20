import { and, eq, or, sql } from 'drizzle-orm'
import {
	deriveBody,
	deriveStar,
	type BodyModel,
	type BodyRow,
	type StarModel,
	type StarRow,
} from 'tungolcraft'
import { db } from '$lib/server/db/index.js'
import { rodderBodies } from '$lib/server/db/schema.js'
import { findNearestStarAncestor, RODDER_TREE_CTE } from '$lib/server/rodder/hierarchy.js'

async function systemStellarMassKg(systemId: number): Promise<number | null> {
	const [row] = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT SUM(cb.mass_kg)::double precision AS "massKg"
		FROM rodder_bodies cb
		JOIN rodder_tree t ON t.id = cb.id
		WHERE cb.kind = 'star' AND t.root_id = ${systemId}
	`)
	const mass = (row as unknown as { massKg: number | null } | undefined)?.massKg
	return mass != null && mass > 0 ? mass : null
}

async function buildBodyModel(row: BodyRow & { id: number, parentId?: number | null }): Promise<BodyModel> {
	let star: { name: string, slug: string, massKg: number | null } | null = null
	let parentBody: { name: string, slug: string, massKg: number | null } | null = null
	let system: { name: string, slug: string, massKg: number | null } | null = null
	if (row.parentId != null) {
		const [parent] = await db
			.select({ kind: rodderBodies.kind, name: rodderBodies.name, slug: rodderBodies.slug, massKg: rodderBodies.massKg })
			.from(rodderBodies).where(eq(rodderBodies.id, row.parentId))
		if (parent?.kind === 'body') parentBody = parent
		if (parent?.kind === 'system') {
			system = { name: parent.name, slug: parent.slug, massKg: await systemStellarMassKg(row.parentId) }
		} else {
			star = parent?.kind === 'star' ? parent : await findNearestStarAncestor(row.parentId)
		}
	}
	const [{ count: moonCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(rodderBodies)
		.where(and(eq(rodderBodies.parentId, row.id), eq(rodderBodies.kind, 'body')))
	return deriveBody(row, { star, parentBody, system, moonCount })
}

async function buildStarModel(row: StarRow & { id: number, parentId?: number | null }): Promise<StarModel> {
	let parentStar: { name: string, slug: string, massKg: number | null } | null = null
	let barycenterMassKg: number | null = null
	let parentSystemId: number | null = null
	if (row.parentId != null) {
		const [parent] = await db
			.select({ kind: rodderBodies.kind, name: rodderBodies.name, slug: rodderBodies.slug, massKg: rodderBodies.massKg })
			.from(rodderBodies).where(eq(rodderBodies.id, row.parentId))
		if (parent?.kind === 'star') parentStar = { name: parent.name, slug: parent.slug, massKg: parent.massKg }
		if (parent?.kind === 'system') {
			parentSystemId = row.parentId
			if (row.semiMajorAxisAu != null && row.semiMajorAxisAu > 0) {
				barycenterMassKg = await systemStellarMassKg(row.parentId)
			}
		}
	}
	const companions = await db
		.select({ name: rodderBodies.name, slug: rodderBodies.slug })
		.from(rodderBodies)
		.where(and(
			eq(rodderBodies.kind, 'star'),
			sql`${rodderBodies.id} <> ${row.id}`,
			parentSystemId == null
				? eq(rodderBodies.parentId, row.id)
				: or(eq(rodderBodies.parentId, row.id), eq(rodderBodies.parentId, parentSystemId)),
		))
		.orderBy(rodderBodies.name)
	const [counts] = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.kind = 'body' AND t.parent_id = ${row.id})::int AS planets,
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.kind = 'body' AND t.nearest_star_id = ${row.id} AND t.parent_id <> ${row.id})::int AS satellites
	`)
	const result = counts as unknown as { planets?: number, satellites?: number } | undefined
	return deriveStar(row, {
		parentStar,
		barycenterMassKg,
		companions,
		planetCount: result?.planets ?? 0,
		satelliteCount: result?.satellites ?? 0,
	})
}

/** Resolve the normalized physical model shared by documents, pages, and infoboxes. */
export async function resolveRodderModel(type: string, slug: string): Promise<BodyModel | StarModel | null> {
	if (type === 'star') {
		const [row] = await db.select().from(rodderBodies)
			.where(and(eq(rodderBodies.slug, slug), eq(rodderBodies.kind, 'star')))
		return row ? buildStarModel(row) : null
	}
	if (type === 'body' || type === 'planet' || type === 'rodder' || type === 'rodder body') {
		const [row] = await db.select().from(rodderBodies)
			.where(and(eq(rodderBodies.slug, slug), eq(rodderBodies.kind, 'body')))
		return row ? buildBodyModel(row) : null
	}
	return null
}

import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { celestialBodies } from '$lib/server/db/schema.js'
import {
	CREATE_SCHEMAS,
	UPDATE_SCHEMAS,
	legacySafeEccentricity,
	type createSystemSchema,
	type createStarSchema,
	type createPlanetaryBodySchema,
} from '$lib/celestial/schema.js'
import { validateParentKind, isCelestialKind, type CelestialKind } from '$lib/celestial/parent-rules.js'
import { celestialPresets, type BodyPreset } from '$lib/celestial/presets.js'
import { urlSlugify } from '$lib/utils/slugify.js'
import { CELESTIAL_TREE_CTE, celestialCycleWouldForm } from '$lib/server/celestial/hierarchy.js'
import {
	deleteCelestialEntity,
	applyFieldUpdates,
	applyNameUpdate,
	applySlugUpdate,
	mergeOverrideExtras,
	STAR_OVERRIDE_MAP,
	BODY_OVERRIDE_MAP,
} from '$lib/server/celestial/update-helpers.js'
import { moveContentByDomainSlug } from '$lib/server/services/content-records.js'

type CreateSystemInput = z.infer<typeof createSystemSchema>
type CreateStarInput = z.infer<typeof createStarSchema>
type CreateBodyInput = z.infer<typeof createPlanetaryBodySchema>
export type CreateCelestialInput = CreateSystemInput | CreateStarInput | CreateBodyInput

type CelestialRow = typeof celestialBodies.$inferSelect

const KIND_LABEL: Record<CelestialKind, string> = { system: 'System', star: 'Star', body: 'Body' }

/**
 * List celestial entities of one kind (or all), annotated with the aggregate
 * counts the old per-table list endpoints exposed:
 *  - system: starCount / planetCount over ALL descendants
 *  - star:   planetCount = descendant bodies whose nearest star is this one
 *            (the single-table equivalent of the old `star_id` join)
 *  - body:   moonCount = direct child bodies, plus nearest star name/slug
 */
export async function listCelestial(options: { kind?: CelestialKind, starSlug?: string | null } = {}) {
	const { kind, starSlug } = options
	let query = sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			cb.*,
			p.name AS "parentName", p.slug AS "parentSlug", p.kind AS "parentKind",
			ns.name AS "starName", ns.slug AS "starSlug",
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM celestial_tree t
				WHERE t.kind = 'body'
					AND CASE cb.kind WHEN 'star' THEN t.nearest_star_id = cb.id ELSE t.root_id = cb.id END
			)::int AS "planetCount",
			(SELECT COUNT(*) FROM celestial_bodies m WHERE m.parent_id = cb.id AND m.kind = 'body')::int AS "moonCount"
		FROM celestial_bodies cb
		JOIN celestial_tree tree ON tree.id = cb.id
		LEFT JOIN celestial_bodies p ON p.id = cb.parent_id
		LEFT JOIN celestial_bodies ns ON ns.id = tree.nearest_star_id AND cb.kind = 'body'
	`
	const conditions = []
	if (kind) conditions.push(sql`cb.kind = ${kind}`)
	if (starSlug) conditions.push(sql`ns.slug = ${starSlug}`)
	if (conditions.length > 0) {
		query = sql`${query} WHERE ${sql.join(conditions, sql` AND `)}`
	}
	query = sql`${query} ORDER BY cb.kind, cb.semi_major_axis_au NULLS LAST, cb.name`
	return db.execute(query)
}

export async function getCelestialBySlug(slug: string) {
	const result = await db.execute(sql`
		WITH RECURSIVE ${CELESTIAL_TREE_CTE}
		SELECT
			cb.*,
			p.name AS "parentName", p.slug AS "parentSlug", p.kind AS "parentKind",
			ns.name AS "starName", ns.slug AS "starSlug",
			(SELECT COUNT(*) FROM celestial_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM celestial_tree t
				WHERE t.kind = 'body'
					AND CASE cb.kind WHEN 'star' THEN t.nearest_star_id = cb.id ELSE t.root_id = cb.id END
			)::int AS "planetCount",
			(SELECT COUNT(*) FROM celestial_bodies m WHERE m.parent_id = cb.id AND m.kind = 'body')::int AS "moonCount"
		FROM celestial_bodies cb
		JOIN celestial_tree tree ON tree.id = cb.id
		LEFT JOIN celestial_bodies p ON p.id = cb.parent_id
		LEFT JOIN celestial_bodies ns ON ns.id = tree.nearest_star_id AND cb.kind = 'body'
		WHERE cb.slug = ${slug}
	`)
	if (result.length === 0) throw error(404, 'Celestial entity not found')
	return result[0]
}

/** db or a transaction — creation helpers run against either. */
type Dbx = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

async function assertSlugAvailable(dbx: Dbx, slug: string) {
	const [existing] = await dbx.select({ id: celestialBodies.id }).from(celestialBodies).where(eq(celestialBodies.slug, slug))
	if (existing) throw error(409, 'A celestial entity with this slug already exists')
}

/** Load a prospective parent and enforce the kind matrix. Throws 400. */
async function loadValidatedParent(dbx: Dbx, kind: CelestialKind, parentId: number, bodyType?: string | null) {
	const [parent] = await dbx
		.select({ id: celestialBodies.id, kind: celestialBodies.kind, massKg: celestialBodies.massKg })
		.from(celestialBodies)
		.where(eq(celestialBodies.id, parentId))
	if (!parent) throw error(400, 'Parent entity not found')
	if (!isCelestialKind(parent.kind)) throw error(500, 'Parent entity has an invalid kind')
	const message = validateParentKind(kind, parent.kind, bodyType)
	if (message) throw error(400, message)
	return parent
}

function assertMergedValid(kind: CelestialKind, current: CelestialRow, patch: Record<string, unknown>) {
	const merged = CREATE_SCHEMAS[kind].safeParse({
		...current,
		eccentricity: legacySafeEccentricity(current.eccentricity),
		...patch,
	})
	if (!merged.success) throw error(400, merged.error.issues[0].message)
}

export async function createCelestial(kind: CelestialKind, data: CreateCelestialInput) {
	return db.transaction(async tx => createCelestialIn(tx, kind, data))
}

/** Create one entity against an executor — lets preset seeding batch several into one transaction. */
async function createCelestialIn(dbx: Dbx, kind: CelestialKind, data: CreateCelestialInput) {
	const slug = data.slug.trim().toLowerCase()
	await assertSlugAvailable(dbx, slug)

	const common = {
		kind,
		name: data.name.trim(),
		slug,
		description: data.description?.trim() || '',
	}

	if (kind === 'system') {
		const system = data as CreateSystemInput
		return insertRow(dbx, {
			...common,
			distanceLy: system.distanceLy ?? null,
			galacticX: system.galacticX ?? null,
			galacticY: system.galacticY ?? null,
			galacticZ: system.galacticZ ?? null,
			formationAge: system.formationAge?.trim() || null,
			designations: system.designations?.trim() || null,
			extra: system.extra ?? {},
		})
	}

	if (kind === 'star') {
		const star = data as CreateStarInput
		if (star.parentId != null) await loadValidatedParent(dbx, 'star', star.parentId)

		// Luminosity is stored only when explicit — the model layer derives the
		// Stefan-Boltzmann value from radius + temperature at read time.
		return insertRow(dbx, {
			...common,
			parentId: star.parentId ?? null,
			spectralType: star.spectralType?.trim() || null,
			massKg: star.massKg ?? null,
			radiusM: star.radiusM ?? null,
			luminosityW: star.luminosityW ?? null,
			luminosityVisual: star.luminosityVisual?.trim() || null,
			temperatureK: star.temperatureK ?? null,
			age: star.age?.trim() || null,
			color: star.color?.trim() || null,
			rotationPeriodS: star.rotationPeriodS ?? null,
			axialTilt: star.axialTilt ?? null,
			orbitalPeriodDays: star.orbitalPeriodDays ?? null,
			semiMajorAxisAu: star.semiMajorAxisAu ?? null,
			eccentricity: star.eccentricity ?? null,
			epochPhase: star.epochPhase ?? null,
			apparentMagnitude: star.apparentMagnitude?.trim() || null,
			absoluteMagnitude: star.absoluteMagnitude?.trim() || null,
			angularDiameter: star.angularDiameter?.trim() || null,
			metallicity: star.metallicity?.trim() || null,
			extra: mergeOverrideExtras(star.extra, star as Record<string, unknown>, STAR_OVERRIDE_MAP),
		})
	}

	const body = data as CreateBodyInput
	// Zod guarantees parentId for bodies; the parent's kind still needs the DB.
	await loadValidatedParent(dbx, 'body', body.parentId!, body.bodyType)

	return insertRow(dbx, {
		...common,
		parentId: body.parentId ?? null,
		bodyType: body.bodyType,
		massKg: body.massKg ?? null,
		radiusM: body.radiusM ?? null,
		temperature: body.temperature?.trim() || null,
		age: body.age?.trim() || null,
		composition: body.composition?.trim() || null,
		atmosphere: body.atmosphere?.trim() || null,
		surfacePressure: body.surfacePressure?.trim() || null,
		orbitalPeriodDays: body.orbitalPeriodDays ?? null,
		semiMajorAxisAu: body.semiMajorAxisAu ?? null,
		eccentricity: body.eccentricity ?? null,
		inclination: body.inclination ?? null,
		epochPhase: body.epochPhase ?? null,
		rotationPeriodS: body.rotationPeriodS ?? null,
		axialTilt: body.axialTilt ?? null,
		apparentMagnitude: body.apparentMagnitude?.trim() || null,
		angularDiameter: body.angularDiameter?.trim() || null,
		albedo: body.albedo?.trim() || null,
		satellites: body.satellites ?? null,
		hasRings: body.hasRings ?? false,
		extra: mergeOverrideExtras(body.extra, body as Record<string, unknown>, BODY_OVERRIDE_MAP),
	})
}

async function insertRow(dbx: Dbx, values: typeof celestialBodies.$inferInsert) {
	const [created] = await dbx.insert(celestialBodies).values(values).returning()
	const [refetched] = await dbx.select().from(celestialBodies).where(eq(celestialBodies.id, created.id))
	return refetched ?? created
}

/**
 * Seed a whole preset system (system → stars → bodies → moons) in ONE
 * transaction — a mid-sequence failure (slug conflict, invalid data) rolls
 * everything back instead of orphaning a half-built system, which is what the
 * old one-POST-per-entity client flow did.
 */
export async function createCelestialFromPreset(label: string) {
	const preset = celestialPresets.find(p => p.label === label)
	if (!preset) throw error(400, `Unknown preset: ${label}`)

	return db.transaction(async (tx) => {
		const system = await createCelestialIn(tx, 'system', CREATE_SCHEMAS.system.parse({
			name: preset.system.name,
			slug: urlSlugify(preset.system.name),
		}))

		for (const starPreset of preset.stars) {
			const star = await createCelestialIn(tx, 'star', CREATE_SCHEMAS.star.parse({
				name: starPreset.name,
				slug: urlSlugify(starPreset.name),
				parentId: system.id,
				spectralType: starPreset.spectralType,
				massKg: starPreset.massKg,
				radiusM: starPreset.radiusM,
				luminosityW: starPreset.luminosityW ?? null,
				temperatureK: starPreset.temperatureK ?? null,
				age: starPreset.age,
				color: starPreset.color,
				apparentMagnitude: starPreset.apparentMagnitude,
			}))

			for (const bodyPreset of starPreset.bodies) {
				const planet = await createCelestialIn(tx, 'body', presetBodyInput(bodyPreset, star.id))
				for (const moonPreset of bodyPreset.moons ?? []) {
					await createCelestialIn(tx, 'body', presetBodyInput(moonPreset, planet.id))
				}
			}
		}

		return { name: preset.system.name, slug: system.slug }
	})
}

function presetBodyInput(preset: BodyPreset, parentId: number) {
	return CREATE_SCHEMAS.body.parse({
		name: preset.name,
		slug: urlSlugify(preset.name),
		bodyType: preset.bodyType,
		parentId,
		massKg: preset.massKg,
		radiusM: preset.radiusM,
		temperature: preset.temperature,
		atmosphere: preset.atmosphere || null,
		composition: preset.composition,
		orbitalPeriodDays: preset.orbitalPeriodDays,
		semiMajorAxisAu: preset.semiMajorAxisAu,
		eccentricity: preset.eccentricity,
		inclination: preset.inclination,
		rotationPeriodS: preset.rotationPeriodS,
		axialTilt: preset.axialTilt,
		satellites: preset.satellites,
		hasRings: preset.hasRings,
	})
}

/**
 * Update by slug. The kind is only known once the row is loaded, so — unlike
 * the create path — the Zod parse happens here rather than in the route.
 */
export async function updateCelestial(slug: string, raw: unknown) {
	const [current] = await db.select().from(celestialBodies).where(eq(celestialBodies.slug, slug))
	if (!current) throw error(404, 'Celestial entity not found')
	if (!isCelestialKind(current.kind)) throw error(500, 'Celestial entity has an invalid kind')
	const kind = current.kind

	const parsed = UPDATE_SCHEMAS[kind].safeParse(raw)
	if (!parsed.success) {
		const issue = parsed.error.issues[0]
		throw error(400, issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message)
	}
	const data = parsed.data as Record<string, unknown> & { parentId?: number | null }

	assertMergedValid(kind, current, data)

	if (data.parentId != null) {
		const bodyType = ('bodyType' in data ? data.bodyType : current.bodyType) as string | null
		await loadValidatedParent(db, kind, data.parentId, bodyType)
		if (await celestialCycleWouldForm(current.id, data.parentId)) {
			throw error(400, 'Cannot set parent to self or a descendant (circular reference)')
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (typeof data.name === 'string') {
		if (data.slug === undefined) {
			// No explicit slug in the patch — keep the legacy auto-follow behavior.
			await applyNameUpdate(setClause, data.name, current.slug, celestialBodies, celestialBodies.id, celestialBodies.slug)
		} else {
			setClause.name = data.name.trim()
		}
	}
	if (typeof data.slug === 'string') {
		await applySlugUpdate(setClause, data.slug, current.slug, celestialBodies, celestialBodies.id, celestialBodies.slug)
	}

	if (kind === 'system') {
		applyFieldUpdates(setClause, data,
			['formationAge', 'designations'],
			['distanceLy', 'galacticX', 'galacticY', 'galacticZ'])
	} else if (kind === 'star') {
		applyFieldUpdates(setClause, data,
			['spectralType', 'luminosityVisual', 'age', 'color',
				'apparentMagnitude', 'absoluteMagnitude', 'angularDiameter',
				'metallicity'],
			['massKg', 'radiusM', 'luminosityW', 'temperatureK',
				'rotationPeriodS', 'axialTilt', 'orbitalPeriodDays', 'semiMajorAxisAu',
				'eccentricity', 'parentId', 'epochPhase'])
	} else {
		applyFieldUpdates(setClause, data,
			['temperature', 'age', 'composition', 'atmosphere',
				'surfacePressure', 'apparentMagnitude', 'angularDiameter', 'albedo'],
			['massKg', 'radiusM', 'orbitalPeriodDays', 'semiMajorAxisAu',
				'eccentricity', 'inclination', 'epochPhase', 'rotationPeriodS',
				'axialTilt', 'parentId', 'satellites'])
		if (data.bodyType !== undefined) setClause.bodyType = data.bodyType
		if (data.hasRings !== undefined) setClause.hasRings = data.hasRings ?? false
	}

	if (data.extra !== undefined) setClause.extra = data.extra ?? {}
	if (data.description !== undefined) setClause.description = (data.description as string | undefined)?.trim() || ''

	// Route "lock to override" fields into the extra overflow, preserving other keys.
	if (kind === 'star') {
		setClause.extra = mergeOverrideExtras(setClause.extra ?? current.extra, data, STAR_OVERRIDE_MAP)
	} else if (kind === 'body') {
		setClause.extra = mergeOverrideExtras(setClause.extra ?? current.extra, data, BODY_OVERRIDE_MAP)
	}

	const updated = await db.transaction(async (tx) => {
		const [saved] = await tx.update(celestialBodies).set(setClause).where(eq(celestialBodies.slug, slug)).returning()
		if (!saved) return null

		// Keep any legacy content record keyed to this entity's slug in sync.
		if (typeof setClause.slug === 'string' && setClause.slug !== current.slug) {
			await moveContentByDomainSlug(tx, 'celestial', current.slug, setClause.slug)
		}

		const [refetched] = await tx.select().from(celestialBodies).where(eq(celestialBodies.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'Celestial entity not found')
	return updated
}

export async function deleteCelestial(slug: string) {
	const [current] = await db
		.select({ kind: celestialBodies.kind })
		.from(celestialBodies)
		.where(eq(celestialBodies.slug, slug))
	const label = current && isCelestialKind(current.kind) ? KIND_LABEL[current.kind] : 'Celestial entity'
	return deleteCelestialEntity(celestialBodies, celestialBodies.slug, slug, label)
}

import { error } from '@sveltejs/kit'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { rodderBodies } from '$lib/server/db/schema.js'
import {
	CREATE_SCHEMAS,
	UPDATE_SCHEMAS,
	type createSystemSchema,
	type createStarSchema,
	type createPlanetaryBodySchema,
} from '$lib/rodder/schema.js'
import { validateParentKind, isRodderKind, type RodderKind } from '$lib/rodder/parent-rules.js'
import { mergeSectorPosition, type SectorPositionMerge } from '$lib/rodder/sector-position.js'
import {
	getSectorRootForBody,
	moveSectorRoot,
	removeSectorRoot,
	resolveSectorId,
	upsertSectorRoot,
} from '$lib/server/services/rodder-sectors.js'
import { rodderPresets, type BodyPreset } from '$lib/rodder/presets.js'
import { urlSlugify } from '$lib/utils/slugify.js'
import { RODDER_TREE_CTE, rodderCycleWouldForm } from '$lib/server/rodder/hierarchy.js'
import {
	deleteRodderEntity,
	applyFieldUpdates,
	applyNameUpdate,
	applySlugUpdate,
	mergeOverrideExtras,
	STAR_OVERRIDE_MAP,
	BODY_OVERRIDE_MAP,
} from '$lib/server/rodder/update-helpers.js'
import { moveContentByDomainSlug } from '$lib/server/services/content-records.js'
import {
	normalizeRodderMediaBindings,
	replaceMediaBindingsForOwner,
} from '$lib/server/services/media-bindings.js'
import {
	installPresetSurface,
	prepareRodderPresetAssets,
} from '$lib/server/services/rodder-preset-assets.js'

type CreateSystemInput = z.infer<typeof createSystemSchema>
type CreateStarInput = z.infer<typeof createStarSchema>
type CreateBodyInput = z.infer<typeof createPlanetaryBodySchema>
export type CreateRodderInput = CreateSystemInput | CreateStarInput | CreateBodyInput

type RodderRow = typeof rodderBodies.$inferSelect

const KIND_LABEL: Record<RodderKind, string> = { system: 'System', star: 'Star', body: 'Body' }

/**
 * List rodder entities of one kind (or all), annotated with the aggregate
 * counts the old per-table list endpoints exposed:
 *  - system: starCount / planetCount over ALL descendants
 *  - star:   planetCount = descendant bodies whose nearest star is this one
 *            (the single-table equivalent of the old `star_id` join)
 *  - body:   moonCount = direct child bodies, plus nearest star name/slug
 */
export async function listRodder(options: { kind?: RodderKind, starSlug?: string | null } = {}) {
	const { kind, starSlug } = options
	let query = sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			cb.*,
			p.name AS "parentName", p.slug AS "parentSlug", p.kind AS "parentKind",
			ns.name AS "starName", ns.slug AS "starSlug",
			sr.sector_id AS "sectorId",
			s.name AS "sectorName", s.slug AS "sectorSlug", s.units AS "sectorUnits",
			sr.x AS "sectorX", sr.y AS "sectorY", sr.z AS "sectorZ",
			sr.position_provenance AS "sectorPositionProvenance",
			sr.position_uncertainty AS "sectorPositionUncertainty",
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM rodder_tree t
				WHERE t.kind = 'body'
					AND CASE cb.kind WHEN 'star' THEN t.nearest_star_id = cb.id ELSE t.root_id = cb.id END
			)::int AS "planetCount",
			(SELECT COUNT(*) FROM rodder_bodies m WHERE m.parent_id = cb.id AND m.kind = 'body')::int AS "moonCount"
		FROM rodder_bodies cb
		JOIN rodder_tree tree ON tree.id = cb.id
		LEFT JOIN rodder_bodies p ON p.id = cb.parent_id
		LEFT JOIN rodder_bodies ns ON ns.id = tree.nearest_star_id AND cb.kind = 'body'
		LEFT JOIN rodder_sector_roots sr ON sr.body_id = cb.id
		LEFT JOIN rodder_sectors s ON s.id = sr.sector_id
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

export async function getRodderBySlug(slug: string) {
	const result = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT
			cb.*,
			p.name AS "parentName", p.slug AS "parentSlug", p.kind AS "parentKind",
			ns.name AS "starName", ns.slug AS "starSlug",
			sr.sector_id AS "sectorId",
			s.name AS "sectorName", s.slug AS "sectorSlug", s.units AS "sectorUnits",
			sr.x AS "sectorX", sr.y AS "sectorY", sr.z AS "sectorZ",
			sr.position_provenance AS "sectorPositionProvenance",
			sr.position_uncertainty AS "sectorPositionUncertainty",
			(SELECT COUNT(*) FROM rodder_tree t WHERE t.root_id = cb.id AND t.kind = 'star')::int AS "starCount",
			(SELECT COUNT(*) FROM rodder_tree t
				WHERE t.kind = 'body'
					AND CASE cb.kind WHEN 'star' THEN t.nearest_star_id = cb.id ELSE t.root_id = cb.id END
			)::int AS "planetCount",
			(SELECT COUNT(*) FROM rodder_bodies m WHERE m.parent_id = cb.id AND m.kind = 'body')::int AS "moonCount"
		FROM rodder_bodies cb
		JOIN rodder_tree tree ON tree.id = cb.id
		LEFT JOIN rodder_bodies p ON p.id = cb.parent_id
		LEFT JOIN rodder_bodies ns ON ns.id = tree.nearest_star_id AND cb.kind = 'body'
		LEFT JOIN rodder_sector_roots sr ON sr.body_id = cb.id
		LEFT JOIN rodder_sectors s ON s.id = sr.sector_id
		WHERE cb.slug = ${slug}
	`)
	if (result.length === 0) throw error(404, 'Rodder entity not found')
	return result[0]
}

/** db or a transaction — creation helpers run against either. */
type Dbx = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

async function assertSlugAvailable(dbx: Dbx, slug: string) {
	const [existing] = await dbx.select({ id: rodderBodies.id }).from(rodderBodies).where(eq(rodderBodies.slug, slug))
	if (existing) throw error(409, 'A rodder entity with this slug already exists')
}

/** Load a prospective parent and enforce the kind matrix. Throws 400. */
async function loadValidatedParent(dbx: Dbx, kind: RodderKind, parentId: number, bodyType?: string | null) {
	const [parent] = await dbx
		.select({ id: rodderBodies.id, kind: rodderBodies.kind, massKg: rodderBodies.massKg })
		.from(rodderBodies)
		.where(eq(rodderBodies.id, parentId))
	if (!parent) throw error(400, 'Parent entity not found')
	if (!isRodderKind(parent.kind)) throw error(500, 'Parent entity has an invalid kind')
	const message = validateParentKind(kind, parent.kind, bodyType)
	if (message) throw error(400, message)
	return parent
}

function assertMergedValid(kind: RodderKind, current: RodderRow, patch: Record<string, unknown>) {
	const merged = CREATE_SCHEMAS[kind].safeParse({
		...current,
		...patch,
	})
	if (!merged.success) throw error(400, merged.error.issues[0].message)
}

export async function createRodder(kind: RodderKind, data: CreateRodderInput) {
	const created = await db.transaction(async tx => createRodderIn(tx, kind, data))
	return getRodderBySlug(created.slug)
}

/** Create one entity against an executor — lets preset seeding batch several into one transaction. */
async function createRodderIn(dbx: Dbx, kind: RodderKind, data: CreateRodderInput) {
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
		// Complete-triple-or-nothing before anything is written.
		const position = mergeSectorPosition(null, system)
		if (position.kind === 'invalid') throw error(400, position.message)
		const created = await insertRow(dbx, {
			...common,
			distanceLy: system.distanceLy ?? null,
			formationAge: system.formationAge?.trim() || null,
			designations: system.designations?.trim() || null,
			extra: system.extra ?? {},
		})
		// A system has no orbital parent, so it is always a sector root — with an
		// explicitly unknown position until one is authored.
		const sectorId = await resolveSectorId(dbx, system.sectorId)
		await upsertSectorRoot(dbx, created.id, sectorId, position.kind === 'set' ? position : null)
		return created
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
	if (body.parentId != null) await loadValidatedParent(dbx, 'body', body.parentId, body.bodyType)
	const position = mergeSectorPosition(null, body)
	if (position.kind === 'invalid') throw error(400, position.message)

	const created = await insertRow(dbx, {
		...common,
		parentId: body.parentId ?? null,
		bodyType: body.bodyType,
		massKg: body.massKg ?? null,
		radiusM: body.radiusM ?? null,
		temperatureK: body.temperatureK ?? null,
		age: body.age?.trim() || null,
		composition: body.composition?.trim() || null,
		atmosphere: body.atmosphere?.trim() || null,
		surfacePressure: body.surfacePressure?.trim() || null,
		orbitalPeriodDays: body.orbitalPeriodDays ?? null,
		semiMajorAxisAu: body.semiMajorAxisAu ?? null,
		eccentricity: body.eccentricity ?? null,
		inclination: body.inclination ?? null,
		longitudeAscendingNode: body.longitudeAscendingNode ?? null,
		argumentOfPeriapsis: body.argumentOfPeriapsis ?? null,
		epochPhase: body.epochPhase ?? null,
		rotationPeriodS: body.rotationPeriodS ?? null,
		axialTilt: body.axialTilt ?? null,
		apparentMagnitude: body.apparentMagnitude?.trim() || null,
		angularDiameter: body.angularDiameter?.trim() || null,
		satellites: body.satellites ?? null,
		hasRings: body.hasRings ?? false,
		extra: mergeOverrideExtras(body.extra, body as Record<string, unknown>, BODY_OVERRIDE_MAP),
	})
	if (body.parentId == null) {
		const sectorId = await resolveSectorId(dbx, body.sectorId)
		await upsertSectorRoot(dbx, created.id, sectorId, position.kind === 'set' ? position : null)
	}
	return created
}

async function insertRow(dbx: Dbx, values: typeof rodderBodies.$inferInsert) {
	const [created] = await dbx.insert(rodderBodies).values(values).returning()
	const [refetched] = await dbx.select().from(rodderBodies).where(eq(rodderBodies.id, created.id))
	return refetched ?? created
}

/**
 * Seed a whole preset system (system → stars → bodies → moons) in ONE
 * transaction — a mid-sequence failure (slug conflict, invalid data) rolls
 * everything back instead of orphaning a half-built system, which is what the
 * old one-POST-per-entity client flow did.
 */
export async function createRodderFromPreset(label: string) {
	const preset = rodderPresets.find(p => p.label === label)
	if (!preset) throw error(400, `Unknown preset: ${label}`)
	const preparedAssets = await prepareRodderPresetAssets(preset)

	return db.transaction(async (tx) => {
		const system = await createRodderIn(tx, 'system', CREATE_SCHEMAS.system.parse({
			name: preset.system.name,
			slug: urlSlugify(preset.system.name),
		}))

		for (const starPreset of preset.stars) {
			const star = await createRodderIn(tx, 'star', CREATE_SCHEMAS.star.parse({
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
				const bodyExtra = await installPresetSurface(tx, bodyPreset, preparedAssets.get(bodyPreset))
				const planet = await createRodderIn(tx, 'body', presetBodyInput(bodyPreset, star.id, bodyExtra))
				await registerCreatedMediaBindings(tx, planet)
				for (const moonPreset of bodyPreset.moons ?? []) {
					const moonExtra = await installPresetSurface(tx, moonPreset, preparedAssets.get(moonPreset))
					const moon = await createRodderIn(tx, 'body', presetBodyInput(moonPreset, planet.id, moonExtra))
					await registerCreatedMediaBindings(tx, moon)
				}
			}
		}

		return { name: preset.system.name, slug: system.slug }
	})
}

async function registerCreatedMediaBindings(dbx: Dbx, body: RodderRow) {
	if (!body.extra || typeof body.extra !== 'object' || !('surface' in body.extra)) return
	const normalized = await normalizeRodderMediaBindings(dbx, body.id, 'body', body.extra)
	if (!normalized) return
	await dbx.update(rodderBodies).set({ extra: normalized.extra }).where(eq(rodderBodies.id, body.id))
	await replaceMediaBindingsForOwner(dbx, 'rodder', body.id, normalized.rows)
}

function presetBodyInput(preset: BodyPreset, parentId: number, extra: Record<string, unknown>) {
	return CREATE_SCHEMAS.body.parse({
		name: preset.name,
		slug: urlSlugify(preset.name),
		description: preset.description,
		bodyType: preset.bodyType,
		parentId,
		massKg: preset.massKg,
		radiusM: preset.radiusM,
		temperatureK: preset.temperatureK,
		atmosphere: preset.atmosphere || null,
		surfacePressure: preset.surfacePressure ?? null,
		composition: preset.composition,
		orbitalPeriodDays: preset.orbitalPeriodDays,
		semiMajorAxisAu: preset.semiMajorAxisAu,
		eccentricity: preset.eccentricity,
		inclination: preset.inclination,
		longitudeAscendingNode: preset.longitudeAscendingNode ?? null,
		argumentOfPeriapsis: preset.argumentOfPeriapsis ?? null,
		epochPhase: preset.epochPhase ?? null,
		rotationPeriodS: preset.rotationPeriodS,
		axialTilt: preset.axialTilt,
		satellites: preset.satellites,
		hasRings: preset.hasRings,
		extra,
	})
}

/**
 * Update by slug. The kind is only known once the row is loaded, so — unlike
 * the create path — the Zod parse happens here rather than in the route.
 */
export async function updateRodder(slug: string, raw: unknown) {
	const [current] = await db.select().from(rodderBodies).where(eq(rodderBodies.slug, slug))
	if (!current) throw error(404, 'Rodder entity not found')
	if (!isRodderKind(current.kind)) throw error(500, 'Rodder entity has an invalid kind')
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
		if (await rodderCycleWouldForm(current.id, data.parentId)) {
			throw error(400, 'Cannot set parent to self or a descendant (circular reference)')
		}
	}

	const setClause: Record<string, unknown> = { updatedAt: new Date() }

	if (typeof data.name === 'string') {
		if (data.slug === undefined) {
			// No explicit slug in the patch — keep the legacy auto-follow behavior.
			await applyNameUpdate(setClause, data.name, current.slug, rodderBodies, rodderBodies.id, rodderBodies.slug)
		} else {
			setClause.name = data.name.trim()
		}
	}
	if (typeof data.slug === 'string') {
		await applySlugUpdate(setClause, data.slug, current.slug, rodderBodies, rodderBodies.id, rodderBodies.slug)
	}

	// Sector position lives on the root record, not the system row. Merge the
	// patch over the stored position so a field-wise update can't strand a
	// partial triple, and reject before anything is written.
	let sectorPosition: SectorPositionMerge = { kind: 'unchanged' }
	const currentRoot = kind === 'system' || kind === 'body'
		? await getSectorRootForBody(db, current.id)
		: null
	const nextParentId = kind === 'body'
		? (data.parentId === undefined ? current.parentId : data.parentId)
		: null
	const remainsSectorRoot = kind === 'system' || (kind === 'body' && nextParentId == null)
	if (remainsSectorRoot) {
		sectorPosition = mergeSectorPosition(currentRoot, data as { sectorX?: number | null, sectorY?: number | null, sectorZ?: number | null })
		if (sectorPosition.kind === 'invalid') throw error(400, sectorPosition.message)
	}

	if (kind === 'system') {
		applyFieldUpdates(setClause, data,
			['formationAge', 'designations'],
			['distanceLy'])
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
			['age', 'composition', 'atmosphere',
				'surfacePressure', 'apparentMagnitude', 'angularDiameter'],
			['massKg', 'radiusM', 'temperatureK', 'orbitalPeriodDays', 'semiMajorAxisAu',
				'eccentricity', 'inclination', 'longitudeAscendingNode', 'argumentOfPeriapsis',
				'epochPhase', 'rotationPeriodS', 'axialTilt', 'parentId', 'satellites'])
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
		const mediaBindingUpdate = await normalizeRodderMediaBindings(tx, current.id, kind, setClause.extra ?? current.extra)
		if (mediaBindingUpdate) setClause.extra = mediaBindingUpdate.extra
		const [saved] = await tx.update(rodderBodies).set(setClause).where(eq(rodderBodies.slug, slug)).returning()
		if (!saved) return null
		if (mediaBindingUpdate) {
			await replaceMediaBindingsForOwner(tx, 'rodder', current.id, mediaBindingUpdate.rows)
		}

		// Persist the merged sector position on the root record. Provenance
		// becomes 'authored' — the author just asserted (or cleared) it.
		if (remainsSectorRoot && (sectorPosition.kind !== 'unchanged' || data.sectorId !== undefined || !currentRoot)) {
			const sectorId = await resolveSectorId(
				tx,
				typeof data.sectorId === 'number' ? data.sectorId : currentRoot?.sectorId,
			)
			if (sectorPosition.kind === 'unchanged' && currentRoot) {
				await moveSectorRoot(tx, current.id, sectorId)
			} else {
				await upsertSectorRoot(tx, current.id, sectorId, sectorPosition.kind === 'set' ? sectorPosition : null)
			}
		} else if (kind === 'body' && currentRoot) {
			await removeSectorRoot(tx, current.id)
		}

		// Keep any legacy content record keyed to this entity's slug in sync.
		if (typeof setClause.slug === 'string' && setClause.slug !== current.slug) {
			await moveContentByDomainSlug(tx, 'rodder', current.slug, setClause.slug)
		}

		const [refetched] = await tx.select().from(rodderBodies).where(eq(rodderBodies.id, saved.id))
		return refetched ?? saved
	})

	if (!updated) throw error(404, 'Rodder entity not found')
	return getRodderBySlug(updated.slug)
}

export async function deleteRodder(slug: string) {
	const [current] = await db
		.select({ kind: rodderBodies.kind })
		.from(rodderBodies)
		.where(eq(rodderBodies.slug, slug))
	const label = current && isRodderKind(current.kind) ? KIND_LABEL[current.kind] : 'Rodder entity'
	return deleteRodderEntity(rodderBodies, rodderBodies.slug, slug, label)
}

import { eq, sql } from 'drizzle-orm'
import { deriveSystemType } from 'tungolcraft'
import { db } from '$lib/server/db/index.js'
import { rodderBodies, rodderSectorRoots, rodderSectors } from '$lib/server/db/schema.js'
import { RODDER_TREE_CTE } from '$lib/server/rodder/hierarchy.js'
import {
	rodderEntityDocumentSchema,
	rodderSectorDocumentSchema,
	type RodderDiagnostic,
	type RodderEntityDocument,
	type RodderKind,
	type RodderResourceRef,
	type RodderSectorDocument,
} from '$lib/rodder/consumer-contract.js'
import { sectorBoundsRadius } from '$lib/rodder/sector-view.js'
import type { MapBody } from '$lib/rodder/root-layout.js'
import { resolveRodderModel } from './rodder-models.js'
import { getCalendarsForRoot, getRootMapEntities } from './rodder-registry.js'
import {
	getApparentSkyForRoot,
	getSectorBySlug,
	type SectorContext,
} from './rodder-sectors.js'

type RodderRow = typeof rodderBodies.$inferSelect

type HierarchyRow = {
	rootId: number
	rootKind: RodderKind
	depth: number
}

type PlacementRow = SectorContext & {
	referenceEpoch: string | null
	positionUncertainty: number | null
	notes: string | null
}

function iso(value: Date | string | null | undefined): string | null {
	if (value == null) return null
	return (value instanceof Date ? value : new Date(value)).toISOString()
}

function publicPageHref(slug: string): string {
	return `/Rodder:${encodeURI(slug)}`
}

function sectorPageHref(slug: string): string {
	return `/rodder/sector/${encodeURIComponent(slug)}`
}

function ref(row: Pick<RodderRow, 'id' | 'kind' | 'name' | 'slug'>): RodderResourceRef {
	return {
		id: row.id,
		kind: row.kind as RodderKind,
		name: row.name,
		slug: row.slug,
		href: publicPageHref(row.slug),
	}
}

async function findEntity(identifier: string): Promise<RodderRow | null> {
	const [row] = await db.select().from(rodderBodies).where(sql`
		LOWER(${rodderBodies.slug}) = LOWER(${identifier})
		OR LOWER(REPLACE(${rodderBodies.name}, ' ', '_')) = LOWER(${identifier})
	`)
	return row ?? null
}

async function hierarchyFor(id: number): Promise<HierarchyRow | null> {
	const [row] = await db.execute(sql`
		WITH RECURSIVE ${RODDER_TREE_CTE}
		SELECT root_id AS "rootId", root_kind AS "rootKind", depth
		FROM rodder_tree WHERE id = ${id}
	`)
	return row as unknown as HierarchyRow | null
}

async function ancestorsFor(id: number): Promise<RodderRow[]> {
	return await db.execute(sql`
		WITH RECURSIVE up AS (
			SELECT parent_id, 0 AS depth FROM rodder_bodies WHERE id = ${id}
			UNION ALL
			SELECT cb.parent_id, up.depth + 1
			FROM rodder_bodies cb JOIN up ON cb.id = up.parent_id
			WHERE up.depth < 20
		)
		SELECT cb.* FROM up JOIN rodder_bodies cb ON cb.id = up.parent_id
		ORDER BY up.depth DESC
	`) as unknown as RodderRow[]
}

async function placementFor(rootId: number): Promise<PlacementRow | null> {
	const [row] = await db
		.select({
			sectorId: rodderSectors.id,
			sectorName: rodderSectors.name,
			sectorSlug: rodderSectors.slug,
			units: rodderSectors.units,
			handedness: rodderSectors.handedness,
			originKind: rodderSectors.originKind,
			sectorProvenance: rodderSectors.provenance,
			referenceEpoch: rodderSectors.referenceEpoch,
			x: rodderSectorRoots.x,
			y: rodderSectorRoots.y,
			z: rodderSectorRoots.z,
			positionProvenance: rodderSectorRoots.positionProvenance,
			positionUncertainty: rodderSectorRoots.positionUncertainty,
			notes: rodderSectorRoots.notes,
		})
		.from(rodderSectorRoots)
		.innerJoin(rodderSectors, eq(rodderSectors.id, rodderSectorRoots.sectorId))
		.where(eq(rodderSectorRoots.bodyId, rootId))
	return row as PlacementRow | null
}

function sourceFact(value: unknown, source: string | null, derived = false) {
	return value == null
		? { value: null, status: 'unavailable' as const, source }
		: { value, status: derived ? 'derived' as const : 'authored' as const, source }
}

function authoredFor(row: RodderRow) {
	const extensions = row.extra && typeof row.extra === 'object' && !Array.isArray(row.extra)
		? row.extra as Record<string, unknown>
		: {}
	return {
		description: row.description ?? '',
		article: {
			wikitext: row.body ?? '',
			plainText: row.bodyPlainText ?? '',
			updatedAt: iso(row.bodyUpdatedAt),
		},
		physical: {
			massKg: row.massKg ?? null,
			radiusM: row.radiusM ?? null,
			age: row.age ?? null,
			temperatureK: row.temperatureK ?? null,
		},
		observation: {
			apparentMagnitude: row.apparentMagnitude ?? null,
			absoluteMagnitude: row.absoluteMagnitude ?? null,
			angularDiameter: row.angularDiameter ?? null,
		},
		orbit: {
			orbitalPeriodDays: row.orbitalPeriodDays ?? null,
			semiMajorAxisAu: row.semiMajorAxisAu ?? null,
			eccentricity: row.eccentricity ?? null,
			epochPhase: row.epochPhase ?? null,
			inclination: row.inclination ?? null,
			longitudeAscendingNode: row.longitudeAscendingNode ?? null,
			argumentOfPeriapsis: row.argumentOfPeriapsis ?? null,
		},
		rotation: {
			periodS: row.rotationPeriodS ?? null,
			axialTilt: row.axialTilt ?? null,
		},
		stellar: row.kind === 'star'
			? {
				spectralType: row.spectralType ?? null,
				luminosityW: row.luminosityW ?? null,
				luminosityVisual: row.luminosityVisual ?? null,
				color: row.color ?? null,
				metallicity: row.metallicity ?? null,
			}
			: null,
		planetary: row.kind === 'body'
			? {
				bodyType: row.bodyType ?? 'planet',
				composition: row.composition ?? null,
				atmosphere: row.atmosphere ?? null,
				surfacePressure: row.surfacePressure ?? null,
				satellites: row.satellites ?? null,
				hasRings: row.hasRings ?? false,
			}
			: null,
		system: row.kind === 'system'
			? {
				distanceLy: row.distanceLy ?? null,
				formationAge: row.formationAge ?? null,
				designations: row.designations ?? null,
			}
			: null,
		extensions,
	}
}

export async function resolveRodderEntityDocument(identifier: string): Promise<RodderEntityDocument | null> {
	const entity = await findEntity(identifier)
	if (!entity) return null

	const hierarchy = await hierarchyFor(entity.id)
	if (!hierarchy) return null
	const isRoot = hierarchy.rootId === entity.id

	const [root, parent, ancestors, children, placement, model] = await Promise.all([
		db.select().from(rodderBodies).where(eq(rodderBodies.id, hierarchy.rootId)).then(rows => rows[0] ?? entity),
		entity.parentId == null
			? Promise.resolve(null)
			: db.select().from(rodderBodies).where(eq(rodderBodies.id, entity.parentId)).then(rows => rows[0] ?? null),
		ancestorsFor(entity.id),
		db.select().from(rodderBodies).where(eq(rodderBodies.parentId, entity.id)),
		placementFor(hierarchy.rootId),
		entity.kind === 'star' || entity.kind === 'body'
			? resolveRodderModel(entity.kind, entity.slug)
			: Promise.resolve(null),
	])

	const diagnostics: RodderDiagnostic[] = []
	if (!placement && isRoot) diagnostics.push({
		code: 'sector-placement-unavailable', severity: 'info', path: 'placement',
		message: 'This root does not belong to a declared sector frame.',
	})
	if (placement && (placement.x == null || placement.y == null || placement.z == null)) diagnostics.push({
		code: 'sector-position-incomplete', severity: 'warning', path: 'placement.position',
		message: 'The containing root has no complete sector position.',
	})
	if ((entity.kind === 'star' || entity.kind === 'body') && !model) diagnostics.push({
		code: 'derived-model-unavailable', severity: 'warning', path: 'resolved.facts.model',
		message: 'A normalized physical model could not be derived from the authored facts.',
	})

	let rootMap: RodderEntityDocument['displays']['rootMap'] = null
	let effectivePeriodSource: 'stored' | 'derived' | 'unavailable' = entity.orbitalPeriodDays == null
		? 'unavailable'
		: 'stored'
	if (isRoot && (entity.kind === 'system' || entity.kind === 'body')) {
		const [map, apparentSky, calendars] = await Promise.all([
			getRootMapEntities(entity.id),
			getApparentSkyForRoot(entity.id),
			getCalendarsForRoot(entity.id),
		])
		const selected = [...map.stars, ...map.bodies].find(member => member.id === entity.id)
		if (selected?.effectivePeriodSource) effectivePeriodSource = selected.effectivePeriodSource
		if (map.stars.length > 0 || map.bodies.length > 0) {
			rootMap = {
				rootName: entity.name,
				stars: map.stars.map(star => ({ ...star, bodyType: 'star', isStar: true })) as unknown as MapBody[],
				bodies: map.bodies as unknown as MapBody[],
				apparentSky,
				calendars,
			}
			if (apparentSky.status === 'unavailable') diagnostics.push({
				code: 'apparent-sky-unavailable', severity: 'info', path: 'displays.rootMap.apparentSky',
				message: apparentSky.reason ?? 'The apparent sky is unavailable.',
			})
		} else diagnostics.push({
			code: 'root-map-empty', severity: 'info', path: 'displays.rootMap',
			message: 'This root has no renderable stellar or body members.',
		})
	}

	const starCount = rootMap?.stars.length ?? (entity.kind === 'star' ? 1 : 0)
	const bodyCount = rootMap?.bodies.length ?? (entity.kind === 'body' ? 1 : 0)
	const modelValue = model == null ? null : model
	const facts: RodderEntityDocument['resolved']['facts'] = {
		model: sourceFact(modelValue, model ? 'tungolcraft' : null, true),
		orbitalPeriodDays: sourceFact(
			rootMap
				? [...rootMap.stars, ...rootMap.bodies].find(member => member.id === entity.id)?.orbitalPeriodDays ?? entity.orbitalPeriodDays
				: entity.orbitalPeriodDays,
			effectivePeriodSource,
			effectivePeriodSource === 'derived',
		),
		starCount: sourceFact(starCount, 'hierarchy', true),
		bodyCount: sourceFact(bodyCount, 'hierarchy', true),
	}
	if (entity.kind === 'system') facts.systemType = sourceFact(deriveSystemType(starCount), 'hierarchy', true)

	const identity = ref(entity)
	const rootRef = ref(root)
	const position = placement
		? {
			sector: {
				id: placement.sectorId,
				name: placement.sectorName,
				slug: placement.sectorSlug,
				units: placement.units as 'ly' | 'pc',
				handedness: placement.handedness as 'right-handed' | 'left-handed',
				originKind: placement.originKind,
				provenance: placement.sectorProvenance,
				href: sectorPageHref(placement.sectorSlug),
			},
			position: {
				x: placement.x ?? null,
				y: placement.y ?? null,
				z: placement.z ?? null,
				provenance: placement.positionProvenance,
				uncertainty: placement.positionUncertainty,
				notes: placement.notes,
			},
		}
		: null
	const extensions = entity.extra as Record<string, unknown> | null

	return rodderEntityDocumentSchema.parse({
		resource: 'rodder-entity',
		identity,
		authored: authoredFor(entity),
		relationships: {
			parent: parent ? ref(parent) : null,
			root: rootRef,
			ancestors: ancestors.map(ref),
			children: children.map(ref),
		},
		placement: position,
		resolved: { facts },
		displays: { rootMap },
		capabilities: {
			article: Boolean(entity.body?.trim()),
			rootMap: rootMap != null,
			sectorPlacement: placement != null,
			surface: Boolean(extensions?.surface || extensions?.stellarSurface),
			weather: Boolean(extensions?.weather),
			calendar: Boolean(rootMap?.calendars.length),
		},
		links: {
			self: `/api/rodder/${encodeURIComponent(entity.slug)}`,
			page: identity.href,
			root: rootRef.href,
			parent: parent ? publicPageHref(parent.slug) : null,
			sector: placement ? sectorPageHref(placement.sectorSlug) : null,
		},
		diagnostics,
		updatedAt: iso(entity.updatedAt)!,
	})
}

export async function resolveRodderEntityDocuments(identifiers: readonly string[]) {
	const unique = [...new Set(identifiers.map(value => value.trim()).filter(Boolean))]
	const entries = await Promise.all(unique.map(async identifier => [identifier, await resolveRodderEntityDocument(identifier)] as const))
	return Object.fromEntries(entries)
}

export async function resolveRodderSectorDocument(identifier: string): Promise<RodderSectorDocument | null> {
	const [match] = await db.select({ slug: rodderSectors.slug })
		.from(rodderSectors)
		.where(sql`LOWER(${rodderSectors.slug}) = LOWER(${identifier})`)
	if (!match) return null
	const { sector, roots: rawRoots } = await getSectorBySlug(match.slug)
	const origin = sector.originBodyId == null
		? null
		: await db.select().from(rodderBodies).where(eq(rodderBodies.id, sector.originBodyId)).then(rows => rows[0] ?? null)
	const roots = rawRoots.map(root => ({
		...root,
		kind: root.kind as RodderKind,
		href: publicPageHref(root.slug),
	}))
	const positioned = roots.filter(root => root.x != null && root.y != null && root.z != null)
	const diagnostics: RodderDiagnostic[] = []
	if (!sector.shape) diagnostics.push({
		code: 'sector-extent-undeclared', severity: 'info', path: 'frame.shape',
		message: 'This sector has no authored spatial extent.',
	})
	if (positioned.length !== roots.length) diagnostics.push({
		code: 'sector-roots-unpositioned', severity: 'warning', path: 'roots',
		message: `${roots.length - positioned.length} root${roots.length - positioned.length === 1 ? '' : 's'} omitted from spatial rendering because position is unavailable.`,
	})

	return rodderSectorDocumentSchema.parse({
		resource: 'rodder-sector',
		identity: {
			id: sector.id,
			name: sector.name,
			slug: sector.slug,
			description: sector.description,
			href: sectorPageHref(sector.slug),
		},
		frame: {
			units: sector.units,
			shape: sector.shape,
			radius: sector.radius,
			extentX: sector.extentX,
			extentY: sector.extentY,
			extentZ: sector.extentZ,
			originKind: sector.originKind,
			origin: origin ? ref(origin) : null,
			axesNote: sector.axesNote,
			handedness: sector.handedness,
			referenceEpoch: sector.referenceEpoch,
			provenance: sector.provenance,
		},
		roots,
		resolved: {
			rootCount: roots.length,
			positionedRootCount: positioned.length,
			unpositionedRootCount: roots.length - positioned.length,
			boundsRadius: sectorBoundsRadius(roots),
		},
		displays: { sectorMap: { units: sector.units, roots } },
		capabilities: { sectorMap: true, rootNavigation: roots.length > 0 },
		links: {
			self: `/api/rodder/sectors/${encodeURIComponent(sector.slug)}`,
			page: sectorPageHref(sector.slug),
		},
		diagnostics,
		updatedAt: iso(sector.updatedAt)!,
	})
}

export async function resolveRodderSectorDocuments(identifiers: readonly string[]) {
	const unique = [...new Set(identifiers.map(value => value.trim()).filter(Boolean))]
	const entries = await Promise.all(unique.map(async identifier => [identifier, await resolveRodderSectorDocument(identifier)] as const))
	return Object.fromEntries(entries)
}

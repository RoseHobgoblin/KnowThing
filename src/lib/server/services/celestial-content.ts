import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	planetaryBodies,
	starSystems,
	stars,
} from '$lib/server/db/schema.js'
import {
	deleteContentRecord,
	ensureContentRecord,
	saveContentRecordAtomic,
	type ContentRecordsDatabase,
} from '$lib/server/services/content-records.js'

async function getSystemSlug(database: ContentRecordsDatabase, systemId: number | null) {
	if (!systemId) return null

	const [system] = await database
		.select({ slug: starSystems.slug })
		.from(starSystems)
		.where(eq(starSystems.id, systemId))

	return system?.slug ?? null
}

async function getParentPathForStar(database: ContentRecordsDatabase, systemId: number | null) {
	return getSystemSlug(database, systemId)
}

async function getParentPathForBody(database: ContentRecordsDatabase, starId: number | null) {
	if (!starId) return null

	const [star] = await database
		.select({ systemId: stars.systemId })
		.from(stars)
		.where(eq(stars.id, starId))

	return getSystemSlug(database, star?.systemId ?? null)
}

export async function ensureSystemContentRecord(
	database: ContentRecordsDatabase,
	system: { id: number, slug: string, name: string, contentRecordId: number | null },
) {
	return ensureContentRecord(database, {
		domain: 'celestial',
		contentRecordId: system.contentRecordId,
		slug: system.slug,
		title: system.name,
		parentPath: null,
		attach: async (contentRecordId) => {
			await database
				.update(starSystems)
				.set({ contentRecordId, updatedAt: new Date() })
				.where(eq(starSystems.id, system.id))
		},
	})
}

export async function ensureStarContentRecord(
	database: ContentRecordsDatabase,
	star: { id: number, slug: string, name: string, systemId: number | null, contentRecordId: number | null },
) {
	const parentPath = await getParentPathForStar(database, star.systemId)

	return ensureContentRecord(database, {
		domain: 'celestial',
		contentRecordId: star.contentRecordId,
		slug: star.slug,
		title: star.name,
		parentPath,
		attach: async (contentRecordId) => {
			await database
				.update(stars)
				.set({ contentRecordId, updatedAt: new Date() })
				.where(eq(stars.id, star.id))
		},
	})
}

export async function ensurePlanetaryBodyContentRecord(
	database: ContentRecordsDatabase,
	body: { id: number, slug: string, name: string, starId: number | null, contentRecordId: number | null },
) {
	const parentPath = await getParentPathForBody(database, body.starId)

	return ensureContentRecord(database, {
		domain: 'celestial',
		contentRecordId: body.contentRecordId,
		slug: body.slug,
		title: body.name,
		parentPath,
		attach: async (contentRecordId) => {
			await database
				.update(planetaryBodies)
				.set({ contentRecordId, updatedAt: new Date() })
				.where(eq(planetaryBodies.id, body.id))
		},
	})
}

export async function syncBodiesForStar(database: ContentRecordsDatabase, starId: number) {
	const bodies = await database
		.select({
			id: planetaryBodies.id,
			slug: planetaryBodies.slug,
			name: planetaryBodies.name,
			starId: planetaryBodies.starId,
			contentRecordId: planetaryBodies.contentRecordId,
		})
		.from(planetaryBodies)
		.where(eq(planetaryBodies.starId, starId))

	for (const body of bodies) {
		await ensurePlanetaryBodyContentRecord(database, body)
	}
}

export async function saveCelestialContent(input: {
	contentRecordId: number
	content: string
	editSummary: string
	userId: number
}) {
	const result = await saveContentRecordAtomic(input)
	if (!result.ok) return { ok: false as const, status: result.status, error: result.error }
	return { ok: true as const }
}

export async function deleteCelestialContentRecord(database: ContentRecordsDatabase, contentRecordId: number | null) {
	await deleteContentRecord(database, contentRecordId)
}

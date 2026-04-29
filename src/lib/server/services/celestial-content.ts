import { and, eq, isNull } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import {
	contentRecords,
	contentRevisions,
	planetaryBodies,
	starSystems,
	stars,
} from '$lib/server/db/schema.js'
import {
	backfillLinkTargets,
	deleteContentEffects,
	updateContentEffects,
} from '$lib/server/content-effects.js'

type ContentDatabase = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

type CelestialContentInput = {
	contentRecordId: number | null
	slug: string
	title: string
	parentPath: string | null
	attach: (contentRecordId: number) => Promise<void>
}

async function findExistingCelestialContentRecord(
	database: ContentDatabase,
	slug: string,
	parentPath: string | null,
) {
	const conditions = [
		eq(contentRecords.domain, 'celestial'),
		eq(contentRecords.slug, slug),
		parentPath === null ? isNull(contentRecords.parentPath) : eq(contentRecords.parentPath, parentPath),
	]

	const [existing] = await database
		.select({ id: contentRecords.id })
		.from(contentRecords)
		.where(and(...conditions))

	return existing ?? null
}

async function ensureCelestialContentRecord(
	database: ContentDatabase,
	input: CelestialContentInput,
) {
	let recordId = input.contentRecordId

	if (recordId) {
		const [existingById] = await database
			.select({ id: contentRecords.id })
			.from(contentRecords)
			.where(eq(contentRecords.id, recordId))

		if (!existingById) {
			recordId = null
		}
	}

	if (!recordId) {
		const existing = await findExistingCelestialContentRecord(database, input.slug, input.parentPath)
		if (existing) {
			recordId = existing.id
			await database
				.update(contentRecords)
				.set({
					title: input.title,
					slug: input.slug,
					parentPath: input.parentPath,
					updatedAt: new Date(),
				})
				.where(eq(contentRecords.id, recordId))
		} else {
			const [created] = await database
				.insert(contentRecords)
				.values({
					domain: 'celestial',
					slug: input.slug,
					parentPath: input.parentPath,
					title: input.title,
					content: '',
					plainText: '',
					sizeBytes: 0,
				})
				.returning({ id: contentRecords.id })

			recordId = created.id
			await backfillLinkTargets(database, recordId, 'celestial', input.slug)
		}

		await input.attach(recordId)
	} else {
		await database
			.update(contentRecords)
			.set({
				title: input.title,
				slug: input.slug,
				parentPath: input.parentPath,
				updatedAt: new Date(),
			})
			.where(eq(contentRecords.id, recordId))
	}

	return recordId
}

async function getSystemSlug(database: ContentDatabase, systemId: number | null) {
	if (!systemId) return null

	const [system] = await database
		.select({ slug: starSystems.slug })
		.from(starSystems)
		.where(eq(starSystems.id, systemId))

	return system?.slug ?? null
}

async function getParentPathForStar(database: ContentDatabase, systemId: number | null) {
	return getSystemSlug(database, systemId)
}

async function getParentPathForBody(database: ContentDatabase, starId: number | null) {
	if (!starId) return null

	const [star] = await database
		.select({ systemId: stars.systemId })
		.from(stars)
		.where(eq(stars.id, starId))

	return getSystemSlug(database, star?.systemId ?? null)
}

export async function ensureSystemContentRecord(
	database: ContentDatabase,
	system: { id: number, slug: string, name: string, contentRecordId: number | null },
) {
	return ensureCelestialContentRecord(database, {
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
	database: ContentDatabase,
	star: { id: number, slug: string, name: string, systemId: number | null, contentRecordId: number | null },
) {
	const parentPath = await getParentPathForStar(database, star.systemId)

	return ensureCelestialContentRecord(database, {
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
	database: ContentDatabase,
	body: { id: number, slug: string, name: string, starId: number | null, contentRecordId: number | null },
) {
	const parentPath = await getParentPathForBody(database, body.starId)

	return ensureCelestialContentRecord(database, {
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

export async function syncBodiesForStar(database: ContentDatabase, starId: number) {
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
	const [existing] = await db
		.select()
		.from(contentRecords)
		.where(eq(contentRecords.id, input.contentRecordId))

	if (!existing) return { ok: false as const, status: 404, error: 'Content record not found' }

	const sizeBytes = new TextEncoder().encode(input.content).length
	const { plainText, ast } = await updateContentEffects(db, input.contentRecordId, input.content, 'celestial')

	await db
		.update(contentRecords)
		.set({ content: input.content, plainText, parsedAst: ast, sizeBytes, updatedAt: new Date() })
		.where(eq(contentRecords.id, input.contentRecordId))

	await db.insert(contentRevisions).values({
		contentRecordId: input.contentRecordId,
		title: existing.title,
		content: input.content,
		sizeBytes,
		editSummary: input.editSummary,
		userId: input.userId,
	})

	return { ok: true as const }
}

export async function deleteCelestialContentRecord(database: ContentDatabase, contentRecordId: number | null) {
	if (!contentRecordId) return

	await deleteContentEffects(contentRecordId)
	await database.delete(contentRecords).where(eq(contentRecords.id, contentRecordId))
}

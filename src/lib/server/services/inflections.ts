import { error } from '@sveltejs/kit'
import { and, asc, count, eq, notInArray } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import {
	inflectionDimensions,
	languages,
	paradigmClasses,
	paradigmRules,
} from '$lib/server/db/schema.js'
import { generateCellKeys } from '$lib/wordbook/cell-keys.js'
import { rebuildClassForms } from '$lib/server/wordbook/inflection.js'
import type {
	createDimensionSchema,
	createParadigmClassSchema,
	updateDimensionSchema,
	updateParadigmClassSchema,
} from '$lib/server/http/languages/schemas.js'

type CreateDimensionInput = z.infer<typeof createDimensionSchema>
type UpdateDimensionInput = z.infer<typeof updateDimensionSchema>
type CreateParadigmClassInput = z.infer<typeof createParadigmClassSchema>
type UpdateParadigmClassInput = z.infer<typeof updateParadigmClassSchema>

async function assertLanguage(slug: string) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) throw error(404, 'Language not found')
	return lang
}

export async function getInflectionsForLanguage(slug: string) {
	const lang = await assertLanguage(slug)
	return getInflectionsByLanguageId(lang.id)
}

export async function countRulesByClass(languageId: number): Promise<Record<number, number>> {
	const rows = await db
		.select({ classId: paradigmRules.classId, n: count() })
		.from(paradigmRules)
		.innerJoin(paradigmClasses, eq(paradigmRules.classId, paradigmClasses.id))
		.where(eq(paradigmClasses.languageId, languageId))
		.groupBy(paradigmRules.classId)
	const map: Record<number, number> = {}
	for (const r of rows) map[r.classId] = Number(r.n)
	return map
}

export async function listClassesForLanguage(languageId: number) {
	return db
		.select({ id: paradigmClasses.id, name: paradigmClasses.name, partOfSpeech: paradigmClasses.partOfSpeech })
		.from(paradigmClasses)
		.where(eq(paradigmClasses.languageId, languageId))
		.orderBy(asc(paradigmClasses.partOfSpeech), asc(paradigmClasses.name))
}

export async function getInflectionsByLanguageId(languageId: number) {
	const dimensions = await db
		.select()
		.from(inflectionDimensions)
		.where(eq(inflectionDimensions.languageId, languageId))
		.orderBy(asc(inflectionDimensions.partOfSpeech), asc(inflectionDimensions.sortOrder))

	const classes = await db
		.select()
		.from(paradigmClasses)
		.where(eq(paradigmClasses.languageId, languageId))
		.orderBy(asc(paradigmClasses.partOfSpeech), asc(paradigmClasses.name))

	return { dimensions, classes }
}

export async function createParadigmClass(slug: string, data: CreateParadigmClassInput) {
	const lang = await assertLanguage(slug)

	const [cls] = await db
		.insert(paradigmClasses)
		.values({
			languageId: lang.id,
			partOfSpeech: data.partOfSpeech.trim(),
			name: data.name.trim(),
			description: data.description?.trim() || null,
		})
		.returning()
	return cls
}

export async function getParadigmClass(classId: number) {
	const [cls] = await db.select().from(paradigmClasses).where(eq(paradigmClasses.id, classId))
	if (!cls) throw error(404, 'Class not found')

	const rules = await db
		.select()
		.from(paradigmRules)
		.where(eq(paradigmRules.classId, classId))
		.orderBy(asc(paradigmRules.cellKey))

	return { ...cls, rules }
}

export async function updateParadigmClass(classId: number, data: UpdateParadigmClassInput) {
	if (data.name || data.description !== undefined) {
		await db.update(paradigmClasses).set({
			...(data.name && { name: data.name.trim() }),
			...(data.description !== undefined && { description: data.description?.trim() || null }),
		}).where(eq(paradigmClasses.id, classId))
	}

	if (data.rules) {
		await db.delete(paradigmRules).where(eq(paradigmRules.classId, classId))
		const validRules = data.rules.filter(r => r.cellKey?.trim() && r.pattern?.trim())
		if (validRules.length > 0) {
			await db.insert(paradigmRules).values(
				validRules.map(r => ({
					classId,
					cellKey: r.cellKey.trim(),
					pattern: r.pattern.trim(),
				})),
			)
		}

		await rebuildClassForms(classId)
	}

	return { success: true }
}

export async function deleteParadigmClass(classId: number) {
	const [deleted] = await db.delete(paradigmClasses).where(eq(paradigmClasses.id, classId)).returning()
	if (!deleted) throw error(404, 'Class not found')
	return { success: true }
}

export async function createDimension(slug: string, data: CreateDimensionInput) {
	const lang = await assertLanguage(slug)

	const [dim] = await db
		.insert(inflectionDimensions)
		.values({
			languageId: lang.id,
			partOfSpeech: data.partOfSpeech.trim(),
			name: data.name.trim(),
			dimValues: data.values.map(v => v.trim()),
			sortOrder: data.sortOrder ?? 0,
		})
		.returning()
	return dim
}

export async function updateDimension(dimId: number, data: UpdateDimensionInput) {
	const [updated] = await db
		.update(inflectionDimensions)
		.set({
			...(data.name && { name: data.name.trim() }),
			...(data.values && { dimValues: data.values.map(v => v.trim()) }),
			...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
		})
		.where(eq(inflectionDimensions.id, dimId))
		.returning()

	if (!updated) throw error(404, 'Dimension not found')
	return updated
}

export async function deleteDimension(dimId: number) {
	const [dim] = await db.select().from(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))
	if (!dim) throw error(404, 'Dimension not found')

	await db.delete(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))

	const remainingDims = await db
		.select({ dimValues: inflectionDimensions.dimValues, sortOrder: inflectionDimensions.sortOrder })
		.from(inflectionDimensions)
		.where(and(
			eq(inflectionDimensions.languageId, dim.languageId),
			eq(inflectionDimensions.partOfSpeech, dim.partOfSpeech),
		))
		.orderBy(asc(inflectionDimensions.sortOrder))

	const classes = await db
		.select({ id: paradigmClasses.id })
		.from(paradigmClasses)
		.where(and(
			eq(paradigmClasses.languageId, dim.languageId),
			eq(paradigmClasses.partOfSpeech, dim.partOfSpeech),
		))

	if (classes.length > 0) {
		const validKeys = remainingDims.length > 0
			? generateCellKeys(remainingDims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))
			: []

		for (const cls of classes) {
			if (validKeys.length === 0) {
				await db.delete(paradigmRules).where(eq(paradigmRules.classId, cls.id))
			} else {
				await db.delete(paradigmRules).where(
					and(
						eq(paradigmRules.classId, cls.id),
						notInArray(paradigmRules.cellKey, validKeys),
					),
				)
			}
			await rebuildClassForms(cls.id)
		}
	}

	return { success: true }
}

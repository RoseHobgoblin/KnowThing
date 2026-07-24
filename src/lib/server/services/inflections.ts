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
	await db.transaction(async (tx) => {
		if (data.name || data.description !== undefined) {
			await tx.update(paradigmClasses).set({
				...(data.name && { name: data.name.trim() }),
				...(data.description !== undefined && { description: data.description?.trim() || null }),
			}).where(eq(paradigmClasses.id, classId))
		}

		if (data.rules) {
			await tx.delete(paradigmRules).where(eq(paradigmRules.classId, classId))
			const validRules = data.rules.filter(r => r.cellKey?.trim() && r.pattern?.trim())
			// Last-wins dedup on cellKey — the DB now enforces uniqueness
			// (uq_paradigm_rules_class_cell), so collapse duplicates up front
			// instead of failing the whole write.
			const byCell = new Map<string, string>()
			for (const rule of validRules) byCell.set(rule.cellKey.trim(), rule.pattern.trim())
			if (byCell.size > 0) {
				await tx.insert(paradigmRules).values(
					[...byCell.entries()].map(([cellKey, pattern]) => ({ classId, cellKey, pattern })),
				)
			}

			await rebuildClassForms(classId, tx)
		}
	})

	return { success: true }
}

export async function deleteParadigmClass(classId: number) {
	const [deleted] = await db.delete(paradigmClasses).where(eq(paradigmClasses.id, classId)).returning()
	if (!deleted) throw error(404, 'Class not found')
	return { success: true }
}

export async function createDimension(slug: string, data: CreateDimensionInput) {
	const lang = await assertLanguage(slug)

	return db.transaction(async (tx) => {
		const [dim] = await tx
			.insert(inflectionDimensions)
			.values({
				languageId: lang.id,
				partOfSpeech: data.partOfSpeech.trim(),
				name: data.name.trim(),
				dimValues: data.values.map(v => v.trim()),
				sortOrder: data.sortOrder ?? 0,
			})
			.returning()

		// Reject (with a clean 400, rolling back) if this dimension pushes the
		// paradigm past the cell cap — previously a plain Error → raw 500.
		const dims = await tx
			.select({ dimValues: inflectionDimensions.dimValues, sortOrder: inflectionDimensions.sortOrder })
			.from(inflectionDimensions)
			.where(and(
				eq(inflectionDimensions.languageId, lang.id),
				eq(inflectionDimensions.partOfSpeech, data.partOfSpeech.trim()),
			))
		safeCellKeys(dims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))

		return dim
	})
}

type DatabaseExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>

/** generateCellKeys throws a plain Error at the 1000-cell cap — surface it as a 400. */
function safeCellKeys(dims: Array<{ values: string[], sortOrder: number }>): string[] {
	try {
		return generateCellKeys(dims)
	} catch (error_) {
		throw error(400, error_ instanceof Error ? error_.message : 'Too many paradigm cells')
	}
}

/**
 * After a dimension's values/order change (or a dimension is deleted), rules
 * keyed by now-invalid cellKeys are dead weight and their forms are stale.
 * Prune them and rebuild every affected class, inside the caller's tx.
 */
async function pruneStaleRulesAndRebuild(
	tx: DatabaseExecutor,
	languageId: number,
	partOfSpeech: string,
) {
	const remainingDims = await tx
		.select({ dimValues: inflectionDimensions.dimValues, sortOrder: inflectionDimensions.sortOrder })
		.from(inflectionDimensions)
		.where(and(
			eq(inflectionDimensions.languageId, languageId),
			eq(inflectionDimensions.partOfSpeech, partOfSpeech),
		))
		.orderBy(asc(inflectionDimensions.sortOrder))

	const classes = await tx
		.select({ id: paradigmClasses.id })
		.from(paradigmClasses)
		.where(and(
			eq(paradigmClasses.languageId, languageId),
			eq(paradigmClasses.partOfSpeech, partOfSpeech),
		))

	if (classes.length === 0) return

	const validKeys = remainingDims.length > 0
		? safeCellKeys(remainingDims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))
		: []

	for (const cls of classes) {
		if (validKeys.length === 0) {
			await tx.delete(paradigmRules).where(eq(paradigmRules.classId, cls.id))
		} else {
			await tx.delete(paradigmRules).where(
				and(
					eq(paradigmRules.classId, cls.id),
					notInArray(paradigmRules.cellKey, validKeys),
				),
			)
		}
		await rebuildClassForms(cls.id, tx)
	}
}

export async function updateDimension(dimId: number, data: UpdateDimensionInput) {
	return db.transaction(async (tx) => {
		const [current] = await tx.select().from(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))
		if (!current) throw error(404, 'Dimension not found')

		const [updated] = await tx
			.update(inflectionDimensions)
			.set({
				...(data.name && { name: data.name.trim() }),
				...(data.values && { dimValues: data.values.map(v => v.trim()) }),
				...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
			})
			.where(eq(inflectionDimensions.id, dimId))
			.returning()

		// cellKeys derive from dimension values *and* their sort order, so a
		// change to either invalidates rules; prune + rebuild (previously this
		// silently orphaned rules and their materialized forms).
		const valuesChanged = data.values !== undefined
			&& JSON.stringify(data.values.map(v => v.trim())) !== JSON.stringify(current.dimValues)
		const orderChanged = data.sortOrder !== undefined && data.sortOrder !== current.sortOrder
		if (valuesChanged || orderChanged) {
			await pruneStaleRulesAndRebuild(tx, current.languageId, current.partOfSpeech)
		}

		return updated
	})
}

export async function deleteDimension(dimId: number) {
	await db.transaction(async (tx) => {
		const [dim] = await tx.select().from(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))
		if (!dim) throw error(404, 'Dimension not found')

		await tx.delete(inflectionDimensions).where(eq(inflectionDimensions.id, dimId))
		await pruneStaleRulesAndRebuild(tx, dim.languageId, dim.partOfSpeech)
	})

	return { success: true }
}

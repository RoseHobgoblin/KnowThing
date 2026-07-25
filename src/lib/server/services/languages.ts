import { error } from '@sveltejs/kit'
import { asc, eq, ne, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
import {
	archiveEntity,
	mintOrAttachFacetEntity,
	repointCanonicalRoute,
	type EntitySpineDatabase,
} from '$lib/server/services/entity-spine.js'
import { mintEntitySlug } from '$lib/utils/slugify.js'
import { isDescendant, queryLanguagesWithFamily } from '$lib/server/wordbook/language-tree.js'
import {
	type createLanguageSchema,
	LANGUAGE_TYPES,
	type updateLanguageSchema,
} from '$lib/server/http/languages/schemas.js'

type CreateLanguageInput = z.infer<typeof createLanguageSchema>
type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>

export async function listLanguages() {
	return queryLanguagesWithFamily()
}

export async function listLanguageOptions() {
	return db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.orderBy(asc(languages.name))
}

export async function getLanguageRowBySlug(slug: string) {
	const [lang] = await db.select().from(languages).where(eq(languages.slug, slug))
	return lang ?? null
}

export async function listLanguageOptionsExcluding(excludeId: number) {
	return db
		.select({ id: languages.id, name: languages.name, slug: languages.slug })
		.from(languages)
		.where(ne(languages.id, excludeId))
		.orderBy(asc(languages.name))
}

export async function getLanguageBySlug(slug: string) {
	const result = await queryLanguagesWithFamily(slug)
	if (result.length === 0) throw error(404, 'Language not found')
	return result[0]
}

async function hasLanguageFacet(tx: EntitySpineDatabase, entityId: number): Promise<boolean> {
	const [row] = await tx
		.select({ id: languages.id })
		.from(languages)
		.where(eq(languages.entityId, entityId))
		.limit(1)
	return !!row
}

export async function createLanguage(data: CreateLanguageInput) {
	const type = data.languageType && (LANGUAGE_TYPES as readonly string[]).includes(data.languageType)
		? data.languageType
		: 'language'

	return db.transaction(async (tx) => {
		const [lang] = await tx
			.insert(languages)
			.values({
				name: data.name.trim(),
				slug: data.slug.trim().toLowerCase(),
				nativeName: data.nativeName?.trim() || null,
				script: data.script?.trim() || 'Latin',
				family: data.family?.trim() || null,
				color: data.color?.trim() || '#d97706',
				description: data.description?.trim() || null,
				pageSlug: data.pageSlug?.trim() || null,
				parentLanguageId: data.parentLanguageId || null,
				languageType: type,
			})
			.returning()

		// Compatibility writer (0049): canonical know route in wiki style; the
		// legacy hyphen slug lives on as a noncanonical alias.
		const { entityId } = await mintOrAttachFacetEntity(tx, {
			displayName: lang.name,
			namespace: 'know',
			legacySlugs: [lang.slug],
			hasFacet: id => hasLanguageFacet(tx, id),
		})
		const [attached] = await tx
			.update(languages)
			.set({ entityId })
			.where(eq(languages.id, lang.id))
			.returning()
		return attached
	})
}

/**
 * Delete a language. Refuses while entries or descendant languages exist —
 * a language cascade-deletes its lexicon, so emptying it must be explicit.
 */
export async function deleteLanguage(slug: string) {
	return db.transaction(async (tx) => {
		const [lang] = await tx
			.select({ id: languages.id, entityId: languages.entityId })
			.from(languages)
			.where(eq(languages.slug, slug))
		if (!lang) throw error(404, 'Language not found')

		const [{ wordCount }] = await tx.execute(
			sql`SELECT COUNT(*)::int AS "wordCount" FROM lexicon WHERE language_id = ${lang.id}`,
		) as unknown as [{ wordCount: number }]
		if (Number(wordCount) > 0) {
			throw error(409, `This language still has ${wordCount} ${Number(wordCount) === 1 ? 'entry' : 'entries'}. Move or delete them first.`)
		}

		const [child] = await tx
			.select({ id: languages.id })
			.from(languages)
			.where(eq(languages.parentLanguageId, lang.id))
			.limit(1)
		if (child) {
			throw error(409, 'This language has descendant languages. Reparent or delete them first.')
		}

		await tx.delete(languages).where(eq(languages.id, lang.id))
		await archiveEntity(tx, lang.entityId)
		return { success: true }
	})
}

export async function updateLanguage(slug: string, data: UpdateLanguageInput) {
	const [current] = await db
		.select({ id: languages.id, name: languages.name, entityId: languages.entityId })
		.from(languages)
		.where(eq(languages.slug, slug))
	if (!current) throw error(404, 'Language not found')

	if (data.parentLanguageId !== undefined && data.parentLanguageId !== null && await isDescendant(current.id, data.parentLanguageId)) {
		throw error(400, 'Cannot set parent to self or a descendant (circular reference)')
	}

	const validType = data.languageType && (LANGUAGE_TYPES as readonly string[]).includes(data.languageType)

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(languages)
			.set({
				...(data.name && { name: data.name.trim() }),
				...(data.nativeName !== undefined && { nativeName: data.nativeName?.trim() || null }),
				...(data.script !== undefined && { script: data.script?.trim() || 'Latin' }),
				...(data.family !== undefined && { family: data.family?.trim() || null }),
				...(data.color !== undefined && { color: data.color?.trim() || '#d97706' }),
				...(data.description !== undefined && { description: data.description?.trim() || null }),
				...(data.pageSlug !== undefined && { pageSlug: data.pageSlug?.trim() || null }),
				...(data.parentLanguageId !== undefined && { parentLanguageId: data.parentLanguageId || null }),
				...(validType && { languageType: data.languageType! }),
				updatedAt: new Date(),
			})
			.where(eq(languages.slug, slug))
			.returning()

		if (!updated) throw error(404, 'Language not found')

		// Renaming a language touches ZERO lexeme rows: their scoped routes hang
		// off the language's entity id, so only the language's own canonical
		// route moves. The old name keeps 301ing via the demoted route.
		if (current.entityId != null && updated.name !== current.name) {
			await repointCanonicalRoute(tx, current.entityId, {
				namespace: 'know',
				slug: mintEntitySlug('know', updated.name),
				displayName: updated.name,
			})
		}
		return updated
	})
}

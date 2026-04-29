import { error } from '@sveltejs/kit'
import { asc, eq, ne } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { languages } from '$lib/server/db/schema.js'
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

export async function createLanguage(data: CreateLanguageInput) {
	const type = data.languageType && (LANGUAGE_TYPES as readonly string[]).includes(data.languageType)
		? data.languageType
		: 'language'

	const [lang] = await db
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
	return lang
}

export async function updateLanguage(slug: string, data: UpdateLanguageInput) {
	const [current] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!current) throw error(404, 'Language not found')

	if (data.parentLanguageId !== undefined && data.parentLanguageId !== null && await isDescendant(current.id, data.parentLanguageId)) {
		throw error(400, 'Cannot set parent to self or a descendant (circular reference)')
	}

	const validType = data.languageType && (LANGUAGE_TYPES as readonly string[]).includes(data.languageType)

	const [updated] = await db
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
	return updated
}

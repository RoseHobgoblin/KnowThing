import { error } from '@sveltejs/kit'
import { and, asc, eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '$lib/server/db/index.js'
import { languageDialects, languages } from '$lib/server/db/schema.js'
import type {
	createDialectSchema,
	updateDialectSchema,
} from '$lib/server/http/languages/schemas.js'

type CreateDialectInput = z.infer<typeof createDialectSchema>
type UpdateDialectInput = z.infer<typeof updateDialectSchema>

async function assertLanguage(slug: string) {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, slug))
	if (!lang) throw error(404, 'Language not found')
	return lang
}

export async function listDialects(slug: string) {
	const lang = await assertLanguage(slug)
	return listDialectsByLanguageId(lang.id)
}

export async function listDialectsByLanguageId(languageId: number) {
	return db
		.select()
		.from(languageDialects)
		.where(eq(languageDialects.languageId, languageId))
		.orderBy(asc(languageDialects.name))
}

export async function createDialect(slug: string, data: CreateDialectInput) {
	const lang = await assertLanguage(slug)

	const [dialect] = await db
		.insert(languageDialects)
		.values({
			languageId: lang.id,
			name: data.name.trim(),
			slug: data.slug.trim().toLowerCase(),
			region: data.region?.trim() || null,
			description: data.description?.trim() || null,
		})
		.returning()
	return dialect
}

export async function updateDialect(slug: string, dialectSlug: string, data: UpdateDialectInput) {
	const lang = await assertLanguage(slug)

	const [updated] = await db
		.update(languageDialects)
		.set({
			...(data.name && { name: data.name.trim() }),
			...(data.region !== undefined && { region: data.region?.trim() || null }),
			...(data.description !== undefined && { description: data.description?.trim() || null }),
		})
		.where(and(eq(languageDialects.languageId, lang.id), eq(languageDialects.slug, dialectSlug)))
		.returning()

	if (!updated) throw error(404, 'Dialect not found')
	return updated
}

export async function deleteDialect(slug: string, dialectSlug: string) {
	const lang = await assertLanguage(slug)

	const [deleted] = await db
		.delete(languageDialects)
		.where(and(eq(languageDialects.languageId, lang.id), eq(languageDialects.slug, dialectSlug)))
		.returning()

	if (!deleted) throw error(404, 'Dialect not found')
	return { success: true }
}

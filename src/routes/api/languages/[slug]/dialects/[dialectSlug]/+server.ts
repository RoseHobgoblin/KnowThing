import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, languageDialects } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq, and } from 'drizzle-orm'

/** PUT /api/languages/:slug/dialects/:dialectSlug */
export const PUT: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const body = await event.request.json()
	const { name, region, description } = body as { name?: string, region?: string, description?: string }

	const [updated] = await db
		.update(languageDialects)
		.set({
			...(name && { name: name.trim() }),
			...(region !== undefined && { region: region?.trim() || null }),
			...(description !== undefined && { description: description?.trim() || null }),
		})
		.where(and(eq(languageDialects.languageId, lang.id), eq(languageDialects.slug, event.params.dialectSlug)))
		.returning()

	if (!updated) return json({ error: 'Dialect not found' }, { status: 404 })
	return json(updated)
}

/** DELETE /api/languages/:slug/dialects/:dialectSlug */
export const DELETE: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const [deleted] = await db
		.delete(languageDialects)
		.where(and(eq(languageDialects.languageId, lang.id), eq(languageDialects.slug, event.params.dialectSlug)))
		.returning()

	if (!deleted) return json({ error: 'Dialect not found' }, { status: 404 })
	return json({ success: true })
}

import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, languageDialects } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq, asc } from 'drizzle-orm'

/** GET /api/languages/:slug/dialects */
export const GET: RequestHandler = async ({ params }) => {
	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const dialects = await db
		.select()
		.from(languageDialects)
		.where(eq(languageDialects.languageId, lang.id))
		.orderBy(asc(languageDialects.name))

	return json(dialects)
}

/** POST /api/languages/:slug/dialects */
export const POST: RequestHandler = async (event) => {
	requireAuth(event)

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const body = await event.request.json()
	const { name, slug, region, description } = body as {
		name: string
		slug: string
		region?: string
		description?: string
	}

	if (!name?.trim() || !slug?.trim()) {
		return json({ error: 'Name and slug are required' }, { status: 400 })
	}

	const [dialect] = await db
		.insert(languageDialects)
		.values({
			languageId: lang.id,
			name: name.trim(),
			slug: slug.trim().toLowerCase(),
			region: region?.trim() || null,
			description: description?.trim() || null,
		})
		.returning()

	return json(dialect, { status: 201 })
}

import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, paradigmClasses } from '$lib/server/db/schema.js'
import { requireRole } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** POST /api/languages/:slug/inflections/classes — create a paradigm class */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin')

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const body = await event.request.json()
	const { partOfSpeech, name, description } = body as {
		partOfSpeech: string
		name: string
		description?: string
	}

	if (!partOfSpeech?.trim() || !name?.trim()) {
		return json({ error: 'partOfSpeech and name are required' }, { status: 400 })
	}

	const [cls] = await db
		.insert(paradigmClasses)
		.values({
			languageId: lang.id,
			partOfSpeech: partOfSpeech.trim(),
			name: name.trim(),
			description: description?.trim() || null,
		})
		.returning()

	return json(cls, { status: 201 })
}

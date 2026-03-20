import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, inflectionDimensions } from '$lib/server/db/schema.js'
import { requireAuth } from '$lib/server/auth.js'
import { eq } from 'drizzle-orm'

/** POST /api/languages/:slug/inflections/dimensions — add a dimension */
export const POST: RequestHandler = async (event) => {
	requireAuth(event)

	const [lang] = await db.select({ id: languages.id }).from(languages).where(eq(languages.slug, event.params.slug))
	if (!lang) return json({ error: 'Language not found' }, { status: 404 })

	const body = await event.request.json()
	const { partOfSpeech, name, values, sortOrder } = body as {
		partOfSpeech: string
		name: string
		values: string[]
		sortOrder?: number
	}

	if (!partOfSpeech?.trim() || !name?.trim() || !values?.length) {
		return json({ error: 'partOfSpeech, name, and values are required' }, { status: 400 })
	}

	const [dim] = await db
		.insert(inflectionDimensions)
		.values({
			languageId: lang.id,
			partOfSpeech: partOfSpeech.trim(),
			name: name.trim(),
			dimValues: values.map(v => v.trim()),
			sortOrder: sortOrder ?? 0,
		})
		.returning()

	return json(dim, { status: 201 })
}

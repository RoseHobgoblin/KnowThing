import type { PageServerLoad } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { languages, phonemes } from '$lib/server/db/schema.js'
import { eq, asc } from 'drizzle-orm'
import { error, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const [lang] = await db
		.select()
		.from(languages)
		.where(eq(languages.slug, params.language))
	if (!lang) throw error(404, 'Language not found')

	const inventory = await db
		.select()
		.from(phonemes)
		.where(eq(phonemes.languageId, lang.id))
		.orderBy(asc(phonemes.type), asc(phonemes.sortOrder), asc(phonemes.id))

	return {
		language: {
			id: lang.id,
			name: lang.name,
			slug: lang.slug,
			nativeName: lang.nativeName,
		},
		inventory,
	}
}

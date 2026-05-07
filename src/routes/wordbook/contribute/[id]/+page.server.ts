import type { PageServerLoad } from './$types.js'
import { redirect, error } from '@sveltejs/kit'
import { getEntryWithDefinitions } from '$lib/server/services/wordbook.js'
import { listLanguageOptions } from '$lib/server/services/languages.js'
import { listClassesForLanguage } from '$lib/server/services/inflections.js'
import { getInflectionTable } from '$lib/server/wordbook/inflection.js'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const id = Number.parseInt(params.id)
	if (isNaN(id)) throw error(400, 'Invalid ID')

	const { entry, definitions: defs } = await getEntryWithDefinitions(id)
	const langs = await listLanguageOptions()

	const [availableClasses, inflection] = await Promise.all([
		listClassesForLanguage(entry.languageId),
		getInflectionTable(id),
	])

	return {
		entry,
		definitions: defs,
		languages: langs,
		availableClasses,
		inflection,
	}
}

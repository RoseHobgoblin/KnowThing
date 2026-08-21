import type { PageServerLoad } from './$types.js'
import { redirect, error } from '@sveltejs/kit'
import { hasRole } from '$lib/server/auth.js'
import { getEntryWithDefinitions } from '$lib/feature/wordbook/public/server/entries.server.js'
import { listLanguageOptions } from '$lib/feature/wordbook/public/server/languages.server.js'
import { listClassesForLanguage } from '$lib/feature/wordbook/public/server/inflections.server.js'
import { getInflectionTable } from '$lib/feature/wordbook/public/server/inflection.server.js'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login')
	if (!hasRole(locals.user.role, 'editor')) throw error(403, 'Editor role required to contribute to the wordbook')

	const id = Number.parseInt(params.id)
	if (Number.isNaN(id)) throw error(400, 'Invalid ID')

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

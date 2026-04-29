import type { PageServerLoad } from './$types.js'
import { redirect } from '@sveltejs/kit'
import { listLanguageOptions } from '$lib/server/services/languages.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login')
	return { existingLanguages: await listLanguageOptions() }
}

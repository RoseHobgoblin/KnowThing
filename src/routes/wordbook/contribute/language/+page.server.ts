import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { hasRole } from '$lib/server/auth.js'
import { listLanguageOptions } from '$lib/server/services/languages.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login')
	// Language creation is an admin API (POST /api/languages) — gate the page to match.
	if (!hasRole(locals.user.role, 'admin')) throw error(403, 'Admin role required to create languages')
	return { existingLanguages: await listLanguageOptions() }
}

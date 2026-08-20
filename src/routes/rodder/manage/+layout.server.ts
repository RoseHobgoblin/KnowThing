import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types.js'
import { hasRole } from '$lib/server/auth.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !hasRole(locals.user.role, 'editor')) throw redirect(302, '/rodder')
	return { canDeleteRodder: hasRole(locals.user.role, 'admin') }
}

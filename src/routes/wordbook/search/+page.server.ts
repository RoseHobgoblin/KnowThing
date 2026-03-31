import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'

export const load: PageServerLoad = async ({ url }) => {
	const params = new URLSearchParams(url.searchParams)
	params.set('scope', 'wordbook')
	throw redirect(307, `/search?${params.toString()}`)
}

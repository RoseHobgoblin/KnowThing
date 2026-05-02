import type { PageServerLoad } from './$types.js'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
	throw redirect(308, `/media/${params.filename}`)
}

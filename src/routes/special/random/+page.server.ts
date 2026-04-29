import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types.js'
import { pickRandomPage } from '$lib/server/services/dashboard.js'

export const load: PageServerLoad = async () => {
	const randomPage = await pickRandomPage()

	if (randomPage) {
		const path = randomPage.parentPath
			? `/${randomPage.domain}/${randomPage.parentPath}/${randomPage.slug}`
			: `/${randomPage.domain}/${randomPage.slug}`
		throw redirect(302, path)
	}

	throw redirect(302, '/')
}

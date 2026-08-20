import type { PageServerLoad } from './$types.js'
import { error, redirect } from '@sveltejs/kit'
import { resolveRodderSectorDocument } from '$lib/feature/rodder/server/documents.server.js'

/** Read-only sector view: one sector's frame contract and its roots. */
export const load: PageServerLoad = async ({ params }) => {
	const document = await resolveRodderSectorDocument(params.slug)
	if (!document) throw error(404, 'Sector not found')
	if (document.identity.slug !== params.slug) throw redirect(301, `/rodder/sector/${document.identity.slug}`)
	return { document }
}

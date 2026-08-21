import type { PageServerLoad } from './$types.js'
import { getMediaDetail } from '$lib/feature/media/public/server/media.server.js'
import { describeRodderMediaOwners } from '$lib/feature/rodder/public/server/media-owners.server.js'

export const load: PageServerLoad = async ({ params }) => {
	const filename = decodeURIComponent(params.filename)
	const detail = await getMediaDetail(filename)
	const rodderOwners = await describeRodderMediaOwners(
		detail.assetUsage.filter(binding => binding.ownerType === 'rodder').map(binding => binding.ownerId),
	)
	const ownersById = new Map(rodderOwners.map(owner => [owner.ownerId, owner]))
	return {
		...detail,
		assetUsage: detail.assetUsage.map(binding => ({ ...binding, ...ownersById.get(binding.ownerId) })),
	}
}

import type { PageServerLoad } from './$types.js'
import { requireAdmin } from '$lib/server/guards.js'
import { listRecentRegistrationCodes, listUsers } from '$lib/server/services/users.js'

function maskRegistrationCode(code: string): string {
	if (code.length <= 4) return '•'.repeat(code.length)
	if (code.length <= 8) return `${code.slice(0, 2)}••••${code.slice(-2)}`
	return `${code.slice(0, 4)}••••${code.slice(-4)}`
}

export const load: PageServerLoad = async (event) => {
	const currentUser = requireAdmin(event)

	const allUsers = await listUsers()
	const codes = await listRecentRegistrationCodes()

	return {
		users: allUsers,
		codes: codes.map(code => ({
			...code,
			code: maskRegistrationCode(code.code),
			isMasked: true,
			isOwnerOnlyRole: code.role === 'admin' && currentUser.role !== 'owner',
		})),
	}
}

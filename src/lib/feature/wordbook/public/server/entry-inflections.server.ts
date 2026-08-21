import * as operations from '../../server/wordbook-operations.server.js'

export async function updateEntryInflection(
	entryId: number,
	updates: { classId?: number | null, stem?: string | null, overrides?: Record<string, string> },
	userId: number,
) {
	return operations.updateEntryInflection(entryId, updates, userId)
}

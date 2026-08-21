import * as operations from '../../server/wordbook-operations.server.js'

export async function addEntryRelation(
	entryId: number,
	relation: { targetId: number, relationType: string, notes?: string },
	userId: number,
) {
	return operations.addEntryRelation(entryId, relation, userId)
}

export async function deleteEntryRelation(entryId: number, relationId: number, userId: number) {
	return operations.deleteEntryRelation(entryId, relationId, userId)
}

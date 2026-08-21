import * as operations from '../../server/wordbook-operations.server.js'

export async function listEntryRevisions(entryId: number) {
	return operations.listEntryRevisions(entryId)
}

export async function getEntryRevision(entryId: number, revisionId: number) {
	return operations.getEntryRevision(entryId, revisionId)
}

export async function restoreEntryRevision(entryId: number, revisionId: number, userId: number) {
	return operations.restoreEntryRevision(entryId, revisionId, userId)
}

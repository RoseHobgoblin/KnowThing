import * as operations from '../../server/wordbook-operations.server.js'

export async function listVariantsForEntries(entryIds: number[]) {
	return operations.listVariantsForEntries(entryIds)
}

export async function listEntryVariants(entryId: number) {
	return operations.listEntryVariants(entryId)
}

export async function addEntryVariant(
	entryId: number,
	variant: { dialectId: number, pronunciation?: string, spelling?: string, notes?: string },
	userId: number,
) {
	return operations.addEntryVariant(entryId, variant, userId)
}

export async function deleteEntryVariant(entryId: number, variantId: number, userId: number) {
	return operations.deleteEntryVariant(entryId, variantId, userId)
}

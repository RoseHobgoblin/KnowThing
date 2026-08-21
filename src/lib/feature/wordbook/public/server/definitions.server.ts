import * as operations from '../../server/wordbook-operations.server.js'
import type { WordbookDefinitionInput } from '../../server/wordbook-operations.server.js'

export async function replaceEntryDefinitions(entryId: number, definitions: WordbookDefinitionInput[], userId: number) {
	return operations.replaceEntryDefinitions(entryId, definitions, userId)
}

export async function addEntryDefinition(entryId: number, definition: WordbookDefinitionInput, userId: number) {
	return operations.addEntryDefinition(entryId, definition, userId)
}

export async function updateEntryDefinition(
	entryId: number,
	definitionId: number,
	updates: Partial<WordbookDefinitionInput>,
	userId: number,
) {
	return operations.updateEntryDefinition(entryId, definitionId, updates, userId)
}

export async function deleteEntryDefinition(entryId: number, definitionId: number, userId: number) {
	return operations.deleteEntryDefinition(entryId, definitionId, userId)
}

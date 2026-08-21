import * as operations from '../../server/wordbook-operations.server.js'
import type { CreateWordbookEntryInput } from '../../server/wordbook-operations.server.js'

export async function getWordbookEntry(entryId: number) {
	return operations.getWordbookEntry(entryId)
}

export async function deleteWordbookEntry(entryId: number, userId: number) {
	return operations.deleteWordbookEntry(entryId, userId)
}

export async function listWordbookTags() {
	return operations.listWordbookTags()
}

export async function getEntryLanguageId(entryId: number) {
	return operations.getEntryLanguageId(entryId)
}

export async function listRecentEntries(limit: number) {
	return operations.listRecentEntries(limit)
}

export async function getTotalWordCount() {
	return operations.getTotalWordCount()
}

export async function getEntryWithDefinitions(entryId: number) {
	return operations.getEntryWithDefinitions(entryId)
}

export async function listHomographs(languageId: number, word: string) {
	return operations.listHomographs(languageId, word)
}

export async function listDefinitionsForEntries(entryIds: number[]) {
	return operations.listDefinitionsForEntries(entryIds)
}

export async function findWordbookMatchByTitle(title: string) {
	return operations.findWordbookMatchByTitle(title)
}

export async function createWordbookEntry(input: CreateWordbookEntryInput) {
	return operations.createWordbookEntry(input)
}

export async function updateWordbookEntry(
	entryId: number,
	updates: Parameters<typeof operations.updateWordbookEntry>[1],
	userId: number,
) {
	return operations.updateWordbookEntry(entryId, updates, userId)
}

import * as operations from '../../server/wordbook-operations.server.js'

export async function listLanguagesWithFamily() {
	return operations.listLanguagesWithFamily()
}

export async function getLanguageWithFamily(slug: string) {
	return operations.getLanguageWithFamily(slug)
}

export async function listLanguageEntries(
	languageId: number,
	letter: string | null,
	pagination?: { limit: number, offset: number },
) {
	return pagination
		? operations.listLanguageEntries(languageId, letter, pagination)
		: operations.listLanguageEntries(languageId, letter)
}

export async function listActiveLetters(languageId: number) {
	return operations.listActiveLetters(languageId)
}

export async function getLanguageBySlug(slug: string) {
	return operations.getLanguageBySlug(slug)
}

export async function findLanguageMatchByPageSlug(slug: string) {
	return operations.findLanguageMatchByPageSlug(slug)
}

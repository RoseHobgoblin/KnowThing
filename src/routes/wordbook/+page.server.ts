import type { PageServerLoad } from './$types.js'
import { getTotalWordCount, listRecentEntries } from '$lib/feature/wordbook/public/server/entries.server.js'
import { listLanguagesWithFamily } from '$lib/feature/wordbook/public/server/language-entries.server.js'

export const load: PageServerLoad = async () => {
	const [langs, recent, totalWords] = await Promise.all([
		listLanguagesWithFamily(),
		listRecentEntries(10),
		getTotalWordCount(),
	])
	return { languages: langs, recent, totalWords }
}

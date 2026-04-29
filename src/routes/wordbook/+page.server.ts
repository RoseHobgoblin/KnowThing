import type { PageServerLoad } from './$types.js'
import {
	getTotalWordCount,
	listLanguagesWithFamily,
	listRecentEntries,
} from '$lib/server/services/wordbook.js'

export const load: PageServerLoad = async () => {
	const [langs, recent, totalWords] = await Promise.all([
		listLanguagesWithFamily(),
		listRecentEntries(10),
		getTotalWordCount(),
	])
	return { languages: langs, recent, totalWords }
}

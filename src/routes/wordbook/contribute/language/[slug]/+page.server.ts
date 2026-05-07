import type { PageServerLoad } from './$types.js'
import { redirect, error } from '@sveltejs/kit'
import {
	getLanguageRowBySlug,
	listLanguageOptionsExcluding,
} from '$lib/server/services/languages.js'
import { listPhonemesByLanguageId, listPhonemeSummaryForLanguage } from '$lib/server/services/phonemes.js'
import { listGraphemesByLanguageId } from '$lib/server/services/graphemes.js'
import { countRulesByClass, getInflectionsByLanguageId } from '$lib/server/services/inflections.js'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/auth/login')

	const lang = await getLanguageRowBySlug(params.slug)
	if (!lang) throw error(404, 'Language not found')

	const [otherLanguages, phonemes, graphemes, phonemeSummary, inflections, paradigmRuleCounts] = await Promise.all([
		listLanguageOptionsExcluding(lang.id),
		listPhonemesByLanguageId(lang.id, null),
		listGraphemesByLanguageId(lang.id),
		listPhonemeSummaryForLanguage(lang.id),
		getInflectionsByLanguageId(lang.id),
		countRulesByClass(lang.id),
	])

	return {
		language: lang,
		otherLanguages,
		phonemes,
		graphemes,
		phonemeSummary,
		inflectionDimensions: inflections.dimensions,
		paradigmClasses: inflections.classes,
		paradigmRuleCounts,
	}
}

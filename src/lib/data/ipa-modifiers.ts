// IPA modifiers applied on top of a base symbol in the phoneme picker.
//
// Each entry adds a combining or spacing modifier character to the base IPA
// string. Modifiers stack in the order they appear here (so the live preview
// is deterministic). Groups with `mutex: true` allow only one pick across the
// group at a time — used for "length vs half-long" or "more- vs less-rounded"
// where stacking would be linguistically meaningless.

export type ModifierApplies = 'consonant' | 'vowel' | 'both'

export interface IpaModifier {
	id: string
	label: string
	/** The combining or spacing character appended to the base symbol. */
	suffix: string
	/** Short hover description — what feature this marks. */
	description: string
	appliesTo: ModifierApplies
	/** Modifiers with the same `mutex` key exclude each other (only one on at a time). */
	mutex?: string
}

export const IPA_MODIFIERS: IpaModifier[] = [
	// ─── length ──────────────────────────────────────────────────────────
	{ id: 'long', label: 'long', suffix: 'ː', description: 'Long / geminate', appliesTo: 'both', mutex: 'length' },
	{ id: 'half-long', label: 'half-long', suffix: 'ˑ', description: 'Half-long', appliesTo: 'both', mutex: 'length' },

	// ─── consonant secondary articulations ───────────────────────────────
	{ id: 'aspirated', label: 'aspirated', suffix: 'ʰ', description: 'Aspirated release', appliesTo: 'consonant' },
	{ id: 'ejective', label: 'ejective', suffix: 'ʼ', description: 'Ejective', appliesTo: 'consonant' },
	{ id: 'palatalized', label: 'palatalized', suffix: 'ʲ', description: 'Palatalized (secondary articulation)', appliesTo: 'consonant' },
	{ id: 'labialized', label: 'labialized', suffix: 'ʷ', description: 'Labialized (secondary articulation)', appliesTo: 'consonant' },
	{ id: 'velarized', label: 'velarized', suffix: 'ˠ', description: 'Velarized (secondary articulation)', appliesTo: 'consonant' },
	{ id: 'pharyngealized', label: 'pharyngealized', suffix: 'ˤ', description: 'Pharyngealized (secondary articulation)', appliesTo: 'consonant' },

	// ─── consonant diacritics below ──────────────────────────────────────
	{ id: 'voiceless', label: 'voiceless', suffix: '̥', description: 'Voiceless diacritic (for sonorants)', appliesTo: 'consonant', mutex: 'voicing-diacritic' },
	{ id: 'voiced', label: 'voiced', suffix: '̬', description: 'Voiced diacritic', appliesTo: 'consonant', mutex: 'voicing-diacritic' },
	{ id: 'syllabic', label: 'syllabic', suffix: '̩', description: 'Syllabic consonant (acts as nucleus)', appliesTo: 'consonant' },
	{ id: 'dental', label: 'dental', suffix: '̪', description: 'Dental articulation', appliesTo: 'consonant' },

	// ─── vowel diacritics ────────────────────────────────────────────────
	{ id: 'nasalized', label: 'nasalized', suffix: '̃', description: 'Nasalized vowel', appliesTo: 'vowel' },
	{ id: 'creaky', label: 'creaky', suffix: '̰', description: 'Creaky voice', appliesTo: 'vowel', mutex: 'phonation' },
	{ id: 'breathy', label: 'breathy', suffix: '̤', description: 'Breathy voice', appliesTo: 'vowel', mutex: 'phonation' },
	{ id: 'rhotic', label: 'rhotic', suffix: '˞', description: 'R-colored (rhoticized) vowel', appliesTo: 'vowel' },
	{ id: 'advanced', label: 'advanced', suffix: '̟', description: 'Advanced (moved toward front)', appliesTo: 'vowel', mutex: 'frontback-shift' },
	{ id: 'retracted', label: 'retracted', suffix: '̠', description: 'Retracted (moved toward back)', appliesTo: 'vowel', mutex: 'frontback-shift' },
	{ id: 'raised', label: 'raised', suffix: '̝', description: 'Raised (higher than cardinal)', appliesTo: 'vowel', mutex: 'height-shift' },
	{ id: 'lowered', label: 'lowered', suffix: '̞', description: 'Lowered (lower than cardinal)', appliesTo: 'vowel', mutex: 'height-shift' },
	{ id: 'more-rounded', label: 'more rounded', suffix: '̹', description: 'More rounded than cardinal', appliesTo: 'vowel', mutex: 'rounding-shift' },
	{ id: 'less-rounded', label: 'less rounded', suffix: '̜', description: 'Less rounded than cardinal', appliesTo: 'vowel', mutex: 'rounding-shift' },
]

/**
 * Compose a base symbol with a set of modifier IDs. Modifiers apply in the
 * canonical order they appear in `IPA_MODIFIERS`, so toggling them on and off
 * yields a deterministic result.
 */
export function applyModifiers(base: string, modifierIds: Set<string>): string {
	let result = base
	for (const modifier of IPA_MODIFIERS) {
		if (modifierIds.has(modifier.id)) result += modifier.suffix
	}
	// NFC canonicalizes combining-diacritic output — e.g. `a` + U+0303 → `ã`
	// as a single codepoint — so downstream comparisons and rendering are
	// deterministic regardless of how the caller composed things.
	return result.normalize('NFC')
}

/** Modifiers available for a given phoneme type. */
export function modifiersFor(type: 'consonant' | 'vowel' | 'diphthong' | 'special'): IpaModifier[] {
	const kind: ModifierApplies | null = type === 'consonant'
		? 'consonant'
		: (type === 'vowel' || type === 'diphthong'
			? 'vowel'
			: null)
	if (!kind) return IPA_MODIFIERS.filter(m => m.appliesTo === 'both')
	return IPA_MODIFIERS.filter(m => m.appliesTo === kind || m.appliesTo === 'both')
}

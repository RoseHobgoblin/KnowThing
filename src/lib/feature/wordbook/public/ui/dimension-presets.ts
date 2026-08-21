export interface DimensionPreset {
	label: string
	pos: string
	name: string
	values: string[]
	sortOrder: number
}

export interface ClassPreset {
	label: string
	pos: string
	name: string
	description: string
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
	{ label: 'Number for nouns', pos: 'noun', name: 'Number', values: ['singular', 'plural'], sortOrder: 1 },
	{ label: 'Case for nouns', pos: 'noun', name: 'Case', values: ['nominative', 'accusative', 'genitive', 'dative'], sortOrder: 0 },
	{ label: 'Tense for verbs', pos: 'verb', name: 'Tense', values: ['present', 'past', 'future'], sortOrder: 0 },
	{ label: 'Person for verbs', pos: 'verb', name: 'Person', values: ['1st', '2nd', '3rd'], sortOrder: 1 },
	{ label: 'Gender for adjectives', pos: 'adjective', name: 'Gender', values: ['masculine', 'feminine', 'neuter'], sortOrder: 0 },
]

export const CLASS_PRESETS: ClassPreset[] = [
	{ label: 'Regular noun', pos: 'noun', name: 'Regular', description: 'Default noun pattern' },
	{ label: 'Strong noun', pos: 'noun', name: 'Strong', description: 'Vowel-changing noun stems' },
	{ label: 'Weak verb', pos: 'verb', name: 'Weak', description: 'Regular conjugation' },
	{ label: 'Strong verb', pos: 'verb', name: 'Strong', description: 'Stem-changing conjugation' },
]

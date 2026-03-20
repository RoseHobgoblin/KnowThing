import type { FieldMap, InfoboxType } from './types.js'
import { hasField } from './types.js'

// ============================================================================
// Two-tier infobox type detection
// ============================================================================

/** Explicit keyword -> type mapping */
const KEYWORD_MAP: Record<string, InfoboxType> = {
	// Country
	'country': 'country',
	'nation': 'country',
	'state': 'country',

	// Former country
	'former country': 'former_country',
	'former nation': 'former_country',
	'former state': 'former_country',

	// Language
	'language': 'language',
	'langue': 'language',
	'tongue': 'language',

	// Settlement
	'settlement': 'settlement',
	'city': 'settlement',
	'town': 'settlement',
	'village': 'settlement',
	'municipality': 'settlement',
	'district': 'settlement',
	'commune': 'settlement',
	'place': 'settlement',
	'borough': 'settlement',
	'township': 'settlement',
	'prefecture': 'settlement',
	'county': 'settlement',
	'parish': 'settlement',
	'region': 'settlement',

	// Royalty
	'royalty': 'royalty',
	'monarch': 'royalty',
	'king': 'royalty',
	'queen': 'royalty',
	'emperor': 'royalty',
	'prince': 'royalty',
	'princess': 'royalty',
	'duke': 'royalty',
	'duchess': 'royalty',
	'noble': 'royalty',
	'nobility': 'royalty',
	'consort': 'royalty',

	// Officeholder
	'officeholder': 'officeholder',
	'politician': 'officeholder',
	'governor': 'officeholder',
	'senator': 'officeholder',
	'representative': 'officeholder',
	'minister': 'officeholder',
	'mayor': 'officeholder',
	'ambassador': 'officeholder',
	'judge': 'officeholder',
	'justice': 'officeholder',

	// Person
	'person': 'person',
	'scientist': 'person',
	'writer': 'person',
	'artist': 'person',
	'athlete': 'person',
	'military person': 'person',
	'criminal': 'person',
	'clergy': 'person',
	'philosopher': 'person',
	'academic': 'person',

	// Religion
	'religion': 'religion',
	'faith': 'religion',
	'denomination': 'religion',
	'church': 'religion',
	'sect': 'religion',
}

/**
 * Detect the infobox type from the template name and fields.
 *
 * 1. Extract the subtype suffix after "infobox" (e.g. "Infobox country" -> "country")
 * 2. Match against explicit keywords
 * 3. If no match, inspect fields for heuristic detection
 * 4. Fallback to 'generic'
 */
export function detectInfoboxType(templateName: string, fields: FieldMap): InfoboxType {
	// Extract suffix: "Infobox country" -> "country", "Infobox Former Country" -> "former country"
	const match = templateName.match(/^infobox\s+(.+)$/i)
	const subtype = match?.[1]?.trim().toLowerCase() ?? ''

	// Stage 1: Explicit keyword match
	if (subtype && KEYWORD_MAP[subtype]) {
		return KEYWORD_MAP[subtype]
	}

	// Stage 2: Field-based heuristic detection
	if (hasField(fields, 'capital', 'government', 'government_type', 'official_languages', 'internet_tld')) {
		return 'country'
	}
	if (hasField(fields, 'succession', 'reign', 'coronation', 'royal_house', 'dynasty', 'regent')) {
		return 'royalty'
	}
	if (hasField(fields, 'office', 'term_start', 'term_end', 'constituency', 'parliamentarygroup', 'party')) {
		return 'officeholder'
	}
	if (hasField(fields, 'fam1', 'iso3', 'speakers', 'script', 'familycolor')) {
		return 'language'
	}
	if (hasField(fields, 'settlement_type', 'subdivision_type', 'population_total', 'elevation_m', 'postal_code', 'area_code')) {
		return 'settlement'
	}
	if (hasField(fields, 'birth_date', 'death_date', 'occupation', 'born', 'nationality')) {
		return 'person'
	}
	if (hasField(fields, 'theology', 'scripture', 'deity', 'founder', 'origin', 'followers')) {
		return 'religion'
	}

	return 'generic'
}

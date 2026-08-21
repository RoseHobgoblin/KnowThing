// Explicit Drizzle tooling manifest. Application persistence imports its owning
// schema module directly; this file exists only for Drizzle initialization and CLI discovery.
export {
	accounts, authRateLimits, categories, contentCategories, contentLinks,
	contentMediaUsage, contentRecords, contentRevisions, entityCategories,
	entityRevisions, rateLimits, registrationCodes, sessions, siteSettings,
	templates, users, verifications,
} from './core-schema.js'

export { calendars } from '$lib/feature/calendar/server/schema.server.js'
export { media, mediaAssetBindings, mediaCategories, mediaHistory, mediaVersions } from '$lib/feature/media/server/schema.server.js'
export { rodderBodies, rodderSectorRoots, rodderSectors } from '$lib/feature/rodder/server/schema.server.js'
export {
	definitions, graphemePhonemes, graphemes, inflectedForms, inflectionDimensions,
	languageDialects, languages, lexicon, lexiconInflections, lexiconRelations,
	lexiconRevisions, lexiconVariants, paradigmClasses, paradigmRules, phonemes,
} from '$lib/feature/wordbook/server/schema.server.js'
export { countries, worldMapRegionGeometry, worldMapRegions, worldMaps } from '$lib/feature/worldmap/server/schema.server.js'

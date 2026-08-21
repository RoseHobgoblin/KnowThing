import type { MapBody } from '../root-layout.js'
import type { ApparentSkyResult } from '../apparent-sky.js'
import { rodderDocumentInfoboxFields } from '../projections.js'
import type { RodderCalendarPort } from '../calendar-port.js'
import { resolveRodderEntityDocument } from './documents.server.js'
import type { StructuredDataProvider } from '$lib/structured-data/providers.js'

export interface RootMapData {
	rootName: string
	stars: MapBody[]
	bodies: MapBody[]
	apparentSky: ApparentSkyResult
}

const RODDER_STRUCTURED_KINDS = [
	'star',
	'planet',
	'rodder',
	'rodder body',
	'system',
	'star system',
	'planetary system',
] as const

export function createRodderStructuredDataProviders(calendarPort?: RodderCalendarPort): StructuredDataProvider[] {
	return RODDER_STRUCTURED_KINDS.map(kind => ({
		kind,
		async resolve(identifier: string) {
			const document = await resolveRodderEntityDocument(identifier, calendarPort)
			return document ? rodderDocumentInfoboxFields(document) : null
		},
	}))
}

export async function resolveRodderRootMapData(
	slug: string,
	calendarPort?: RodderCalendarPort,
): Promise<RootMapData | null> {
	const document = await resolveRodderEntityDocument(slug, calendarPort)
	const display = document?.displays.rootMap
	if (!display) return null
	return {
		rootName: display.rootName,
		stars: display.stars as unknown as MapBody[],
		bodies: display.bodies as unknown as MapBody[],
		apparentSky: display.apparentSky,
	}
}

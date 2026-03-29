import type { InfoboxType } from './types.js'
import type { Component } from 'svelte'

// Lazy imports — each component is only loaded when its type is detected
const INFOBOX_COMPONENTS: Record<InfoboxType, () => Promise<{ default: Component<{ fields: import('./types.js').FieldMap }> }>> = {
	country: () => import('./InfoboxCountry.svelte'),
	former_country: () => import('./InfoboxFormerCountry.svelte'),
	language: () => import('./InfoboxLanguage.svelte'),
	settlement: () => import('./InfoboxSettlement.svelte'),
	royalty: () => import('./InfoboxRoyalty.svelte'),
	officeholder: () => import('./InfoboxOfficeholder.svelte'),
	person: () => import('./InfoboxPerson.svelte'),
	religion: () => import('./InfoboxReligion.svelte'),
	star: () => import('./InfoboxStar.svelte'),
	planet: () => import('./InfoboxPlanet.svelte'),
	system: () => import('./InfoboxSystem.svelte'),
	generic: () => import('./InfoboxGeneric.svelte'),
}

/** Get the component for a given infobox type (lazy-loaded) */
export async function getInfoboxComponent(type: InfoboxType) {
	const loader = INFOBOX_COMPONENTS[type]
	const module_ = await loader()
	return module_.default
}

export { detectInfoboxType } from './detect.js'
export { buildFieldMap } from './types.js'

import type { InfoboxType, FieldMap } from './types.js'
import type { InfoboxSchema } from './schemas/types.js'
import type { Component } from 'svelte'

import { religionSchema } from './schemas/religion.js'
import { personSchema } from './schemas/person.js'
import { genericSchema } from './schemas/generic.js'

import InfoboxCountry from './InfoboxCountry.svelte'
import InfoboxFormerCountry from './InfoboxFormerCountry.svelte'
import InfoboxLanguage from './InfoboxLanguage.svelte'
import InfoboxSettlement from './InfoboxSettlement.svelte'
import InfoboxRoyalty from './InfoboxRoyalty.svelte'
import InfoboxOfficeholder from './InfoboxOfficeholder.svelte'
import InfoboxStar from './InfoboxStar.svelte'
import InfoboxPlanet from './InfoboxPlanet.svelte'
import InfoboxSystem from './InfoboxSystem.svelte'

export type InfoboxComponent = Component<{ fields: FieldMap }>

export type InfoboxEntry =
	| { kind: 'schema', schema: InfoboxSchema }
	| { kind: 'component', component: InfoboxComponent }

export const INFOBOX_ENTRIES: Record<InfoboxType, InfoboxEntry> = {
	country: { kind: 'component', component: InfoboxCountry },
	former_country: { kind: 'component', component: InfoboxFormerCountry },
	language: { kind: 'component', component: InfoboxLanguage },
	settlement: { kind: 'component', component: InfoboxSettlement },
	royalty: { kind: 'component', component: InfoboxRoyalty },
	officeholder: { kind: 'component', component: InfoboxOfficeholder },
	person: { kind: 'schema', schema: personSchema },
	religion: { kind: 'schema', schema: religionSchema },
	star: { kind: 'component', component: InfoboxStar },
	planet: { kind: 'component', component: InfoboxPlanet },
	system: { kind: 'component', component: InfoboxSystem },
	generic: { kind: 'schema', schema: genericSchema },
}

export { detectInfoboxType } from './detect.js'
export { buildFieldMap } from './types.js'

import type { InfoboxType, FieldMap } from './types.js'
import type { InfoboxSchema } from './schemas/types.js'
import type { Component } from 'svelte'

import { religionSchema } from './schemas/religion.js'
import { personSchema } from './schemas/person.js'
import { genericSchema } from './schemas/generic.js'
import { officeholderSchema } from './schemas/officeholder.js'
import { royaltySchema } from './schemas/royalty.js'
import { formerCountrySchema } from './schemas/former-country.js'
import { settlementSchema } from './schemas/settlement.js'
import { countrySchema } from './schemas/country.js'

import InfoboxLanguage from './InfoboxLanguage.svelte'
import InfoboxStar from './InfoboxStar.svelte'
import InfoboxPlanet from './InfoboxPlanet.svelte'
import InfoboxSystem from './InfoboxSystem.svelte'

export type InfoboxComponent = Component<{ fields: FieldMap }>

export type InfoboxEntry =
	| { kind: 'schema', schema: InfoboxSchema }
	| { kind: 'component', component: InfoboxComponent }

export const INFOBOX_ENTRIES: Record<InfoboxType, InfoboxEntry> = {
	country: { kind: 'schema', schema: countrySchema },
	former_country: { kind: 'schema', schema: formerCountrySchema },
	language: { kind: 'component', component: InfoboxLanguage },
	settlement: { kind: 'schema', schema: settlementSchema },
	royalty: { kind: 'schema', schema: royaltySchema },
	officeholder: { kind: 'schema', schema: officeholderSchema },
	person: { kind: 'schema', schema: personSchema },
	religion: { kind: 'schema', schema: religionSchema },
	star: { kind: 'component', component: InfoboxStar },
	planet: { kind: 'component', component: InfoboxPlanet },
	system: { kind: 'component', component: InfoboxSystem },
	generic: { kind: 'schema', schema: genericSchema },
}

export { detectInfoboxType } from './detect.js'
export { buildFieldMap } from './types.js'

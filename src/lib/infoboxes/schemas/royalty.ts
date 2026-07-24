import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const royaltySchema: InfoboxSchema = {
	id: 'royalty',
	title: ['name', 'title'],
	image: ['image'],
	caption: ['caption'],
	extraKeys: [
		'birth_date', 'birth_place', 'death_date', 'death_place',
		'consort_type', 'reign_type',
	],
	sections: [
		{
			repeat: { discoverKey: 'succession', max: 10 },
			rows: [
				{
					label: 'Reign',
					compose: (fields, suffix) => {
						const reign = getField(fields, `reign${suffix}`) ?? ''
						return reign
					},
					// Note: the original uses reign_type${suffix} as the label override.
					// We approximate by always labeling "Reign"; if a wiki uses non-default
					// reign_type values, we can extend the schema later.
				},
				{ label: 'Coronation', keys: ['coronation'] },
				{ label: 'Predecessor', keys: ['predecessor'] },
				{ label: 'Successor', keys: ['successor'] },
				{ label: 'Regent', keys: ['regent'] },
			],
		},
		{
			heading: 'Personal Details',
			rows: [
				{ label: 'Full name', keys: ['full_name'] },
				{ label: 'Native name', keys: ['native_name'] },
				{ label: 'Birth name', keys: ['birth_name'] },
				{
					label: 'Born',
					compose: (fields) => {
						const date = getField(fields, 'birth_date') ?? ''
						const place = getField(fields, 'birth_place') ?? ''
						return date ? `${date}${place ? `, ${place}` : ''}` : ''
					},
				},
				{
					label: 'Died',
					compose: (fields) => {
						const date = getField(fields, 'death_date') ?? ''
						const place = getField(fields, 'death_place') ?? ''
						return date ? `${date}${place ? `, ${place}` : ''}` : ''
					},
				},
				{ label: 'Burial', keys: ['burial_place'] },
				{
					label: 'Consort',
					compose: fields => getField(fields, 'spouse', 'consort') ?? '',
				},
				{ label: 'Issue', keys: ['issue'] },
				{ label: 'House', keys: ['royal_house', 'house', 'dynasty'] },
				{ label: 'Father', keys: ['father'] },
				{ label: 'Mother', keys: ['mother'] },
				{ label: 'Religion', keys: ['religion'] },
			],
		},
	],
}

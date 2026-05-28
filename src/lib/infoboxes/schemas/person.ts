import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const personSchema: InfoboxSchema = {
	id: 'person',
	title: ['name'],
	image: ['image'],
	caption: ['caption'],
	extraKeys: ['image_size', 'birth_date', 'born', 'birth_place', 'death_date', 'died', 'death_place'],
	sections: [
		{
			rows: [
				{ label: 'Birth name', keys: ['birth_name'] },
				{
					label: 'Born',
					compose: (fields) => {
						const date = getField(fields, 'birth_date', 'born') ?? ''
						const place = getField(fields, 'birth_place') ?? ''
						return date ? `${date}${place ? `, ${place}` : ''}` : ''
					},
				},
				{
					label: 'Died',
					compose: (fields) => {
						const date = getField(fields, 'death_date', 'died') ?? ''
						const place = getField(fields, 'death_place') ?? ''
						return date ? `${date}${place ? `, ${place}` : ''}` : ''
					},
				},
				{ label: 'Nationality', keys: ['nationality'] },
				{ label: 'Occupation', keys: ['occupation'] },
				{ label: 'Known for', keys: ['known_for', 'notable_works'] },
				{ label: 'Education', keys: ['education', 'alma_mater'] },
				{ label: 'Spouse', keys: ['spouse'] },
				{ label: 'Children', keys: ['children'] },
				{ label: 'Father', keys: ['father', 'parents'] },
				{ label: 'Mother', keys: ['mother'] },
				{ label: 'Awards', keys: ['awards'] },
				{ label: 'Religion', keys: ['religion'] },
			],
		},
	],
}

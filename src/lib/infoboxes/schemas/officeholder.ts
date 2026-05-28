import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const officeholderSchema: InfoboxSchema = {
	id: 'officeholder',
	title: ['name'],
	titleCompose: (fields) => {
		const prefix = getField(fields, 'honorific_prefix') ?? ''
		const name = getField(fields, 'name') ?? ''
		const suffix = getField(fields, 'honorific_suffix') ?? ''
		return [prefix, name, suffix].filter(Boolean).join(' ')
	},
	subtitle: ['native_name'],
	image: ['image', 'smallimage'],
	caption: ['caption'],
	extraKeys: [
		'honorific_prefix', 'honorific_suffix',
		'birth_date', 'birth_place', 'death_date', 'death_place',
	],
	sections: [
		{
			repeat: { discoverKey: 'office', max: 16 },
			rows: [
				{ label: 'Order', keys: ['order'] },
				{
					label: 'In office',
					compose: (fields, suffix) => {
						const start = getField(fields, `term_start${suffix}`) ?? ''
						const end = getField(fields, `term_end${suffix}`) ?? ''
						if (!start && !end) return ''
						return `${start}${end ? ` – ${end}` : ' – present'}`
					},
				},
				{ label: 'Monarch', keys: ['monarch'] },
				{ label: 'President', keys: ['president'] },
				{ label: 'Prime Minister', keys: ['primeminister'] },
				{ label: 'Preceded by', keys: ['predecessor'] },
				{ label: 'Succeeded by', keys: ['successor'] },
			],
		},
		{
			heading: 'Personal Details',
			rows: [
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
			],
		},
	],
}

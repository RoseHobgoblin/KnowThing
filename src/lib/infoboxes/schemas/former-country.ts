import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const formerCountrySchema: InfoboxSchema = {
	id: 'former_country',
	title: ['conventional_long_name', 'name', 'common_name'],
	subtitleCompose: (fields) => {
		const native = getField(fields, 'native_name') ?? ''
		if (native) return native
		const start = getField(fields, 'year_start') ?? ''
		const end = getField(fields, 'year_end') ?? ''
		return start || end ? `${start}–${end}` : ''
	},
	image: ['image_flag', 'image'],
	caption: ['caption'],
	extraKeys: ['native_name', 'year_start', 'year_end'],
	sections: [
		{
			rows: [
				{ label: 'Status', keys: ['status', 'status_text'] },
				{
					label: 'Era',
					compose: (fields) => {
						const start = getField(fields, 'year_start') ?? ''
						const end = getField(fields, 'year_end') ?? ''
						return start || end ? `${start}–${end}` : ''
					},
				},
				{ label: 'Capital', keys: ['capital'] },
				{ label: 'Government', keys: ['government_type', 'government'] },
				{ label: 'Religion', keys: ['religion'] },
				{ label: 'Currency', keys: ['currency'] },
			],
		},
		{
			heading: 'History',
			rows: [
				{ pair: { labelKey: 'established_event', valueKey: 'established_date', max: 13 } },
			],
		},
		{
			heading: 'Succession',
			rows: [
				{ label: 'Preceded by', keys: ['predecessor'] },
				{ label: 'Succeeded by', keys: ['successor'] },
				{ label: 'Today part of', keys: ['today_part_of'] },
			],
		},
	],
}

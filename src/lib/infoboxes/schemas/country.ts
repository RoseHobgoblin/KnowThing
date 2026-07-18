import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const countrySchema: InfoboxSchema = {
	id: 'country',
	title: ['conventional_long_name', 'name', 'common_name'],
	subtitle: ['native_name'],
	image: ['image'],
	caption: ['caption'],
	headerImages: [
		{
			fileKeys: ['image_flag', 'flag'],
			captionKeys: ['flag_caption', 'flag_type'],
			altKeys: ['alt_flag', 'flag_alt'],
			defaultCaption: 'Flag',
			width: 150,
		},
		{
			fileKeys: ['image_coat', 'image_symbol', 'coat_of_arms'],
			captionKeys: ['symbol_type'],
			altKeys: ['alt_coat', 'coat_alt', 'alt_symbol'],
			defaultCaption: 'Coat of arms',
			width: 100,
		},
	],
	extraKeys: [
		'population_census', 'population', 'population_estimate',
		'population_census_year', 'population_year', 'population_estimate_year',
		'area_km2', 'area',
		'largest_city', 'largest_settlement',
	],
	sections: [
		{
			heading: 'Identity',
			rows: [
				{ label: 'Native name', keys: ['native_name'] },
			],
		},
		{
			rows: [
				{ label: 'Motto', keys: ['national_motto', 'motto'] },
				{ label: 'Anthem', keys: ['national_anthem', 'anthem'] },
				{ label: 'Capital', keys: ['capital'] },
				{
					label: 'Largest city',
					compose: (fields) => {
						const largest = getField(fields, 'largest_city', 'largest_settlement') ?? ''
						const capital = getField(fields, 'capital') ?? ''
						return largest && largest !== capital ? largest : ''
					},
				},
				{ label: 'Official languages', keys: ['official_languages', 'languages'] },
				{ label: 'Religion', keys: ['religion'] },
				{ label: 'Demonym', keys: ['demonym'] },
			],
		},
		{
			heading: 'Government',
			rows: [
				{ label: 'Type', keys: ['government_type', 'government'] },
				{ pair: { labelKey: 'leader_title', valueKey: 'leader_name', max: 14 } },
				{ label: 'Legislature', keys: ['legislature'] },
			],
		},
		{
			heading: 'Establishment',
			rows: [
				{ pair: { labelKey: 'established_event', valueKey: 'established_date', max: 13 } },
			],
		},
		{
			heading: 'Area & Population',
			rows: [
				{
					label: 'Total area',
					compose: (fields) => {
						const value = getField(fields, 'area_km2', 'area') ?? ''
						return value ? `${value} km²` : ''
					},
				},
				{
					label: 'Population',
					compose: (fields) => {
						const value = getField(fields, 'population_census', 'population', 'population_estimate') ?? ''
						const year = getField(fields, 'population_census_year', 'population_year', 'population_estimate_year') ?? ''
						return value ? `${value}${year ? ` (${year})` : ''}` : ''
					},
				},
			],
		},
		{
			rows: [
				{ label: 'Currency', keys: ['currency'] },
				{ label: 'Time zone', keys: ['time_zone'] },
			],
		},
	],
}

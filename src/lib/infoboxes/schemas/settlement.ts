import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

export const settlementSchema: InfoboxSchema = {
	id: 'settlement',
	title: ['name', 'official_name'],
	subtitleCompose: (fields) => {
		return (
			getField(fields, 'settlement_type', 'type')
			?? getField(fields, 'native_name', 'other_name')
			?? ''
		)
	},
	image: ['image_skyline', 'image'],
	caption: ['image_caption', 'caption'],
	extraKeys: [
		'settlement_type', 'type', 'native_name', 'other_name',
		'population_as_of',
		'area_total_km2', 'area_km2', 'elevation_m',
		'population_total', 'population', 'population_density_km2',
	],
	sections: [
		{
			rows: [
				{ label: 'Nickname', keys: ['nickname'] },
				{ label: 'Motto', keys: ['motto'] },
				{ label: 'Etymology', keys: ['etymology'] },
				{ label: 'Coordinates', keys: ['coordinates'] },
				{ pair: { labelKey: 'subdivision_type', valueKey: 'subdivision_name', max: 6 } },
			],
		},
		{
			heading: 'Founding',
			rows: [
				{ label: 'Founded by', keys: ['founder'] },
				{ label: 'Named for', keys: ['named_for'] },
				{ pair: { labelKey: 'established_title', valueKey: 'established_date', max: 7 } },
			],
		},
		{
			heading: 'Government',
			rows: [
				{ label: 'Type', keys: ['government_type', 'government'] },
				{ label: 'Mayor', keys: ['mayor'] },
				{ pair: { labelKey: 'leader_title', valueKey: 'leader_name', max: 16 } },
			],
		},
		{
			heading: 'Area & Population',
			rows: [
				{
					label: 'Total area',
					compose: (fields) => {
						const value = getField(fields, 'area_total_km2', 'area_km2') ?? ''
						return value ? `${value} km²` : ''
					},
				},
				{
					label: 'Elevation',
					compose: (fields) => {
						const value = getField(fields, 'elevation_m') ?? ''
						return value ? `${value} m` : ''
					},
				},
				{
					label: 'Population',
					compose: (fields) => {
						const value = getField(fields, 'population_total', 'population') ?? ''
						const asOf = getField(fields, 'population_as_of') ?? ''
						return value ? `${value}${asOf ? ` (${asOf})` : ''}` : ''
					},
				},
				{
					label: 'Density',
					compose: (fields) => {
						const value = getField(fields, 'population_density_km2') ?? ''
						return value ? `${value}/km²` : ''
					},
				},
			],
		},
		{
			rows: [
				{ label: 'Time zone', keys: ['timezone', 'time_zone'] },
				{ label: 'Postal code', keys: ['postal_code'] },
				{ label: 'Area code', keys: ['area_code'] },
			],
		},
	],
}

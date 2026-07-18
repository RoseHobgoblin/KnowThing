import type { InfoboxSchema } from './types.js'
import { getField } from '../types.js'

function linkedSectionHeading(
	fields: Parameters<NonNullable<InfoboxSchema['titleCompose']>>[0],
	label: string,
	topic: string = label,
): string {
	const country = getField(fields, 'common_name', 'name') ?? ''
	return country ? `[[${topic} of ${country}|${label}]]` : label
}

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
		'gdp_ppp', 'gdp_ppp_total', 'gdp_ppp_year',
		'gdp_nominal', 'gdp', 'gdp_nominal_year', 'gdp_year',
		'gini', 'gini_year', 'hdi', 'hdi_year',
		'largest_city', 'largest_settlement',
	],
	sections: [
		{
			rows: [
				{ label: 'Native name', keys: ['native_name'] },
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
			headingCompose: fields => linkedSectionHeading(fields, 'Government', 'Politics'),
			rows: [
				{ label: 'Type', keys: ['government_type', 'government'] },
				{ pair: { labelKey: 'leader_title', valueKey: 'leader_name', max: 14 } },
				{ label: 'Legislature', keys: ['legislature'] },
			],
		},
		{
			headingCompose: fields => linkedSectionHeading(fields, 'History'),
			rows: [
				{ pair: { labelKey: 'established_event', valueKey: 'established_date', max: 13 } },
			],
		},
		{
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
				{ label: 'GDP (PPP)', keys: ['gdp_ppp', 'gdp_ppp_total'] },
				{ label: 'GDP', keys: ['gdp_nominal', 'gdp'] },
				{ label: 'Gini', keys: ['gini'] },
				{ label: 'HDI', keys: ['hdi'] },
				{ label: 'Currency', keys: ['currency'] },
			],
		},
		{
			rows: [
				{ label: 'Time zone', keys: ['time_zone'] },
				{ label: 'Calling code', keys: ['calling_code'] },
				{ label: 'ISO 3166 code', keys: ['iso3166code', 'iso_3166_code', 'iso_code'] },
				{ label: 'Internet TLD', keys: ['internet_tld', 'tld'] },
			],
		},
	],
}

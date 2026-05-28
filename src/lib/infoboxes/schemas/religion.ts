import type { InfoboxSchema } from './types.js'

export const religionSchema: InfoboxSchema = {
	id: 'religion',
	title: ['name'],
	subtitle: ['type', 'classification'],
	image: ['image'],
	caption: ['caption'],
	sections: [
		{
			rows: [
				{ label: 'Theology', keys: ['theology'] },
				{ label: 'Deity', keys: ['deity', 'deities'] },
				{ label: 'Scripture', keys: ['scripture'] },
				{ label: 'Founder', keys: ['founder'] },
				{ label: 'Origin', keys: ['origin', 'founded'] },
				{ label: 'Followers', keys: ['followers', 'adherents', 'members'] },
				{ label: 'Leader', keys: ['leader', 'authority'] },
				{ label: 'Headquarters', keys: ['headquarters'] },
				{ label: 'Sacred language', keys: ['language'] },
				{ label: 'Branches', keys: ['branches', 'denominations'] },
				{ label: 'Region', keys: ['region', 'territories'] },
			],
		},
	],
}

import type { InfoboxSchema } from './types.js'

export const genericSchema: InfoboxSchema = {
	id: 'generic',
	title: ['name', 'title'],
	image: ['image'],
	caption: ['caption', 'imagecaption'],
	sections: [],
	extraKeys: ['image_size'],
}

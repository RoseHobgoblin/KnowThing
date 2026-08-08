export const worlds = {
	mars: {
		bodyId: 'solar-system/mars', name: 'Mars', radiiM: [3396190, 3396190, 3376200],
		center: [137.4, -4.6],
		features: {
			type: 'FeatureCollection',
			features: [
				{ type: 'Feature', id: 'olympus', properties: { name: 'Olympus Mons' }, geometry: { type: 'Point', coordinates: [-133.8, 18.65] } },
				{ type: 'Feature', id: 'antimeridian', properties: { name: 'Antimeridian study area' }, geometry: { type: 'MultiPolygon', coordinates: [[[[170, -10], [180, -10], [180, 10], [170, 10], [170, -10]]], [[[-180, -10], [-170, -10], [-170, 10], [-180, 10], [-180, -10]]]] } },
				{ type: 'Feature', id: 'north-pole', properties: { name: 'North polar cap' }, geometry: { type: 'Polygon', coordinates: [[[-180, 80], [-90, 80], [0, 80], [90, 80], [180, 80], [180, 89], [-180, 89], [-180, 80]]] } },
			],
		},
	},
	pelagos: {
		bodyId: 'fictional/pelagos', name: 'Pelagos', radiiM: [6000000, 6000000, 6000000],
		center: [34, -12],
		features: {
			type: 'FeatureCollection',
			features: [
				{ type: 'Feature', id: 'capital', properties: { name: 'Pelagos capital' }, geometry: { type: 'Point', coordinates: [34, -12] } },
				{ type: 'Feature', id: 'survey', properties: { name: 'Survey region' }, geometry: { type: 'Polygon', coordinates: [[[20, -20], [48, -20], [48, -4], [20, -4], [20, -20]]] } },
			],
		},
	},
}

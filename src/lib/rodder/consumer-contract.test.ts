import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DISPLAY_INTERACTION_PRESETS, rodderEntityDocumentSchema, rodderSectorDocumentSchema } from './consumer-contract.js'

const identity = { id: 1, kind: 'system', name: 'Root', slug: 'root', href: '/Rodder:root' }
const diagnostics = [{ code: 'test', severity: 'info', message: 'Visible locally.', path: null }]

describe('Rodder consumer contracts', () => {
	it('accepts JSON-safe entity documents and strips undeclared internal fields', () => {
		const parsed = rodderEntityDocumentSchema.parse({
			resource: 'rodder-entity',
			identity,
			authored: {
				description: '',
				article: { wikitext: '', plainText: '', updatedAt: null, parsedAst: { internal: true } },
				physical: { massKg: null, radiusM: null, age: null, temperatureK: null },
				observation: { apparentMagnitude: null, absoluteMagnitude: null, angularDiameter: null },
				orbit: { orbitalPeriodDays: null, semiMajorAxisAu: null, eccentricity: null, epochPhase: null, inclination: null, longitudeAscendingNode: null, argumentOfPeriapsis: null },
				rotation: { periodS: null, axialTilt: null },
				stellar: null,
				planetary: null,
				system: { distanceLy: null, formationAge: null, designations: null },
				extensions: {},
			},
			relationships: { parent: null, root: identity, ancestors: [], children: [] },
			placement: null,
			resolved: { facts: { starCount: { value: 0, status: 'derived', source: 'hierarchy' } } },
			displays: { rootMap: null },
			capabilities: { article: false, rootMap: false, sectorPlacement: false, surface: false, weather: false, calendar: false },
			links: { self: '/api/rodder/root', page: '/Rodder:root', root: '/Rodder:root', parent: null, sector: null },
			diagnostics,
			updatedAt: '2026-01-01T00:00:00.000Z',
			storagePath: '/secret',
		})
		expect(parsed.authored.article).not.toHaveProperty('parsedAst')
		expect(parsed).not.toHaveProperty('storagePath')
	})

	it('accepts sector documents with explicit unavailable positions', () => {
		const parsed = rodderSectorDocumentSchema.parse({
			resource: 'rodder-sector',
			identity: { id: 1, name: 'Reach', slug: 'reach', description: '', href: '/rodder/sector/reach' },
			frame: { units: 'ly', shape: null, radius: null, extentX: null, extentY: null, extentZ: null, originKind: 'frame-centred', origin: null, axesNote: null, handedness: 'right-handed', referenceEpoch: null, provenance: 'authored' },
			roots: [],
			resolved: { rootCount: 0, positionedRootCount: 0, unpositionedRootCount: 0, boundsRadius: 1 },
			displays: { sectorMap: { units: 'ly', roots: [] } },
			capabilities: { sectorMap: true, rootNavigation: false },
			links: { self: '/api/rodder/sectors/reach', page: '/rodder/sector/reach' },
			diagnostics,
			updatedAt: '2026-01-01T00:00:00.000Z',
		})
		expect(parsed.frame.shape).toBeNull()
	})

	it('keeps animation and chrome-independent capabilities', () => {
		expect(DISPLAY_INTERACTION_PRESETS.locked).toMatchObject({ timeMovement: false, controlsVisible: false })
		expect(DISPLAY_INTERACTION_PRESETS.explore).toMatchObject({ timeMovement: true, controlsVisible: true })
	})

	it('exports machine-readable entity and sector schemas', () => {
		expect(() => z.toJSONSchema(rodderEntityDocumentSchema, { unrepresentable: 'any' })).not.toThrow()
		expect(() => z.toJSONSchema(rodderSectorDocumentSchema, { unrepresentable: 'any' })).not.toThrow()
	})
})

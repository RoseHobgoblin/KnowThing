import { describe, it, expect } from 'vitest'
import {
	CELESTIAL_FORM_CONFIGS,
	allFieldSpecs,
	buildDraft,
	buildPayload,
	descendantIds,
	lockFlagKey,
	labelOf,
	type BodyReferenceOption,
	type CelestialFormConfig,
	type FieldContext,
	type SelectFieldSpec,
} from './form-registry.js'

function makeCtx(config: CelestialFormConfig, overrides: Partial<FieldContext> = {}): FieldContext {
	return {
		draft: buildDraft(config, { id: 1, name: 'Test', slug: 'test' }),
		selfId: 1,
		systems: [],
		stars: [],
		siblings: [],
		...overrides,
	}
}

function selectSpec(config: CelestialFormConfig, key: string): SelectFieldSpec {
	const spec = allFieldSpecs(config).find(s => s.control === 'select' && s.key === key)
	if (!spec || spec.control !== 'select') throw new Error(`no select spec ${key}`)
	return spec
}

describe('buildDraft', () => {
	it('hydrates text as \'\' and numbers as null when the record is sparse', () => {
		const draft = buildDraft(CELESTIAL_FORM_CONFIGS.system, { id: 1, name: 'Sunly', slug: 'sunly' })
		expect(draft.name).toBe('Sunly')
		expect(draft.designations).toBe('')
		expect(draft.distanceLy).toBeNull()
		expect(draft.galacticX).toBeNull()
	})

	it('hydrates lockable overrides from the extra JSONB and flags them unlocked', () => {
		const draft = buildDraft(CELESTIAL_FORM_CONFIGS.star, {
			id: 2, name: 'Sun', slug: 'the-sun',
			extra: { density: '1.41 g/cm³', surface_gravity: 274 },
		})
		expect(draft.density).toBe('1.41 g/cm³')
		expect(draft[lockFlagKey('density')]).toBe(true)
		// non-string extra values are not treated as overrides
		expect(draft.surfaceGravity).toBeNull()
		expect(draft[lockFlagKey('surfaceGravity')]).toBe(false)
	})

	it('hydrates the body orbital-period lock from the record column', () => {
		const withPeriod = buildDraft(CELESTIAL_FORM_CONFIGS.body, { id: 3, name: 'Earth', slug: 'earth', orbitalPeriodDays: 365.25 })
		expect(withPeriod.orbitalPeriodDays).toBe(365.25)
		expect(withPeriod[lockFlagKey('orbitalPeriodDays')]).toBe(true)

		const withoutPeriod = buildDraft(CELESTIAL_FORM_CONFIGS.body, { id: 3, name: 'Earth', slug: 'earth' })
		expect(withoutPeriod[lockFlagKey('orbitalPeriodDays')]).toBe(false)
	})

	it('stringifies parent-edge selects and defaults bodyType to planet', () => {
		const draft = buildDraft(CELESTIAL_FORM_CONFIGS.body, { id: 3, name: 'Luna', slug: 'luna', starId: 7, parentId: 4 })
		expect(draft.starId).toBe('7')
		expect(draft.parentId).toBe('4')
		expect(draft.bodyType).toBe('planet')
	})

	it('hydrates a circumbinary body\'s primary as its system barycenter', () => {
		const draft = buildDraft(CELESTIAL_FORM_CONFIGS.body, { id: 3, name: 'Tatooine', slug: 'tatooine', starId: null, parentSystemId: 3 })
		expect(draft.starId).toBe('system:3')
	})
})

describe('buildPayload', () => {
	it('coalesces the star parent edge: companion wins over system', () => {
		const config = CELESTIAL_FORM_CONFIGS.star
		const ctx = makeCtx(config)
		ctx.draft.systemId = '5'
		expect(buildPayload(config, ctx).parentId).toBe(5)
		ctx.draft.parentStarId = '9'
		expect(buildPayload(config, ctx).parentId).toBe(9)
		ctx.draft.systemId = ''
		ctx.draft.parentStarId = ''
		expect(buildPayload(config, ctx).parentId).toBeNull()
		// the raw select strings never leak into the payload
		expect('systemId' in buildPayload(config, ctx)).toBe(false)
		expect('parentStarId' in buildPayload(config, ctx)).toBe(false)
	})

	it('coalesces the body parent edge: parent body wins over star', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const ctx = makeCtx(config)
		ctx.draft.starId = '7'
		expect(buildPayload(config, ctx).parentId).toBe(7)
		ctx.draft.parentId = '4'
		expect(buildPayload(config, ctx).parentId).toBe(4)
		expect('starId' in buildPayload(config, ctx)).toBe(false)
	})

	it('a system barycenter selection becomes the parent edge (circumbinary)', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const ctx = makeCtx(config)
		ctx.draft.starId = 'system:3'
		expect(buildPayload(config, ctx).parentId).toBe(3)
		ctx.draft.parentId = '4'
		expect(buildPayload(config, ctx).parentId).toBe(4)
	})

	it('round-trips independent surface channels through the body extra JSON', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const draft = buildDraft(config, {
			id: 3, name: 'Earth', slug: 'earth',
			extra: {
				density: '5.51 g/cm³',
				surface: {
					version: 1, fallback: 'flat', class: 'terrestrial', seed: 42,
					hydrosphereFraction: 0.71, cloudCoverage: null,
					maps: { albedo: 'Earth albedo.png', normal: 'Earth normal.png' },
				},
			},
		})
		expect(draft.surfaceFallback).toBe('flat')
		expect(draft.surfaceHydrosphere).toBe(0.71)
		expect(draft.surfaceMap_albedo).toBe('Earth albedo.png')
		draft.starId = '7'
		draft.surfaceMap_roughness = 'Earth roughness.png'
		const payload = buildPayload(config, { draft, selfId: 3, systems: [], stars: [], siblings: [] })
		expect(payload).not.toHaveProperty('surfaceMap_albedo')
		expect(payload.extra).toMatchObject({
			density: '5.51 g/cm³',
			surface: {
				version: 1, fallback: 'flat', class: 'terrestrial', seed: 42,
				hydrosphereFraction: 0.71,
				maps: {
					albedo: 'Earth albedo.png',
					normal: 'Earth normal.png',
					roughness: 'Earth roughness.png',
				},
			},
		})
		expect(config.updateSchema.safeParse(payload).success).toBe(true)
	})

	it('sends locked overrides as null and unlocked overrides verbatim', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const ctx = makeCtx(config)
		ctx.draft.density = '99 g/cm³'
		ctx.draft[lockFlagKey('density')] = false
		expect(buildPayload(config, ctx).density).toBeNull()
		ctx.draft[lockFlagKey('density')] = true
		expect(buildPayload(config, ctx).density).toBe('99 g/cm³')
	})

	it('nulls empty optional text but keeps description as a string', () => {
		const config = CELESTIAL_FORM_CONFIGS.system
		const ctx = makeCtx(config)
		const payload = buildPayload(config, ctx)
		expect(payload.designations).toBeNull()
		expect(payload.formationAge).toBeNull()
		expect(payload.description).toBe('')
	})

	it('validates against the kind update schema', () => {
		const config = CELESTIAL_FORM_CONFIGS.star
		const ctx = makeCtx(config, {
			draft: buildDraft(config, { id: 2, name: 'Sun', slug: 'the-sun', massKg: 1.989e30 }),
		})
		expect(config.updateSchema.safeParse(buildPayload(config, ctx)).success).toBe(true)
		ctx.draft.eccentricity = 1.5
		expect(config.updateSchema.safeParse(buildPayload(config, ctx)).success).toBe(false)
	})

	it('passes luminosityW through for stars', () => {
		const config = CELESTIAL_FORM_CONFIGS.star
		const ctx = makeCtx(config, { draft: buildDraft(config, { id: 2, name: 'Sun', slug: 'the-sun', luminosityW: 3.828e26 }) })
		expect(buildPayload(config, ctx).luminosityW).toBe(3.828e26)
	})
})

describe('parent option filtering', () => {
	const siblings: BodyReferenceOption[] = [
		{ id: 1, name: 'Earth', starId: 7, parentId: null, massKg: 5.97e24, semiMajorAxisAu: 1, eccentricity: 0.0167 },
		{ id: 2, name: 'Luna', starId: 7, parentId: 1 },
		{ id: 3, name: 'Submoon', starId: 7, parentId: 2 },
		{ id: 4, name: 'Mars', starId: 7, parentId: null },
		{ id: 5, name: 'Rogue', starId: null, parentId: null },
	]

	it('descendantIds walks the whole subtree including self', () => {
		expect([...descendantIds(siblings, 1)].toSorted()).toEqual([1, 2, 3])
		expect([...descendantIds(siblings, 4)]).toEqual([4])
		expect(descendantIds(siblings, null).size).toBe(0)
	})

	it('body parent options exclude self and descendants, and filter by star', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const ctx = makeCtx(config, { selfId: 1, siblings })
		ctx.draft.starId = '7'
		const options = selectSpec(config, 'parentId').options(ctx)
		expect(options.map(o => o.label)).toEqual(['None (orbits primary directly)', 'Mars'])
	})

	it('body parent options under a barycenter span the whole system', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const systemSiblings: BodyReferenceOption[] = [
			{ id: 1, name: 'Earth', starId: 7, parentId: null, rootSystemId: 3 },
			{ id: 2, name: 'Tatooine', starId: null, parentId: null, parentSystemId: 3, rootSystemId: 3 },
			{ id: 3, name: 'Elsewhere', starId: 9, parentId: null, rootSystemId: 4 },
		]
		const ctx = makeCtx(config, { selfId: 99, siblings: systemSiblings })
		ctx.draft.starId = 'system:3'
		const options = selectSpec(config, 'parentId').options(ctx)
		expect(options.map(o => o.label)).toEqual(['None (orbits primary directly)', 'Earth', 'Tatooine'])
	})

	it('body parent options fall back to star-less siblings when no star is chosen', () => {
		const config = CELESTIAL_FORM_CONFIGS.body
		const ctx = makeCtx(config, { selfId: 1, siblings })
		ctx.draft.starId = ''
		const options = selectSpec(config, 'parentId').options(ctx)
		expect(options.map(o => o.label)).toEqual(['None', 'Rogue'])
	})

	it('star companion options require a shared system and exclude self', () => {
		const config = CELESTIAL_FORM_CONFIGS.star
		const stars = [
			{ id: 1, name: 'A', systemId: 10 },
			{ id: 2, name: 'B', systemId: 10 },
			{ id: 3, name: 'C', systemId: 11 },
		]
		const ctx = makeCtx(config, { selfId: 1, stars })
		ctx.draft.systemId = '10'
		expect(selectSpec(config, 'parentStarId').options(ctx).map(o => o.label)).toEqual(['None (primary star)', 'B'])
		ctx.draft.systemId = ''
		expect(selectSpec(config, 'parentStarId').options(ctx)).toHaveLength(1)
	})
})

describe('presets', () => {
	it('star preset patch re-locks every override', () => {
		const patch = CELESTIAL_FORM_CONFIGS.star.presets!.patch('The Sun')
		expect(patch).not.toBeNull()
		expect(patch!.massKg).toBeGreaterThan(1e30)
		expect(patch![lockFlagKey('density')]).toBe(false)
		expect(patch!.luminosity).toBeNull()
	})

	it('body preset patch unlocks the orbital period it sets', () => {
		const patch = CELESTIAL_FORM_CONFIGS.body.presets!.patch('Earth')
		expect(patch).not.toBeNull()
		expect(patch!.orbitalPeriodDays).toBeCloseTo(365.25, 0)
		expect(patch![lockFlagKey('orbitalPeriodDays')]).toBe(true)
	})

	it('unknown preset names patch nothing', () => {
		expect(CELESTIAL_FORM_CONFIGS.star.presets!.patch('Nonexistent')).toBeNull()
	})
})

describe('registry integrity', () => {
	it('every keyed field appears in the draft exactly once per kind', () => {
		for (const config of Object.values(CELESTIAL_FORM_CONFIGS)) {
			const draft = buildDraft(config, { id: 1, name: 'X', slug: 'x' })
			for (const spec of allFieldSpecs(config)) {
				expect(draft, `${config.kind}:${spec.key}`).toHaveProperty(spec.key)
			}
		}
	})

	it('an untouched draft round-trips through the update schema', () => {
		for (const config of Object.values(CELESTIAL_FORM_CONFIGS)) {
			const ctx = makeCtx(config)
			// A body with no parent edge is *supposed* to fail validation — give it one.
			if (config.kind === 'body') ctx.draft.starId = '7'
			const parsed = config.updateSchema.safeParse(buildPayload(config, ctx))
			expect(parsed.success, config.kind).toBe(true)
		}
	})

	it('dynamic labels resolve for every field', () => {
		for (const config of Object.values(CELESTIAL_FORM_CONFIGS)) {
			const ctx = makeCtx(config)
			for (const spec of allFieldSpecs(config)) {
				expect(labelOf(spec, ctx).length).toBeGreaterThan(0)
			}
		}
	})
})

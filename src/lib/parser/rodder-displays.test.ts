import { describe, expect, it } from 'vitest'
import { extractRodderDisplayRefs, parseWikitext } from './index.js'

describe('Rodder display discovery', () => {
	it('discovers root and sector targets while preserving document order', () => {
		const ast = parseWikitext('{{Root map|orison-fold|mode=orrery}}\n{{Sector map|palimpsest-reach}}\n{{Root map|orison-fold}}')
		expect(extractRodderDisplayRefs(ast)).toEqual([
			{ kind: 'root', slug: 'orison-fold' },
			{ kind: 'sector', slug: 'palimpsest-reach' },
			{ kind: 'root', slug: 'orison-fold' },
		])
	})
})

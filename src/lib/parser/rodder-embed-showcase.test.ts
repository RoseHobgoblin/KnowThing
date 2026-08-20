import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeRodderViewState } from '$lib/rodder/view-state.js'
import {
	extractRodderDisplayRefs as extractRodderDisplayReferences,
	parseWikitext,
} from './index.js'

const seedSql = readFileSync(new URL('../../../scripts/seed-rodder-embed-showcase.sql', import.meta.url), 'utf8')
const articles = [...seedSql.matchAll(/\$wiki\$\r?\n([\S\s]*?)\r?\n\$wiki\$/g)].map(match => match[1])

function articleContaining(text: string): string {
	const article = articles.find(candidate => candidate.includes(text))
	if (!article) throw new Error(`Showcase article containing ${text} was not found`)
	return article
}

describe('Rodder embed showcase seed', () => {
	it('contains ten parseable Wiki articles', () => {
		expect(articles).toHaveLength(10)
		for (const article of articles) expect(() => parseWikitext(article)).not.toThrow()
	})

	it('demonstrates mixed displays while allowing target deduplication', () => {
		const references = extractRodderDisplayReferences(parseWikitext(articleContaining('A locked editorial view')))
		expect(references).toHaveLength(4)
		expect(new Set(references.map(reference => `${reference.kind}:${reference.slug}`)).size).toBe(3)
		expect(references).toContainEqual({ kind: 'sector', slug: 'palimpsest-reach' })
		expect(references).toContainEqual({ kind: 'root', slug: 'orison-fold' })
	})

	it('contains valid copied root and sector view payloads', () => {
		const article = articleContaining('complete copied root-view payload')
		const payloads = [...article.matchAll(/\|view=([^\n\r|}]+)/g)]
			.map(match => decodeRodderViewState(decodeURIComponent(match[1])))
		expect(payloads).toHaveLength(2)
		expect(payloads[0]).toMatchObject({ renderer: 'root', space: { slug: 'needles-rest' } })
		expect(payloads[1]).toMatchObject({ renderer: 'sector', space: { slug: 'palimpsest-reach' } })
	})

	it('keeps the capacity fixture at exactly one target beyond the request ceiling', () => {
		const references = extractRodderDisplayReferences(parseWikitext(articleContaining('25 unique display targets')))
		expect(references).toHaveLength(25)
		expect(new Set(references.map(reference => `${reference.kind}:${reference.slug}`)).size).toBe(25)
	})
})

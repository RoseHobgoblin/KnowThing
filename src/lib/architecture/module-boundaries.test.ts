import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const LIB = path.join(process.cwd(), 'src', 'lib')
const FEATURES = path.join(LIB, 'feature')

function filesUnder(root: string): string[] {
	return readdirSync(root).flatMap((name) => {
		const filePath = path.join(root, name)
		return statSync(filePath).isDirectory()
			? filesUnder(filePath)
			: (/\.(?:ts|svelte)$/.test(name) ? [filePath] : [])
	})
}

function featureImports(path: string) {
	const source = readFileSync(path, 'utf8')
	return [...source.matchAll(/(?:from\s+|import\s*)["']\$lib\/feature\/([^/]+)\/([^"']+)["']/g)]
		.map(match => ({ feature: match[1], target: match[2] }))
}

describe('module boundaries', () => {
	it('has no feature barrels or wildcard feature exports', () => {
		const failures = filesUnder(FEATURES).filter((filePath) => {
			const source = readFileSync(filePath, 'utf8')
			return /^index(?:\.server)?\.ts$/.test(path.basename(filePath)) || /^\s*export\s+\*/m.test(source)
		})
		expect(failures.map(filePath => path.relative(LIB, filePath))).toEqual([])
	})

	it('keeps shared parser, renderer, templates and server infrastructure feature-free', () => {
		const roots = ['parser', 'renderer', 'templates', 'infoboxes', 'server'].map(name => path.join(LIB, name))
		const failures = roots.flatMap(filesUnder).filter(filePath => !filePath.endsWith(path.join('server', 'db', 'schema.ts')) && featureImports(filePath).length > 0)
		expect(failures.map(filePath => path.relative(LIB, filePath))).toEqual([])
	})

	it('allows cross-feature imports only through public capabilities', () => {
		const failures: string[] = []
		for (const filePath of filesUnder(FEATURES)) {
			const owner = path.relative(FEATURES, filePath).split(/[/\\]/)[0]
			for (const imported of featureImports(filePath)) {
				if (imported.feature !== owner && !imported.target.startsWith('public/')) failures.push(path.relative(LIB, filePath))
			}
		}
		expect(failures).toEqual([])
	})

	it('keeps Media independent of Rodder', () => {
		const failures = filesUnder(path.join(FEATURES, 'media')).filter(filePath => /feature\/rodder|rodder/i.test(readFileSync(filePath, 'utf8')))
		expect(failures.map(filePath => path.relative(LIB, filePath))).toEqual([])
	})
})

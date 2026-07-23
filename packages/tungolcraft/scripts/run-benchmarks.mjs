import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBenchmarkFixtures } from '../dist/index.js'

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const fixtures = JSON.parse(readFileSync(
	path.join(packageDirectory, 'benchmarks', 'fixtures.json'),
	'utf8',
))
const report = runBenchmarkFixtures(fixtures)
const json = `${JSON.stringify(report, null, 2)}\n`
const outputIndex = process.argv.indexOf('--output')
const outputPath = outputIndex === -1 ? undefined : process.argv[outputIndex + 1]

if (outputIndex !== -1 && !outputPath) {
	throw new Error('--output requires a file path')
}

if (outputPath) {
	const absoluteOutput = path.resolve(process.cwd(), outputPath)
	mkdirSync(path.dirname(absoluteOutput), { recursive: true })
	writeFileSync(absoluteOutput, json)
}

if (process.argv.includes('--json')) {
	process.stdout.write(json)
} else {
	for (const result of report.results) {
		const marker = result.passed ? 'PASS' : 'FAIL'
		const detail = result.passed
			? `${result.actual?.value} ${result.actual?.unit}`
			: result.message
		console.log(`${marker} ${result.id}: ${detail}`)
	}
	console.log(`${report.passed}/${report.total} scientific benchmarks passed`)
	if (outputPath) console.log(`Machine-readable report: ${outputPath}`)
}

if (report.failed > 0) process.exitCode = 1

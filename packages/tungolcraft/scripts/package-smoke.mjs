import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tungolcraft-package-smoke-'))
const packDirectory = path.join(temporaryDirectory, 'pack')
const consumerDirectory = path.join(temporaryDirectory, 'consumer')
mkdirSync(packDirectory)
mkdirSync(consumerDirectory)

function bun(args, cwd) {
	return execFileSync(process.execPath, args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit'],
	})
}

function listFiles(directory, prefix = '') {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const relativePath = path.posix.join(prefix, entry.name)
		return entry.isDirectory()
			? listFiles(path.join(directory, entry.name), relativePath)
			: [relativePath]
	})
}

try {
	const packedFilename = bun(
		['pm', 'pack', '--destination', packDirectory, '--quiet'],
		packageDirectory,
	).trim()
	const filename = path.basename(packedFilename)
	const tarball = path.join(packDirectory, filename)
	writeFileSync(
		path.join(consumerDirectory, 'package.json'),
		JSON.stringify({ name: 'tungolcraft-smoke-consumer', private: true, type: 'module' }),
	)
	bun(['add', '--ignore-scripts', tarball], consumerDirectory)

	const installedPackage = path.join(consumerDirectory, 'node_modules', 'tungolcraft')
	const files = listFiles(installedPackage)
	for (const expected of [
		'LICENSE',
		'dist/index.js',
		'dist/index.d.ts',
		'benchmarks/fixtures.json',
		'docs/VALIDATION.md',
		'docs/MODEL-REFERENCE.md',
		'docs/UNCERTAINTY.md',
		'docs/MODEL-PACKS.md',
		'docs/EXTERNAL-ADAPTERS.md',
		'schemas/scenario.schema.json',
		'schemas/scenario-report.schema.json',
		'schemas/external-run-request.schema.json',
		'schemas/external-run-result.schema.json',
	]) {
		assert.ok(files.includes(expected), `Packed package is missing ${expected}`)
	}
	assert.ok(!files.some(file => file.startsWith('src/')))
	assert.ok(!files.some(file => file.endsWith('.test.ts')))

	writeFileSync(
		path.join(consumerDirectory, 'runtime.mjs'),
		[
			`import { readFileSync } from 'node:fs'`,
			`import { au, computeOrbitalPeriodDays, EXTERNAL_RUN_SCHEMA_VERSION, getModelPack, NOMINAL_SOLAR_GM, propagateCatalogueUncertainty, SCENARIO_SCHEMA_VERSION } from 'tungolcraft'`,
			'const period = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			`if (!(period > 365 && period < 366)) throw new Error(\`Unexpected period: \${period}\`)`,
			`const propagated = propagateCatalogueUncertainty({ modelId: 'body.rotational-breakup', inputs: { densityKgM3: { value: 5500, unit: 'kg/m^3', source: 'caller', uncertainty: { kind: 'standard-deviation', value: 50, unit: 'kg/m^3' } } } }, { method: 'monte-carlo', seed: 42, sampleCount: 8, samplingPolicy: 'normal' })`,
			`if (!propagated.ok || propagated.uncertainty.kind !== 'propagated') throw new Error('Uncertainty export failed')`,
			`if (getModelPack('rocky-interiors')?.modelIds[0] !== 'planet.zeng-2016-rocky-radius') throw new Error('Model-pack export failed')`,
			`const schemaUrl = import.meta.resolve('tungolcraft/schemas/scenario.schema.json')`,
			`const schema = JSON.parse(readFileSync(new URL(schemaUrl), 'utf8'))`,
			`if (schema.properties.schemaVersion.const !== SCENARIO_SCHEMA_VERSION) throw new Error('Scenario schema version mismatch')`,
			`const externalSchemaUrl = import.meta.resolve('tungolcraft/schemas/external-run-request.schema.json')`,
			`const externalSchema = JSON.parse(readFileSync(new URL(externalSchemaUrl), 'utf8'))`,
			`if (!externalSchema.$defs || EXTERNAL_RUN_SCHEMA_VERSION !== '1.0.0') throw new Error('External adapter schema export failed')`,
			'',
		].join('\n'),
	)
	execFileSync(process.execPath, ['runtime.mjs'], {
		cwd: consumerDirectory,
		stdio: 'inherit',
	})

	writeFileSync(
		path.join(consumerDirectory, 'types.ts'),
		[
			`import { au, computeOrbitalPeriodDays, EXTERNAL_RUN_SCHEMA_VERSION, NOMINAL_SOLAR_GM, SCENARIO_SCHEMA_VERSION, type Days, type ExternalRunRequest, type ScenarioInput } from 'tungolcraft'`,
			'const period: Days = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			'const scenario: ScenarioInput = {',
			'  schemaVersion: SCENARIO_SCHEMA_VERSION,',
			`  time: { epoch: '0', scale: 'model-day', secondsPerDay: 86400 },`,
			'  frames: [],',
			'  bodies: [],',
			'}',
			'void period',
			'void scenario',
			'void EXTERNAL_RUN_SCHEMA_VERSION',
			'void (null as ExternalRunRequest | null)',
			'',
		].join('\n'),
	)
	writeFileSync(
		path.join(consumerDirectory, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				module: 'NodeNext',
				moduleResolution: 'NodeNext',
				noEmit: true,
				strict: true,
				target: 'ES2022',
			},
			include: ['types.ts'],
		}, null, 2),
	)

	const typescriptPackageUrl = import.meta.resolve('typescript/package.json')
	const typescriptPackage = JSON.parse(
		readFileSync(fileURLToPath(typescriptPackageUrl), 'utf8'),
	)
	const tsc = fileURLToPath(new URL(typescriptPackage.bin.tsc, typescriptPackageUrl))
	execFileSync(process.execPath, [tsc, '--project', 'tsconfig.json'], {
		cwd: consumerDirectory,
		stdio: 'inherit',
	})

	console.log(
		`Packed ${filename}; clean Bun runtime import and TypeScript consumer passed.`,
	)
} finally {
	rmSync(temporaryDirectory, { recursive: true, force: true })
}

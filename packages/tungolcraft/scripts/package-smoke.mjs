import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tungolcraft-package-smoke-'))
const packDirectory = path.join(temporaryDirectory, 'pack')
const consumerDirectory = path.join(temporaryDirectory, 'consumer')
const npmCli = process.env.npm_execpath

mkdirSync(packDirectory)
mkdirSync(consumerDirectory)

if (!npmCli) {
	throw new Error('npm_execpath is unavailable; run this check through npm run pack:smoke')
}

function npm(args, cwd) {
	return execFileSync(process.execPath, [npmCli, ...args], {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, npm_config_dry_run: 'false' },
		stdio: ['ignore', 'pipe', 'inherit'],
	})
}

try {
	const packOutput = npm(
		['pack', packageDirectory, '--json', '--pack-destination', packDirectory],
		packageDirectory,
	)
	const packResult = JSON.parse(packOutput)[0]

	assert.equal(packResult.name, 'tungolcraft')
	assert.ok(packResult.files.some(({ path }) => path === 'LICENSE'))
	assert.ok(packResult.files.some(({ path }) => path === 'dist/index.js'))
	assert.ok(packResult.files.some(({ path }) => path === 'dist/index.d.ts'))
	assert.ok(packResult.files.some(({ path }) => path === 'benchmarks/fixtures.json'))
	assert.ok(packResult.files.some(({ path }) => path === 'docs/VALIDATION.md'))
	assert.ok(packResult.files.some(({ path }) => path === 'docs/MODEL-REFERENCE.md'))
	assert.ok(packResult.files.some(({ path }) => path === 'docs/UNCERTAINTY.md'))
	assert.ok(packResult.files.some(({ path }) => path === 'schemas/scenario.schema.json'))
	assert.ok(packResult.files.some(({ path }) => path === 'schemas/scenario-report.schema.json'))
	assert.ok(!packResult.files.some(({ path }) => path.startsWith('src/')))
	assert.ok(!packResult.files.some(({ path }) => path.endsWith('.test.ts')))

	const tarball = path.join(packDirectory, packResult.filename)

	npm(['init', '--yes'], consumerDirectory)
	npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumerDirectory)

	writeFileSync(
		path.join(consumerDirectory, 'runtime.mjs'),
		[
			`import { readFileSync } from 'node:fs'`,
			`import { au, computeOrbitalPeriodDays, NOMINAL_SOLAR_GM, propagateCatalogueUncertainty, SCENARIO_SCHEMA_VERSION } from 'tungolcraft'`,
			'const period = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			`if (!(period > 365 && period < 366)) throw new Error(\`Unexpected period: \${period}\`)`,
			`const propagated = propagateCatalogueUncertainty({ modelId: 'body.rotational-breakup', inputs: { densityKgM3: { value: 5500, unit: 'kg/m^3', source: 'caller', uncertainty: { kind: 'standard-deviation', value: 50, unit: 'kg/m^3' } } } }, { method: 'monte-carlo', seed: 42, sampleCount: 8, samplingPolicy: 'normal' })`,
			`if (!propagated.ok || propagated.uncertainty.kind !== 'propagated') throw new Error('Uncertainty export failed')`,
			`const schemaUrl = import.meta.resolve('tungolcraft/schemas/scenario.schema.json')`,
			`const schema = JSON.parse(readFileSync(new URL(schemaUrl), 'utf8'))`,
			`if (schema.properties.schemaVersion.const !== SCENARIO_SCHEMA_VERSION) throw new Error('Scenario schema version mismatch')`,
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
			`import { au, computeOrbitalPeriodDays, NOMINAL_SOLAR_GM, SCENARIO_SCHEMA_VERSION, type Days, type ScenarioInput } from 'tungolcraft'`,
			'const period: Days = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			'const scenario: ScenarioInput = {',
			'  schemaVersion: SCENARIO_SCHEMA_VERSION,',
			`  time: { epoch: '0', scale: 'model-day', secondsPerDay: 86400 },`,
			'  frames: [],',
			'  bodies: [],',
			'}',
			'void period',
			'void scenario',
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
		`Packed ${packResult.filename}; clean runtime import and TypeScript consumer passed.`,
	)
} finally {
	rmSync(temporaryDirectory, { recursive: true, force: true })
}

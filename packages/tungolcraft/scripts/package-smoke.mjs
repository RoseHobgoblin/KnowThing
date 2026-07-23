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
	assert.ok(!packResult.files.some(({ path }) => path.startsWith('src/')))
	assert.ok(!packResult.files.some(({ path }) => path.endsWith('.test.ts')))

	const tarball = path.join(packDirectory, packResult.filename)

	npm(['init', '--yes'], consumerDirectory)
	npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], consumerDirectory)

	writeFileSync(
		path.join(consumerDirectory, 'runtime.mjs'),
		[
			`import { au, computeOrbitalPeriodDays, NOMINAL_SOLAR_GM } from 'tungolcraft'`,
			'const period = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			`if (!(period > 365 && period < 366)) throw new Error(\`Unexpected period: \${period}\`)`,
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
			`import { au, computeOrbitalPeriodDays, NOMINAL_SOLAR_GM, type Days } from 'tungolcraft'`,
			'const period: Days = computeOrbitalPeriodDays(au(1), NOMINAL_SOLAR_GM)',
			'void period',
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

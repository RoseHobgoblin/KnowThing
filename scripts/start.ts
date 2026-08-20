/* eslint-disable unicorn/no-process-exit -- production process entrypoint */
import postgres from 'postgres'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createApp, type SvelteKitFetch } from './elysia-app.js'

function requireEnvironment(name: string): string {
	const value = process.env[name]
	if (!value) {
		console.error(`FATAL: ${name} is not set`)
		process.exit(1)
	}
	return value
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
	const parsed = Number.parseInt(value ?? String(fallback), 10)
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		console.error(`FATAL: ${name} must be a positive integer`)
		process.exit(1)
	}
	return parsed
}

async function migrate(databaseUrl: string) {
	const sql = postgres(databaseUrl)

	try {
		await sql`
			CREATE TABLE IF NOT EXISTS _migrations (
				id SERIAL PRIMARY KEY,
				name TEXT UNIQUE NOT NULL,
				applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`

		const migrationsDirectory = path.join(import.meta.dirname, '..', 'drizzle')
		const files = readdirSync(migrationsDirectory)
			.filter(file => file.endsWith('.sql') && file !== '0000_flat_speedball.sql')
			.toSorted()

		for (const file of files) {
			const migrationSql = readFileSync(path.join(migrationsDirectory, file), 'utf8')
			const applied = await sql.begin(async (transaction) => {
				await transaction`SELECT pg_advisory_xact_lock(hashtext('knowthing:migrations'))`
				const [existing] = await transaction`SELECT name FROM _migrations WHERE name = ${file}`
				if (existing) return false

				await transaction.unsafe(migrationSql)
				await transaction`INSERT INTO _migrations (name) VALUES (${file})`
				return true
			})
			console.log(applied ? `  applied: ${file}` : `  skip: ${file} (already applied)`)
		}

		console.log('Migrations complete.')
	} finally {
		await sql.end()
	}
}

async function main() {
	const databaseUrl = requireEnvironment('DATABASE_URL')
	requireEnvironment('BETTER_AUTH_SECRET')
	if (!process.env.BETTER_AUTH_URL && !process.env.ORIGIN) {
		console.error('FATAL: BETTER_AUTH_URL or ORIGIN must be set to the public application URL')
		process.exit(1)
	}

	process.env.UPLOAD_DIR ||= './uploads'
	const port = parsePositiveInteger(process.env.PORT, 3000, 'PORT')
	const bodySizeLimit = parsePositiveInteger(
		process.env.BODY_SIZE_LIMIT,
		512 * 1024,
		'BODY_SIZE_LIMIT',
	)

	console.log('KnowThing starting on Bun + Elysia...')
	console.log(`Database: ${databaseUrl.replace(/:[^@]+@/, ':***@')}`)
	console.log(`Uploads:  ${process.env.UPLOAD_DIR}`)
	await migrate(databaseUrl)

	const { getHandler } = await import('../build/handler.js')
	const { fetch: svelteKitFetch } = getHandler() as { fetch: SvelteKitFetch }
	const app = createApp(svelteKitFetch).listen({
		hostname: process.env.HOST ?? '0.0.0.0',
		port,
		maxRequestBodySize: bodySizeLimit,
	})

	console.log(`KnowThing running at http://${app.server?.hostname}:${app.server?.port}`)

	async function shutdown(signal: NodeJS.Signals) {
		console.log(`Stopping KnowThing after ${signal}...`)
		process.emit('sveltekit:shutdown', signal)
		await app.server?.stop(true)
	}
	process.once('SIGINT', shutdown)
	process.once('SIGTERM', shutdown)
}

await main()

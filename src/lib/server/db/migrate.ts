/* eslint-disable local/no-console-server, unicorn/no-process-exit -- standalone migration CLI */
import postgres from 'postgres'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

async function migrate() {
	const url = process.env.DATABASE_URL
	if (!url) {
		console.error('DATABASE_URL not set')
		process.exit(1)
	}

	const sql = postgres(url)

	// Create migrations tracking table
	await sql`
		CREATE TABLE IF NOT EXISTS _migrations (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`

	// Auto-discover all .sql migration files, sorted by name
	const migrationsDirectory = path.join(currentDirectory, '../../../../drizzle')
	const files = readdirSync(migrationsDirectory)
		// 0000 is Drizzle Kit's schema snapshot, not part of the app's
		// historical hand-written migration chain (0001+).
		.filter(f => f.endsWith('.sql') && f !== '0000_flat_speedball.sql')
		.toSorted()

	for (const migrationFile of files) {
		const migrationSql = readFileSync(path.join(migrationsDirectory, migrationFile), 'utf8')
		const applied = await sql.begin(async (tx) => {
			await tx`SELECT pg_advisory_xact_lock(hashtext('knowthing:migrations'))`
			const [existing] = await tx`SELECT name FROM _migrations WHERE name = ${migrationFile}`
			if (existing) return false

			await tx.unsafe(migrationSql)
			await tx`INSERT INTO _migrations (name) VALUES (${migrationFile})`
			return true
		})

		if (applied) {
			console.log(`  apply: ${migrationFile}`)
		} else {
			console.log(`  skip: ${migrationFile} (already applied)`)
		}
	}

	await sql.end()
	console.log('Migrations complete.')
}

try {
	await migrate()
} catch (error) {
	console.error('Migration failed:', error)
	process.exit(1)
}

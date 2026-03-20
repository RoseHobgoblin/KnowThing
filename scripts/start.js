import postgres from 'postgres'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error('FATAL: DATABASE_URL is not set')
	process.exit(1)
}

// ── Run migrations ──────────────────────────────────────────
async function migrate() {
	const sql = postgres(DATABASE_URL)

	try {
		// Create migrations tracking table
		await sql`
			CREATE TABLE IF NOT EXISTS _migrations (
				id SERIAL PRIMARY KEY,
				name TEXT UNIQUE NOT NULL,
				applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`

		// Read migration files
		const migrationsDir = join(import.meta.dirname, '..', 'drizzle')
		const files = readdirSync(migrationsDir)
			.filter(f => f.endsWith('.sql'))
			.sort()

		for (const file of files) {
			const [applied] = await sql`SELECT name FROM _migrations WHERE name = ${file}`
			if (applied) {
				console.log(`  skip: ${file} (already applied)`)
				continue
			}

			const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8')
			await sql.unsafe(migrationSql)
			await sql`INSERT INTO _migrations (name) VALUES (${file})`
			console.log(`  applied: ${file}`)
		}

		await sql.end()
		console.log('Migrations complete.')
	} catch (error) {
		console.error('Migration failed:', error.message)
		// Don't exit — table might already exist from a previous run
		try { await sql.end() } catch {}
	}
}

// ── Validate environment ────────────────────────────────────
function validateEnvironment() {
	const required = ['DATABASE_URL']
	const missing = required.filter(k => !process.env[k])
	if (missing.length > 0) {
		console.error(`FATAL: Missing required env vars: ${missing.join(', ')}`)
		process.exit(1)
	}

	if (!process.env.UPLOAD_DIR) {
		process.env.UPLOAD_DIR = './uploads'
	}

	console.log(`Database: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`)
	console.log(`Uploads:  ${process.env.UPLOAD_DIR}`)
	console.log(`Port:     ${process.env.PORT || 3000}`)
}

// ── Start ───────────────────────────────────────────────────
async function main() {
	console.log('KnowThing starting...')
	validateEnvironment()
	await migrate()

	// Import and start the SvelteKit server
	const { handler } = await import('../build/handler.js')
	const { createServer } = await import('node:http')

	const port = Number.parseInt(process.env.PORT || '3000')
	const server = createServer(handler)

	server.listen(port, '0.0.0.0', () => {
		console.log(`KnowThing running on http://0.0.0.0:${port}`)
	})
}

main()

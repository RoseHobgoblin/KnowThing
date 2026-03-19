import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('DATABASE_URL not set');
		process.exit(1);
	}

	const sql = postgres(url);

	// Create migrations tracking table
	await sql`
		CREATE TABLE IF NOT EXISTS _migrations (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	// Read and apply migrations
	const migrationsDir = join(__dirname, '../../../../drizzle');
	const migrationFile = '0001_initial.sql';

	const applied = await sql`SELECT name FROM _migrations WHERE name = ${migrationFile}`;
	if (applied.length === 0) {
		const migrationSql = readFileSync(join(migrationsDir, migrationFile), 'utf-8');
		await sql.unsafe(migrationSql);
		await sql`INSERT INTO _migrations (name) VALUES (${migrationFile})`;
		console.log(`Applied migration: ${migrationFile}`);
	} else {
		console.log(`Migration already applied: ${migrationFile}`);
	}

	await sql.end();
	console.log('Migrations complete.');
}

migrate().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});

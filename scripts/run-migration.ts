import postgres from 'postgres'
import { readFileSync } from 'fs'

const sql = postgres('postgres://knowthing:knowthing@localhost:5432/knowthing')
const migration = readFileSync('drizzle/0023_celestial_numeric_fields.sql', 'utf-8')
await sql.unsafe(migration)
console.log('Migration applied successfully')
await sql.end()

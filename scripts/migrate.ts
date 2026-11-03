import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { readMigrationFiles } from 'drizzle-orm/migrator'

try {
  if (!process.env.NEON_PG_DB_URL) throw new Error('Missing connection')
  const sql = neon(process.env.NEON_PG_DB_URL)
  await sql`CREATE SCHEMA IF NOT EXISTS pocket_migrations`
  await sql`CREATE TABLE IF NOT EXISTS pocket_migrations.journal (hash text PRIMARY KEY, created_at bigint NOT NULL)`
  const applied = await sql`SELECT hash FROM pocket_migrations.journal`
  const hashes = new Set(applied.map(row => row.hash))
  for (const migration of readMigrationFiles({ migrationsFolder: './drizzle' })) {
    if (hashes.has(migration.hash)) continue
    await sql.transaction([
      ...migration.sql.map(statement => sql.query(statement)),
      sql`INSERT INTO pocket_migrations.journal (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
    ])
  }
  console.log('Pocket migrations applied.')
} catch {
  console.error('Migration failed. Check the database connection and migration files.')
  process.exitCode = 1
}

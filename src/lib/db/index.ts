import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let database: ReturnType<typeof createDatabase> | undefined
function createDatabase() {
  const url = process.env.NEON_PG_DB_URL
  if (!url) throw new Error('NEON_PG_DB_URL is not configured.')
  return drizzle(neon(url), { schema })
}
export function getDb() { return database ??= createDatabase() }

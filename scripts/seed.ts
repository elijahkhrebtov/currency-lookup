import 'dotenv/config'
import { parse } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { accounts, entries } from '../src/lib/db/schema'
import { hashSecret } from '../src/lib/password'
import { entrySchema } from '../src/lib/validation'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001'
const args = process.argv.slice(2)
function option(name: string) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
try {
  if (!process.env.NEON_PG_DB_URL) throw new Error('Missing connection')
  const db = drizzle(neon(process.env.NEON_PG_DB_URL))
  // Validate the entire dump before any writes. Imports never overwrite existing rows.
  const dumpPath = option('--budget-file')
  const imported = dumpPath ? JSON.parse(await readFile(dumpPath, 'utf8')) : null
  const list = imported ? (Array.isArray(imported) ? imported : imported.entries) : []
  if (!Array.isArray(list)) throw new Error('Invalid dump')
  const validated = list.map(row => entrySchema.parse(row))
  const [account] = await db.select().from(accounts).where(eq(accounts.id, ACCOUNT_ID))
  if (!account) {
    let secretHash: string
    const caltrackEnvFile = option('--cal-track-env')
    if (caltrackEnvFile) {
      // The live account is authoritative; its plaintext key file may be stale.
      const sourceEnv = parse(await readFile(caltrackEnvFile, 'utf8'))
      if (!sourceEnv.NEON_PG_CONNECTION_STRING) throw new Error('Missing source connection')
      const source = neon(sourceEnv.NEON_PG_CONNECTION_STRING)
      const [account] = await source`select secret_hash from accounts where id = ${ACCOUNT_ID}`
      if (!account || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(account.secret_hash)) throw new Error('Invalid source account')
      secretHash = account.secret_hash
    } else {
      const secretFile = option('--secret-file') ?? 'app-login-secret'
      const secret = process.env.APP_LOGIN_SECRET?.trim() || (await readFile(secretFile, 'utf8')).trim()
      if (!secret || secret.length > 2048) throw new Error('Invalid secret')
      secretHash = await hashSecret(secret)
    }
    await db.insert(accounts).values({ id: ACCOUNT_ID, secretHash }).onConflictDoNothing()
  }
  let count = 0
  if (validated.length) {
    const inserted = await db.insert(entries).values(validated.map(entry => ({ ...entry, accountId: ACCOUNT_ID }))).onConflictDoNothing().returning({ id: entries.id })
    count = inserted.length
  }
  console.log(`Account initialized. Imported ${count} of ${validated.length} entries; existing data preserved.`)
} catch {
  console.error('Initialization failed. Check the database, source account or secret file, and budget dump. No credentials were logged.')
  process.exitCode = 1
}

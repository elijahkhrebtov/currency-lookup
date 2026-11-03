import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { test, expect } from '@playwright/test'
import { accounts, sessions, entries } from '../src/lib/db/schema'
import { entrySchema } from '../src/lib/validation'
import { verifySecret } from '../src/lib/password'

const db = drizzle(neon(process.env.NEON_PG_DB_URL))
test('the imported budget dump is preserved exactly in the database', async () => {
  test.skip(!existsSync('budget-entries-2026-11-03.json'), 'The private migration dump is not part of the repository.')
  const dump = JSON.parse(await readFile('budget-entries-2026-11-03.json', 'utf8'))
  const stored = await db.select().from(entries).where(eq(entries.accountId, '00000000-0000-4000-8000-000000000001'))
  const byId = new Map(stored.map(({ accountId: _account, ...entry }) => [entry.id, entry]))
  for (const entry of dump.entries) expect(byId.get(entry.id)).toEqual(entrySchema.parse(entry))
})
test('the cal-track key signs in with a durable cookie, and logout revokes it', async ({ request }) => {
  expect((await request.get('/api/budget')).status()).toBe(401)
  expect((await request.post('/api/auth/login', { headers: { Origin: 'https://unrelated.example' }, data: { secret: 'invalid' } })).status()).toBe(403)
  expect((await request.post('/api/auth/login', { data: { secret: 'invalid' } })).status()).toBe(401)
  const secret = process.env.APP_LOGIN_SECRET?.trim() || (await readFile('../cal-track/app-login-secret', 'utf8')).trim()
  const [account] = await db.select().from(accounts).where(eq(accounts.id, '00000000-0000-4000-8000-000000000001'))
  test.skip(!account || !(await verifySecret(secret, account.secretHash)), 'Set APP_LOGIN_SECRET to the live account key; the local key file may be stale.')
  expect((await request.post('/api/auth/login', { data: { secret } })).status()).toBe(200)
  const cookie = (await request.storageState()).cookies.find(cookie => cookie.name === 'pocket_session')
  expect(cookie.httpOnly).toBe(true)
  expect(cookie.secure).toBe(true)
  expect(cookie.sameSite).toBe('Lax')
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 390 * 86400)
  expect((await request.get('/api/auth/session')).status()).toBe(200)
  expect((await request.get('/api/budget')).headers()['cache-control']).toContain('no-store')
  expect((await request.post('/api/auth/logout')).status()).toBe(200)
  expect((await request.get('/api/budget')).status()).toBe(401)
})

test('database CRUD is account scoped, validated, and renews an active session', async ({ context }) => {
  const accountId = `test-${randomUUID()}`
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.insert(accounts).values({ id: accountId, secretHash: 'test-only-no-login' })
  try {
    await db.insert(sessions).values({ accountId, tokenHash, expiresAt: new Date(Date.now() + 86400000), renewedAt: new Date(Date.now() - 8 * 86400000) })
    await context.addCookies([{ name: 'pocket_session', value: token, url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' }])
    const api = context.request
    const first = await api.get('/api/budget')
    expect(first.status()).toBe(200)
    expect((await first.json()).entries).toEqual([])
    const [renewed] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash))
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 390 * 86400000)
    const entry = { id: 'isolated-entry', description: 'Test', kind: 'income', date: '2026-11-03', recurrence: 'once', amountCents: 12345, createdAt: Date.now() }
    expect((await api.put('/api/budget', { data: entry })).status()).toBe(200)
    expect((await api.put('/api/budget', { data: { ...entry, amountCents: -1 } })).status()).toBe(400)
    expect((await api.put('/api/budget', { data: { ...entry, date: '2026-02-30' } })).status()).toBe(400)
    const currencies = { currencies: ['UZS', 'EUR', 'USD'], source: 'EUR', amount: '123.12345678' }
    expect((await api.put('/api/currencies', { data: currencies })).status()).toBe(200)
    expect(await (await api.get('/api/currencies')).json()).toEqual(currencies)
    expect((await api.put('/api/budget/settings', { data: { savingsThreshold: 100000, throughDate: true } })).status()).toBe(200)
    const saved = await (await api.get('/api/budget')).json()
    expect(saved.entries).toHaveLength(1)
    expect(saved.entries[0].amountCents).toBe(12345)
    expect(saved.savingsThreshold).toBe(100000)
    // A legacy browser must never overwrite an existing database threshold.
    expect((await api.post('/api/budget/settings', { data: { savingsThreshold: 200000, throughDate: false } })).status()).toBe(200)
    expect((await (await api.get('/api/budget')).json()).savingsThreshold).toBe(100000)
    const adjustment = { ...entry, id: 'adjustment', adjustment: true, amountCents: 0 }
    expect((await api.put('/api/budget', { data: adjustment })).status()).toBe(200)
    expect((await api.put('/api/budget', { data: { ...adjustment, amountCents: 1 } })).status()).toBe(409)
    expect((await api.delete('/api/budget', { data: { id: entry.id } })).status()).toBe(200)
    expect((await api.delete('/api/budget', { data: { id: adjustment.id } })).status()).toBe(200)
    expect((await (await api.get('/api/budget')).json()).entries).toHaveLength(0)
  } finally { await db.delete(accounts).where(eq(accounts.id, accountId)) }
})

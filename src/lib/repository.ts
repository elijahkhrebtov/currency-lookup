import 'server-only'
import { and, eq } from 'drizzle-orm'
import { getDb } from './db'
import { entries, budgetSettings, currencySettings, rateCache } from './db/schema'
import { DEFAULT_SETTINGS, DAY, parseRates } from '../currency'
import type { Entry, CurrencySettings } from './validation'
import { ratesSchema } from './validation'
import { HttpError } from './http'

export async function getBudget(accountId: string) {
  const [rows, [settings]] = await Promise.all([
    getDb().select().from(entries).where(eq(entries.accountId, accountId)),
    getDb().select().from(budgetSettings).where(eq(budgetSettings.accountId, accountId)),
  ])
  return {
    entries: rows.map(({ accountId: _account, ...entry }) => entry),
    savingsThreshold: settings?.savingsThreshold ?? null,
    throughDate: settings?.throughDate ?? false,
    settingsInitialized: Boolean(settings),
  }
}
export async function saveEntry(accountId: string, entry: Entry) {
  const where = and(eq(entries.accountId, accountId), eq(entries.id, entry.id))
  const [existing] = await getDb().select().from(entries).where(where)
  if (existing?.adjustment) throw new HttpError(409, 'Adjustments can only be deleted.')
  const [saved] = await getDb().insert(entries).values({ ...entry, accountId }).onConflictDoUpdate({
    target: [entries.accountId, entries.id],
    set: { ...entry, createdAt: existing?.createdAt ?? entry.createdAt },
    setWhere: eq(entries.adjustment, false),
  }).returning()
  if (!saved) throw new HttpError(409, 'Adjustments can only be deleted.')
  const { accountId: _account, ...result } = saved
  return result
}
export async function removeEntry(accountId: string, id: string) {
  await getDb().delete(entries).where(and(eq(entries.accountId, accountId), eq(entries.id, id)))
}
export async function saveBudgetSettings(accountId: string, settings: { savingsThreshold: number | null; throughDate: boolean }) {
  await getDb().insert(budgetSettings).values({ accountId, ...settings }).onConflictDoUpdate({ target: budgetSettings.accountId, set: settings })
  return settings
}
export async function initializeBudgetSettings(accountId: string, settings: { savingsThreshold: number | null; throughDate: boolean }) {
  await getDb().insert(budgetSettings).values({ accountId, ...settings }).onConflictDoNothing()
  const [saved] = await getDb().select().from(budgetSettings).where(eq(budgetSettings.accountId, accountId))
  return { savingsThreshold: saved.savingsThreshold, throughDate: saved.throughDate }
}
export async function getCurrencySettings(accountId: string) {
  const [row] = await getDb().select().from(currencySettings).where(eq(currencySettings.accountId, accountId))
  return row?.settings ?? DEFAULT_SETTINGS
}
export async function saveCurrencySettings(accountId: string, settings: CurrencySettings) {
  await getDb().insert(currencySettings).values({ accountId, settings }).onConflictDoUpdate({ target: currencySettings.accountId, set: { settings } })
  return settings
}
export async function getRates(force: boolean) {
  const [cached] = await getDb().select().from(rateCache).where(eq(rateCache.id, 'USD'))
  if (!force && cached && Date.now() - cached.data.fetchedAt < DAY) return cached.data
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD', { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error('Rates unavailable')
    const data = ratesSchema.parse(parseRates(await response.json()))
    await getDb().insert(rateCache).values({ id: 'USD', data }).onConflictDoUpdate({ target: rateCache.id, set: { data } })
    return data
  } catch {
    if (cached && !force) return cached.data
    throw new HttpError(502, 'Could not refresh rates. Please try again.')
  }
}

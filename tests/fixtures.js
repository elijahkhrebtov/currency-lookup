import { test as base, expect } from '@playwright/test'
import { DEFAULT_SETTINGS } from '../src/currency'
const stores = new WeakMap()

export const test = base.extend({
  page: async ({ page }, provide) => {
    const state = { entries: [], savingsThreshold: null, throughDate: false, currencies: structuredClone(DEFAULT_SETTINGS), currencyReads: 0, currencyWrites: 0 }
    stores.set(page, state)
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      const data = method === 'GET' ? null : route.request().postDataJSON()
      if (path === '/api/auth/session') return route.fulfill({ json: { authenticated: true } })
      if (path === '/api/budget/settings') {
        Object.assign(state, data)
        return route.fulfill({ json: data })
      }
      if (path === '/api/budget') {
        if (method === 'PUT') {
          const index = state.entries.findIndex(entry => entry.id === data.id)
          if (index < 0) state.entries.push(data)
          else state.entries[index] = data
          return route.fulfill({ json: data })
        }
        if (method === 'DELETE') state.entries = state.entries.filter(entry => entry.id !== data.id)
        return route.fulfill({ json: { entries: state.entries, savingsThreshold: state.savingsThreshold, throughDate: state.throughDate } })
      }
      if (path === '/api/currencies') {
        if (method === 'PUT') { state.currencies = data; state.currencyWrites++ }
        else state.currencyReads++
        return route.fulfill({ json: state.currencies })
      }
      if (path === '/api/rates') return route.fulfill({ json: { rates: { USD: 1, EUR: .9 }, dates: { EUR: '2026-10-11' }, fetchedAt: await page.evaluate(() => Date.now()) } })
      return route.fulfill({ status: 404, json: { error: 'Unknown test route' } })
    })
    await provide(page)
  },
})
export { expect }
export function store(page) { return stores.get(page) }
export async function seedBudget(page, entries) {
  const state = store(page)
  const byId = new Map(state.entries.map(entry => [entry.id, entry]))
  for (const entry of entries) byId.set(entry.id, entry)
  state.entries = [...byId.values()]
  await page.reload()
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeEnabled()
}
export async function rateData(page, rows) {
  return { rates: { USD: 1, ...Object.fromEntries(rows.map(row => [row.quote, row.rate])) }, dates: Object.fromEntries(rows.map(row => [row.quote, row.date])), fetchedAt: await page.evaluate(() => Date.now()) }
}

export async function openConverter(page) {
  await page.getByRole('button', { name: 'Open sidebar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Tools', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Converter', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Converter', exact: true })).toHaveAttribute('aria-selected', 'true')
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entrySchema, currencySettingsSchema, budgetSettingsSchema } from '../../src/lib/validation'
import { hashSecret, verifySecret } from '../../src/lib/password'
import { appliesOn, calculateBudget, adjustmentValues, balanceLevel } from '../../src/budget/model.js'

const entry = { id: 'entry', description: 'Rent', date: '2026-01-31', amountCents: 10000, kind: 'expense', recurrence: 'monthly', createdAt: 1 }
test('entry validation preserves schedules and rejects invalid financial data', () => {
  assert.equal(entrySchema.parse(entry).recurrence, 'monthly')
  for (const changes of [{ amountCents: -1 }, { amountCents: 0 }, { amountCents: 1.5 }, { amountCents: Number.MAX_SAFE_INTEGER + 1 }, { date: '2026-02-30' }, { adjustment: true }, { adjustment: true, recurrence: 'once', disabled: true }]) {
    assert.equal(entrySchema.safeParse({ ...entry, ...changes }).success, false)
  }
  assert.equal(entrySchema.safeParse({ ...entry, adjustment: true, recurrence: 'once', amountCents: 0 }).success, true)
})
test('currency settings preserve order and precision and reject duplicates or missing sources', () => {
  const settings = { currencies: ['EUR', 'USD'], source: 'EUR', amount: '1234567.89123456' }
  assert.deepEqual(currencySettingsSchema.parse(settings), settings)
  assert.equal(currencySettingsSchema.safeParse({ ...settings, currencies: ['USD', 'USD'] }).success, false)
  assert.equal(currencySettingsSchema.safeParse({ ...settings, source: 'GBP' }).success, false)
  assert.equal(budgetSettingsSchema.safeParse({ savingsThreshold: 0, throughDate: false }).success, false)
})
test('secret hashes are salted and verify the original key', async () => {
  const first = await hashSecret('test-only-key')
  assert.notEqual(first, await hashSecret('test-only-key'))
  assert.equal(await verifySecret('test-only-key', first), true)
  assert.equal(await verifySecret('wrong-key', first), false)
})
test('month end schedules and fixed balance corrections retain cent precision', () => {
  assert.equal(appliesOn(entry, '2026-02-28'), true)
  const stats = calculateBudget([entry], '2026-01-31', '2026-03-31', '2026-02-28')
  assert.equal(stats.net, -20000)
  assert.equal(adjustmentValues(10025, stats.net, '2026-02-28').amountCents, 30025)
  assert.equal(balanceLevel(5000, 10000), 'balance-danger')
})

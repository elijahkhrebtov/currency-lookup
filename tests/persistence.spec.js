import { test, expect, store, openConverter } from './fixtures'
const SETTINGS = 'pocket-currency.settings.v1'

test('login screen reports an invalid key and signs in and out successfully', async ({ page }, testInfo) => {
  let authenticated = false
  await page.route('**/api/auth/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/session')) return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? { authenticated: true } : { error: 'Sign in to continue.' } })
    if (path.endsWith('/logout')) { authenticated = false; return route.fulfill({ json: { ok: true } }) }
    if (route.request().postDataJSON().secret !== 'test-only-key') return route.fulfill({ status: 401, json: { error: 'Invalid secret.' } })
    authenticated = true
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Converter & Budget' })).toBeVisible()
  await page.screenshot({ path: `/tmp/currency-next-${testInfo.project.name}-login.png` })
  await page.getByLabel('Secret key').fill('wrong-key')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.login-card [role=alert]')).toHaveText('Invalid secret.')
  await page.getByLabel('Secret key').fill('test-only-key')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByLabel('Secret key')).toHaveValue('')
  await page.getByLabel('Secret key').fill('test-only-key')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.route('**/api/budget', route => {
    authenticated = false
    return route.fulfill({ status: 401, json: { error: 'Your session expired. Sign in again.' } })
  })
  await page.reload()
  await expect(page.getByLabel('Secret key')).toHaveValue('')
})

test('cached currency choices avoid reads; order and edits sync and recover after clearing cache', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await openConverter(page)
  await expect(page.getByLabel('USD amount')).toHaveValue('100')
  expect(store(page).currencyReads).toBe(1)
  await page.getByLabel('Move EUR up').click()
  await page.getByLabel('USD amount').fill('321.12345678')
  await expect.poll(() => store(page).currencies.currencies[0]).toBe('EUR')
  await expect.poll(() => store(page).currencies.amount).toBe('321.12345678')
  await page.reload()
  await openConverter(page)
  await expect(page.getByLabel('USD amount')).toHaveValue('321.12345678')
  expect(store(page).currencyReads).toBe(1)
  await page.evaluate(key => localStorage.removeItem(key), SETTINGS)
  await page.reload()
  await openConverter(page)
  await expect(page.getByLabel('USD amount')).toHaveValue('321.12345678')
  await expect(page.locator('.currency-code').first()).toHaveText('EUR')
  expect(store(page).currencyReads).toBe(2)
  await page.screenshot({ path: `/tmp/currency-next-${testInfo.project.name}-converter.png` })
})

test('failed currency sync retains local changes and retries the newest value', async ({ page }) => {
  await page.goto('/')
  await openConverter(page)
  await expect(page.getByLabel('USD amount')).toBeVisible()
  await page.route('**/api/currencies', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } }))
  await page.getByLabel('USD amount').fill('77')
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Sync failed')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).amount, SETTINGS)).toBe('77')
  await page.unroute('**/api/currencies')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect.poll(() => store(page).currencies.amount).toBe('77')
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0)
})

test('budget loads only from the server and shows skeletons without false totals', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 })
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/api/budget', async route => {
    await gate
    return route.fulfill({ json: { entries: [], savingsThreshold: 250000, throughDate: false } })
  })
  await page.goto('/')
  await expect(page.getByLabel('Loading budget')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0)
  await page.screenshot({ path: `/tmp/currency-next-${testInfo.project.name}-loading.png` })
  const before = await page.locator('.budget-toolbar').boundingBox()
  release()
  await expect(page.getByLabel('Current savings threshold')).toHaveText('2,500.00')
  const after = await page.locator('.budget-toolbar').boundingBox()
  expect(after.y).toBe(before.y)
  await page.screenshot({ path: `/tmp/currency-next-${testInfo.project.name}-budget.png` })
})

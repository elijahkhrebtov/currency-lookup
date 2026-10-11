import { test, expect } from '@playwright/test'
import { adjustmentValues, appliesOn, balanceLevel, calculateBudget, calendarDays, calendarMoney, calendarRange, localToday, monthsInRange } from '../src/budget/model'

const TODAY = '2026-10-11'
const SAVINGS_THRESHOLD_KEY = 'budget.savings-threshold.v1'
const entry = (id, overrides = {}) => ({ id, description: id, date: TODAY, amountCents: 10000, kind: 'expense', recurrence: 'once', createdAt: 1, ...overrides })

async function openBudget(page) {
  await page.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'))
  await page.route('https://api.frankfurter.dev/**', (route) => route.fulfill({ json: [{ base: 'USD', quote: 'EUR', rate: 0.9, date: TODAY }] }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeEnabled()
}

async function importEntries(page, entries, wrapped = true) {
  await page.getByLabel('Import entries').setInputFiles({ name: 'budget.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wrapped ? { version: 1, exportedAt: new Date().toISOString(), entries } : entries)) })
}

async function touchDrag(session, x, y, distance, steps = 10) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let step = 1; step <= steps; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + distance * step / steps }] })
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('sheet follows a touch drag, snaps back on short drags, and swipes closed without saving', async ({ page, context }) => {
  await openBudget(page)
  const trigger = page.getByRole('button', { name: 'New entry', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await dialog.getByLabel('Description').fill('Unsaved')
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const handle = await dialog.locator('.sheet-handle').boundingBox()
  const x = handle.x + handle.width / 2
  const y = handle.y + handle.height / 2
  const initialBounds = await dialog.boundingBox()
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 25 }] })
  await expect(dialog).toHaveAttribute('data-dragging', 'true')
  expect((await dialog.boundingBox()).y).toBeGreaterThan(initialBounds.y + 10)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(async () => Math.abs((await dialog.boundingBox()).y - initialBounds.y)).toBeLessThan(1)
  await expect(dialog.getByLabel('Description')).toHaveValue('Unsaved')
  await touchDrag(session, x, y, -60)
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await touchDrag(session, x, y, 150)
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(0)
  await session.detach()
})

test('sheet form scrolls independently of the swipe handle on a short phone', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 480 })
  await openBudget(page)
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('data-state', 'open')
  const content = dialog.locator('.sheet-content')
  const bounds = await content.boundingBox()
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await touchDrag(session, bounds.x + 8, bounds.y + bounds.height - 30, -120)
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await touchDrag(session, bounds.x + 8, bounds.y + 20, 80)
  await expect(dialog).toHaveAttribute('data-state', 'open')
  const handle = await dialog.locator('.sheet-handle').boundingBox()
  await touchDrag(session, handle.x + handle.width / 2, handle.y + handle.height / 2, 150)
  await expect(dialog).toHaveCount(0)
  await session.detach()
})

test('close button, backdrop and Escape dismiss the sheet, including with reduced motion', async ({ page }) => {
  await openBudget(page)
  for (const action of ['button', 'backdrop', 'escape']) {
    await page.getByRole('button', { name: 'New entry', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('data-state', 'open')
    if (action === 'button') {
      await dialog.getByRole('button', { name: 'Close dialog' }).click()
      await expect(dialog).toHaveAttribute('data-state', 'closing')
    } else if (action === 'backdrop') await page.mouse.click(10, 10)
    else await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeFocused()
  expect(await dialog.evaluate((element) => element.getAnimations().some((animation) => animation.playState === 'running'))).toBe(false)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('recurrences, month ends, leap days, disabled totals, and calendar horizon retain budget behavior', () => {
  expect(appliesOn(entry('monthly', { date: '2026-01-31', recurrence: 'monthly' }), '2026-02-28')).toBe(true)
  expect(appliesOn(entry('monthly', { date: '2028-01-31', recurrence: 'monthly' }), '2028-02-29')).toBe(true)
  expect(appliesOn(entry('monthly', { date: '2026-01-31', recurrence: 'monthly' }), '2026-02-27')).toBe(false)
  expect(appliesOn(entry('weekly', { recurrence: 'weekly' }), '2026-10-18')).toBe(true)
  expect(appliesOn(entry('weekly', { recurrence: 'weekly' }), '2026-10-17')).toBe(false)
  expect(appliesOn(entry('fortnightly', { recurrence: 'fortnightly' }), '2026-10-25')).toBe(true)
  expect(appliesOn(entry('fortnightly', { recurrence: 'fortnightly' }), '2026-10-18')).toBe(false)
  expect(appliesOn(entry('daily', { recurrence: 'daily' }), '2026-10-10')).toBe(false)
  const stats = calculateBudget([
    entry('income', { kind: 'income', amountCents: 100000 }),
    entry('daily', { recurrence: 'daily', amountCents: 1000 }),
    entry('disabled', { disabled: true, recurrence: 'daily', amountCents: 2000 }),
  ], TODAY, '2026-10-13', '2026-10-12')
  expect(stats.income).toBe(100000)
  expect(stats.expense).toBe(-2000)
  expect(stats.net).toBe(98000)
  expect(stats.cumulative.get('disabled')).toBe(-4000)
  expect(stats.days.get('2026-10-13').total).toBe(97000)
  expect(calendarRange(TODAY).end).toBe('2027-12-31')
  expect(calendarRange(TODAY).calendarStart).toBe('2026-10-01')
  expect(calendarRange('2027-07-14').end).toBe('2028-12-31')
  expect(monthsInRange('2026-09-28', '2027-12-31').at(-1).days).toContain('2027-12-31')
  const days = calendarDays('2026-10-01', '2027-12-31')
  const lastOctober = days.indexOf('2026-10-31')
  expect(days[lastOctober + 1]).toBe('2026-11-01')
  expect(days[lastOctober + 2]).toBe('2026-11-02')
  const date = new Date(2026, 9, 11, 0, 30)
  expect(localToday(date)).toBe(TODAY)
})

test('opens today, adds for the selected day, edits, disables, deletes and remembers the page', async ({ page }) => {
  await openBudget(page)
  await expect(page.getByRole('button', { name: 'Oct 11, 2026', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Oct 12, 2026', exact: true }).click()
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2026-10-12')
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeFocused()
  const bounds = await dialog.boundingBox()
  expect(Math.abs(bounds.y + bounds.height - page.viewportSize().height)).toBeLessThan(2)
  expect(bounds.width).toBe(Math.min(560, page.viewportSize().width))
  await dialog.getByLabel('Amount', { exact: true }).fill('12.50')
  await dialog.getByLabel('Description').fill('Lunch')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit Lunch', exact: true })).toContainText('−12.50')
  await expect(page.locator('.budget-summary')).toContainText('−12.50')
  await page.getByRole('button', { name: 'Edit Lunch', exact: true }).click()
  await dialog.getByLabel('Amount', { exact: true }).fill('15.25')
  await dialog.getByLabel('Repeats').selectOption('daily')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Oct 13, 2026', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Lunch', exact: true })).toContainText('Σ −30.50')
  // Inclusion is persisted before the controlled checkbox updates.
  await page.getByLabel('Include Lunch in calculations').click()
  await expect(page.getByLabel('Include Lunch in calculations')).not.toBeChecked()
  await expect(page.locator('.budget-summary dd').last()).toHaveText('0.00')
  await expect(page.getByRole('button', { name: 'Edit Lunch', exact: true })).toContainText('Σ −30.50')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Budget', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Oct 11, 2026', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Include Lunch in calculations')).not.toBeChecked()
  await page.getByRole('button', { name: 'Edit Lunch', exact: true }).click()
  await page.getByRole('button', { name: 'Delete series', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Lunch', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Converter', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('USD amount')).toBeVisible()
})

test('adjustments reconcile the selected day, stay fixed, and can only be deleted', async ({ page }) => {
  await openBudget(page)
  await importEntries(page, [
    entry('Opening', { kind: 'income', date: '2026-09-28', amountCents: 100000 }),
    entry('Daily', { date: TODAY, recurrence: 'daily', amountCents: 1000 }),
    entry('Selected day', { date: '2026-10-12', amountCents: 3000 }),
    entry('Excluded', { date: '2026-10-12', disabled: true, amountCents: 99999 }),
    entry('Future', { date: '2026-10-13', kind: 'income', amountCents: 100000 }),
  ])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(5)
  await page.getByRole('button', { name: 'Oct 12, 2026', exact: true }).click()
  await page.getByRole('switch').check()
  const net = page.locator('.budget-summary dd').last()
  await expect(net).toHaveText('+950.00')
  const adjustmentName = 'Adjustment on Oct 12, 2026'
  for (const [actual, delta, expectedNet] of [
    ['1000.25', '+50.25', '+1,000.25'],
    ['900.50', '−99.75', '+900.50'],
    ['0', '−900.50', '0.00'],
    ['-25.75', '−25.75', '−25.75'],
    ['-25.75', '0.00', '−25.75'],
  ]) {
    await page.getByRole('button', { name: 'New entry', exact: true }).click()
    const dialog = page.getByRole('dialog')
    // Hidden recurring/date state must not affect an adjustment.
    await dialog.getByLabel('Repeats').selectOption('daily')
    await dialog.getByLabel('Start date').fill('2026-10-20')
    await dialog.getByRole('button', { name: 'Adjustment', exact: true }).click()
    await expect(dialog.locator('input, select')).toHaveCount(1)
    await dialog.getByLabel('Actual balance').fill(actual)
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const row = page.locator('.budget-entry-list li').filter({ has: page.locator('.adjustment-body') }).last()
    await expect(row.locator('.entry-description')).toHaveText(adjustmentName)
    await expect(row.locator('.entry-amount')).toHaveText(delta)
    await expect(row).toHaveClass(/highlight/)
    await expect(row.locator('input')).toHaveCount(0)
    await expect(row.getByRole('button')).toHaveCount(1)
    await row.locator('.entry-body').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(net).toHaveText(expectedNet)
  }
  await page.getByRole('button', { name: 'Oct 13, 2026', exact: true }).click()
  await expect(net).toHaveText('+964.25')
  await expect(page.locator('.budget-entry-list li.highlight .adjustment-body')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Oct 12, 2026', exact: true }).click()
  await expect(net).toHaveText('−25.75')
  await expect(page.getByRole('button', { name: `Edit ${adjustmentName}`, exact: true })).toHaveCount(0)
  const adjustments = page.locator('.budget-entry-list li').filter({ has: page.locator('.adjustment-body') })
  await adjustments.filter({ has: page.locator('.entry-amount', { hasText: /^0\.00$/ }) }).getByRole('button').click()
  await adjustments.filter({ has: page.locator('.entry-amount', { hasText: /^−25\.75$/ }) }).getByRole('button').click()
  await expect(net).toHaveText('0.00')
  await adjustments.filter({ has: page.locator('.entry-amount', { hasText: /^−900\.50$/ }) }).getByRole('button').click()
  await expect(net).toHaveText('+900.50')
})

test('adjustment backups preserve correction metadata and reject recurring adjustments atomically', async ({ page }) => {
  await openBudget(page)
  await importEntries(page, [entry('Opening', { kind: 'income', amountCents: 10000 })])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(1)
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await page.getByRole('button', { name: 'Adjustment', exact: true }).click()
  await page.getByLabel('Actual balance').fill('100')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const stream = await (await downloadPromise).createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks).toString())
  const correction = exported.entries.find((item) => item.adjustment)
  expect(correction).toMatchObject({ description: 'Adjustment on Oct 11, 2026', kind: 'income', amountCents: 0, date: TODAY, recurrence: 'once', adjustment: true })
  await page.getByRole('button', { name: 'Delete Adjustment on Oct 11, 2026', exact: true }).click()
  await expect(page.locator('.adjustment-body')).toHaveCount(0)
  await importEntries(page, exported.entries)
  await expect(page.locator('.adjustment-body')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Edit Adjustment on Oct 11, 2026', exact: true })).toHaveCount(0)
  await importEntries(page, [entry('Should not save'), { ...correction, recurrence: 'daily' }])
  await expect(page.getByRole('alert')).toContainText('invalid or missing "recurrence"')
  await expect(page.getByRole('button', { name: 'Edit Should not save', exact: true })).toHaveCount(0)
  await importEntries(page, [{ ...correction, disabled: true }])
  await expect(page.getByRole('alert')).toContainText('invalid or missing "disabled"')
  await page.reload()
  await expect(page.locator('.adjustment-body')).toHaveCount(1)
})

test('adjustments reject balances and differences outside safe cent precision', () => {
  expect(() => adjustmentValues(Number.MAX_SAFE_INTEGER + 1, 0, TODAY)).toThrow('Enter a valid balance.')
  expect(() => adjustmentValues(Number.MAX_SAFE_INTEGER, -1, TODAY)).toThrow('Enter a valid balance.')
  expect(() => adjustmentValues(0, undefined, TODAY)).toThrow('Enter a valid balance.')
})

test('date switch filters by start date inclusively and occurring entries are highlighted and sorted first', async ({ page }) => {
  await openBudget(page)
  await importEntries(page, [
    entry('Earlier', { date: '2026-10-01' }),
    entry('Future', { date: '2026-10-20' }),
    entry('Today'),
    entry('Recurring', { date: '2026-10-04', recurrence: 'weekly' }),
  ])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(4)
  await expect(page.locator('.budget-entry-list li').nth(0)).toContainText('Recurring')
  await expect(page.locator('.budget-entry-list li').nth(1)).toContainText('Today')
  await expect(page.locator('.budget-entry-list li.highlight')).toHaveCount(2)
  const toggle = page.getByRole('switch', { name: 'Through Oct 11, 2026' })
  await toggle.check()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Edit Future', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit Today', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Oct 20, 2026', exact: true }).click()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(4)
  await expect(page.locator('.budget-entry-list li').first()).toContainText('Future')
  await page.getByRole('switch').uncheck()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(4)
  await expect(page.locator('.budget-entry-list li.highlight')).toHaveCount(2)
})

test('imports old backups and bare arrays, merges by ID, exports every entry, and rejects invalid files atomically', async ({ page }) => {
  await openBudget(page)
  await importEntries(page, [entry('Salary', { kind: 'income', amountCents: 500000 }), entry('Future', { date: '2027-12-31' })])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(2)
  await importEntries(page, [entry('Salary', { kind: 'income', amountCents: 600000 }), entry('Rent', { recurrence: 'monthly', disabled: true })], false)
  await expect(page.locator('.budget-entry-list li')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Edit Salary', exact: true })).toContainText('+6,000.00')
  await page.getByRole('switch').check()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(2)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks).toString())
  expect(exported.version).toBe(1)
  expect(exported.entries).toHaveLength(3)
  expect(exported.entries.find((entry) => entry.id === 'Rent').disabled).toBe(true)
  await importEntries(page, [entry('Good'), entry('Invalid', { date: '2026-02-30' })])
  await expect(page.getByRole('alert')).toContainText('invalid or missing "date"')
  await expect(page.getByRole('button', { name: 'Edit Good', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.budget-entry-list li')).toHaveCount(3)
})

test('savings levels include exact boundaries, negative balances, and disabled thresholds', () => {
  for (const [balance, level] of [
    [-1, 'critical'], [0, 'critical'], [4999, 'critical'],
    [5000, 'danger'], [9999, 'danger'], [10000, 'warning'], [12499, 'warning'],
    [12500, 'comfortable'], [14999, 'comfortable'], [15000, 'good'], [19999, 'good'],
    [20000, 'excellent'], [100000, 'excellent'],
  ]) expect(balanceLevel(balance, 10000)).toBe(`balance-${level}`)
  for (const threshold of [null, undefined, 0, -1, '100', NaN, Infinity]) {
    expect(balanceLevel(10000, threshold)).toBe('')
    expect(balanceLevel(-1, threshold)).toBe('balance-critical')
  }
})

test('savings threshold colors all projected balances, persists, and clears in a compact sheet', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await openBudget(page)
  const levels = ['critical', 'danger', 'warning', 'comfortable', 'good', 'excellent']
  await importEntries(page, [
    ...[4999, 1, 5000, 2500, 2500, 5000].map((amountCents, index) => entry(`Step ${index}`, {
      date: `2026-10-${11 + index}`, kind: 'income', amountCents,
    })),
    entry('Excluded', { kind: 'income', amountCents: 99999999, disabled: true }),
  ])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(7)
  const net = page.locator('.budget-summary dd').last()
  await expect(net).toHaveClass('pos')
  const savingsButton = page.getByRole('button', { name: 'Savings', exact: true })
  const headingBounds = await page.locator('.entries-heading').boundingBox()
  const savingsBounds = await savingsButton.boundingBox()
  expect(savingsBounds.y).toBeGreaterThanOrEqual(headingBounds.y)
  expect(savingsBounds.y + savingsBounds.height).toBeLessThanOrEqual(headingBounds.y + headingBounds.height)
  await savingsButton.click()
  const dialog = page.getByRole('dialog', { name: 'Savings threshold', exact: true })
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(dialog.getByLabel('Amount', { exact: true })).toBeFocused()
  await expect(dialog.locator('input')).toHaveCount(1)
  await dialog.getByLabel('Amount', { exact: true }).fill('100')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(savingsButton).toBeFocused()
  const colors = []
  for (let index = 0; index < levels.length; index++) {
    const day = page.getByRole('button', { name: `Oct ${11 + index}, 2026`, exact: true })
    await expect(day.locator('.day-total')).toHaveClass(`day-total balance-${levels[index]}`)
    await day.click()
    await expect(net).toHaveClass(`balance-${levels[index]}`)
    const color = await net.evaluate((element) => getComputedStyle(element).color)
    expect(await day.locator('.day-total').evaluate((element) => getComputedStyle(element).color)).toBe(color)
    colors.push(color)
  }
  expect(new Set(colors).size).toBe(6)
  // Income/expense amounts and daily changes keep their existing meaning and colors.
  await expect(page.locator('.budget-summary dd').first()).toHaveClass('pos')
  await expect(page.getByRole('button', { name: 'Oct 16, 2026', exact: true }).locator('.day-delta')).toHaveClass('day-delta pos')
  await page.getByRole('button', { name: 'Edit Step 0', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('75')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Oct 11, 2026', exact: true }).locator('.day-total')).toHaveClass('day-total balance-danger')
  await page.getByRole('button', { name: 'Converter', exact: true }).click()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(net).toHaveClass('balance-danger')
  await page.reload()
  await expect(net).toHaveClass('balance-danger')
  await savingsButton.click()
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('100')
  await dialog.getByLabel('Amount', { exact: true }).fill('500')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(net).toHaveClass('balance-danger')
  await savingsButton.click()
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(net).toHaveClass('pos')
  await expect(page.locator('.calendar-day [class*="balance-"]')).toHaveCount(0)
  await page.reload()
  await expect(net).toHaveClass('pos')
  await savingsButton.click()
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('savings handles invalid settings, unsafe amounts, and failed persistence without applying changes', async ({ page }) => {
  await openBudget(page)
  await page.evaluate((key) => localStorage.setItem(key, 'broken JSON'), SAVINGS_THRESHOLD_KEY)
  await page.reload()
  await expect(page.locator('.budget-summary dd').last()).toHaveClass('zero')
  await page.getByRole('button', { name: 'Savings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Savings threshold', exact: true })
  await expect(dialog.getByLabel('Amount', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Amount', { exact: true }).fill('100000000000000')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Enter a valid threshold.')
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new Error('Storage unavailable')
      return original.call(this, name, value)
    }
  }, SAVINGS_THRESHOLD_KEY)
  await dialog.getByLabel('Amount', { exact: true }).fill('100')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Could not save threshold. Try again.')
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(page.locator('.calendar-day [class*="balance-"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('calendar amounts retain four significant digits and promote rounded unit boundaries', () => {
  for (const [cents, expected] of [
    [0, '0'], [1, '0.01'], [1234, '12.34'], [12345, '123.5'],
    [123400, '1,234'], [999949, '9,999'], [999950, '10.00K'],
    [3245100, '32.45K'], [12345600, '123.5K'], [99994900, '999.9K'],
    [99995000, '1.000M'], [123456789, '1.235M'],
    [123456789000, '1.235B'], [123456789000000, '1.235T'],
  ]) {
    expect(calendarMoney(cents)).toBe(expected)
    expect(calendarMoney(-cents)).toBe(cents ? `−${expected}` : expected)
    expect(calendarMoney(cents, true)).toBe(cents ? `+${expected}` : expected)
  }
})

test('precise positive and negative calendar balances fit their cells at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await openBudget(page)
  await importEntries(page, [
    entry('Four digits', { kind: 'income', amountCents: 123400 }),
    entry('Negative compact', { date: '2026-10-12', amountCents: 3368500 }),
    entry('Positive compact', { kind: 'income', date: '2026-10-13', amountCents: 6490200 }),
  ])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(3)
  const today = page.getByRole('button', { name: 'Oct 11, 2026', exact: true })
  const negative = page.getByRole('button', { name: 'Oct 12, 2026', exact: true })
  const positive = page.getByRole('button', { name: 'Oct 13, 2026', exact: true })
  await expect(today.locator('.day-total')).toHaveText('1,234')
  await expect(negative.locator('.day-total')).toHaveText('−32.45K')
  await expect(positive.locator('.day-total')).toHaveText('32.45K')
  await expect(negative.locator('.day-total')).toHaveAttribute('title', '−32,451.00')
  await expect(page.locator('.budget-summary dd').last()).toHaveText('+1,234.00')
  await expect(negative.locator('.day-total')).toHaveClass('day-total balance-critical')
  const marker = negative.locator('.day-critical')
  await expect(marker).toHaveText('!')
  await expect(page.locator('.calendar-day .day-critical')).toHaveCount(1)
  await negative.click()
  await expect(page.locator('.budget-summary dd').last()).toHaveClass('balance-critical')
  const savingsButton = page.getByRole('button', { name: 'Savings', exact: true })
  await savingsButton.click()
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(negative.locator('.day-total')).toHaveClass('day-total balance-critical')
  await expect(page.locator('.budget-summary dd').last()).toHaveClass('balance-critical')
  await savingsButton.click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(marker).toHaveText('!')
  await expect(negative.locator('.day-total')).toHaveClass('day-total balance-critical')
  await expect(page.locator('.budget-summary dd').last()).toHaveClass('balance-critical')
  await page.evaluate(() => document.fonts.ready)
  const dateBounds = await negative.locator('.day-date').boundingBox()
  const markerBounds = await marker.boundingBox()
  const headingBounds = await negative.locator('.day-heading').boundingBox()
  expect(markerBounds.x).toBeGreaterThanOrEqual(dateBounds.x + dateBounds.width)
  expect(Math.abs(markerBounds.x + markerBounds.width - headingBounds.x - headingBounds.width)).toBeLessThan(1)
  expect(Math.abs(markerBounds.y - dateBounds.y)).toBeLessThan(2)
  expect(await marker.evaluate((element) => getComputedStyle(element).color)).toBe(await negative.locator('.day-total').evaluate((element) => getComputedStyle(element).color))
  // Measure the actual glyphs: grid bounds alone can miss text that spills over.
  const overflow = await page.locator('.calendar-day .day-total, .calendar-day .day-delta').evaluateAll((elements) => elements.filter((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().width > element.getBoundingClientRect().width + 0.5
  }).map((element) => element.textContent))
  expect(overflow).toEqual([])
})

test('continuous calendar fits a month at 320px, scrolls independently of entries, and reaches next December', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await openBudget(page)
  await importEntries(page, Array.from({ length: 25 }, (_, i) => entry(`Entry ${i}`, { date: '2026-09-28', amountCents: 999999999 })))
  await expect(page.locator('.budget-entry-list li')).toHaveCount(25)
  const window = page.getByLabel('Scrollable calendar')
  await expect(page.getByRole('button', { name: /^Sep \d+, 2026$/ })).toHaveCount(0)
  const octoberFirst = page.getByRole('button', { name: 'Oct 1, 2026', exact: true })
  const octoberLast = page.getByRole('button', { name: 'Oct 31, 2026', exact: true })
  const novemberFirst = page.getByRole('button', { name: 'Nov 1, 2026', exact: true })
  await expect(octoberFirst.locator('.day-date')).toHaveText('Oct 1')
  await expect(novemberFirst.locator('.day-date')).toHaveText('Nov 1')
  const calendarBounds = await window.boundingBox()
  const firstBounds = await octoberFirst.boundingBox()
  const lastBounds = await octoberLast.boundingBox()
  const nextBounds = await novemberFirst.boundingBox()
  expect(Math.abs(calendarBounds.y - firstBounds.y)).toBeLessThan(2)
  expect(lastBounds.y + lastBounds.height).toBeLessThanOrEqual(calendarBounds.y + calendarBounds.height)
  // October ends on Saturday; November starts immediately beside it on Sunday.
  expect(nextBounds.y).toBe(lastBounds.y)
  expect(Math.abs(nextBounds.x - lastBounds.x - lastBounds.width - 3)).toBeLessThan(1)
  const octoberStyle = await octoberLast.evaluate((element) => ({ shade: getComputedStyle(element).backgroundColor, align: getComputedStyle(element).textAlign }))
  const novemberShade = await novemberFirst.evaluate((element) => getComputedStyle(element).backgroundColor)
  const decemberShade = await page.getByRole('button', { name: 'Dec 1, 2026', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(octoberStyle.align).toBe('left')
  expect(octoberStyle.shade).not.toBe(novemberShade)
  expect(decemberShade).toBe(octoberStyle.shade)
  await window.evaluate((element) => { element.scrollTop += element.clientHeight })
  await expect(page.locator('.calendar-controls h1')).toHaveText('November 2026')
  const scrollPosition = await window.evaluate((element) => element.scrollTop)
  await page.getByRole('region', { name: 'Entries', exact: true }).evaluate((element) => { element.scrollTop = element.scrollHeight })
  expect(await window.evaluate((element) => element.scrollTop)).toBe(scrollPosition)
  await page.getByRole('button', { name: 'Dec 31, 2027', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dec 31, 2027', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Oct 11, 2026', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const navBounds = await page.getByRole('navigation', { name: 'Pages' }).boundingBox()
  expect(navBounds.y + navBounds.height).toBe(700)
  // Large amounts must stay inside their cells and the calendar must not pan horizontally.
  expect(await window.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  // All dates, including longer month names, must fit beside the negative-balance marker.
  await page.evaluate(() => document.fonts.ready)
  const overlappingDates = await page.locator('.day-heading').evaluateAll((elements) => elements.filter((element) => {
    const date = element.querySelector('.day-date').getBoundingClientRect()
    const marker = element.querySelector('.day-critical').getBoundingClientRect()
    return date.right > marker.left || marker.right > element.getBoundingClientRect().right + 0.5
  }).map((element) => element.textContent))
  expect(overlappingDates).toEqual([])
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New entry', exact: true })).toBeFocused()
})

test('existing budget-mini IndexedDB entries are retained on the same origin', async ({ page }) => {
  await openBudget(page)
  await page.evaluate(async (saved) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('budget', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readwrite')
      tx.objectStore('entries').put(saved)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, entry('Existing', { recurrence: 'fortnightly' }))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Existing', exact: true })).toContainText('Every other Sun')
})

test('budget and saved entries work after a service-worker-controlled offline reload', async ({ page, context }) => {
  await openBudget(page)
  await importEntries(page, [entry('Offline entry')])
  await expect(page.locator('.budget-entry-list li')).toHaveCount(1)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Budget', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Edit Offline entry', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('25')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Offline entry', exact: true })).toContainText('−25.00')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Offline entry', exact: true })).toContainText('−25.00')
  await page.getByRole('button', { name: 'Converter', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Offline')
})

test('calendar horizon rolls forward with the current year', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-07-14T12:00:00Z'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Jul 14, 2027', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Dec 31, 2028', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Dec 31, 2028', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

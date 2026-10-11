export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const RECURRENCE_LABELS = { once: 'One time', daily: 'Daily', weekly: 'Weekly', fortnightly: 'Every two weeks', monthly: 'Monthly' }
const DAY_MS = 86400000
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compactMoney = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parse(iso) { return new Date(`${iso}T00:00:00Z`) }
export function addDays(iso, days) { return new Date(parse(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10) }
export function daysBetween(from, to) { return Math.round((parse(to) - parse(from)) / DAY_MS) }
export function weekdayMonFirst(iso) { return (parse(iso).getUTCDay() + 6) % 7 }
export function formatShort(iso) { return parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }
export function formatMonth(iso) { return parse(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
export function fmt(cents, signed = false) {
  const value = money.format(Math.abs(cents) / 100)
  return cents < 0 ? `−${value}` : signed && cents > 0 ? `+${value}` : value
}
export function signedCents(entry) { return entry.kind === 'income' ? entry.amountCents : -entry.amountCents }
export function calendarMoney(cents, signed = false) {
  if (Math.abs(cents) < 100000) return fmt(cents, signed)
  return `${cents < 0 ? '−' : signed ? '+' : ''}${compactMoney.format(Math.abs(cents) / 100)}`
}
export function tone(cents) { return cents > 0 ? 'pos' : cents < 0 ? 'neg' : 'zero' }

export function calendarRange(today) {
  // Keep budget-mini's original calculation baseline and extend the horizon each year.
  const start = today < '2026-09-28' ? `${today.slice(0, 7)}-01` : '2026-09-28'
  return { start, calendarStart: start === '2026-09-28' ? '2026-10-01' : start, end: `${Number(today.slice(0, 4)) + 1}-12-31` }
}

export function appliesOn(entry, day) {
  if (day < entry.date) return false
  switch (entry.recurrence) {
    case 'daily': return true
    case 'weekly': return daysBetween(entry.date, day) % 7 === 0
    case 'fortnightly': return daysBetween(entry.date, day) % 14 === 0
    case 'monthly': {
      const [year, month, date] = day.split('-').map(Number)
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
      return date === Math.min(Number(entry.date.slice(8)), last)
    }
    default: return entry.date === day
  }
}

export function describeSchedule(entry) {
  const from = formatShort(entry.date)
  switch (entry.recurrence) {
    case 'daily': return `Daily · ${from}`
    case 'weekly': return `Every ${WEEKDAYS[weekdayMonFirst(entry.date)]} · ${from}`
    case 'fortnightly': return `Every other ${WEEKDAYS[weekdayMonFirst(entry.date)]} · ${from}`
    case 'monthly': return `Monthly · ${from}`
    default: return from
  }
}

export function monthsInRange(start, end) {
  const months = []
  for (let month = `${start.slice(0, 7)}-01`; month <= end;) {
    const date = parse(month)
    date.setUTCMonth(date.getUTCMonth() + 1)
    const next = date.toISOString().slice(0, 10)
    const days = []
    for (let day = month; day < next && day <= end; day = addDays(day, 1)) {
      if (day >= start) days.push(day)
    }
    months.push({ date: month, days })
    month = next
  }
  return months
}

export function calendarDays(start, end) {
  const days = []
  const lastMonth = `${end.slice(0, 7)}-01`
  // Leave enough room to bring the final month to the top of the window.
  const gridEnd = addDays(lastMonth, 41 - weekdayMonFirst(lastMonth))
  for (let day = addDays(start, -weekdayMonFirst(start)); day <= gridEnd; day = addDays(day, 1)) {
    days.push(day >= start && day <= end ? day : null)
  }
  return days
}

export function calculateBudget(entries, start, end, selectedDate) {
  const days = new Map()
  const cumulative = new Map(entries.map((entry) => [entry.id, 0]))
  let total = 0
  for (let day = start; day <= end; day = addDays(day, 1)) {
    let delta = 0
    let active = false
    for (const entry of entries) {
      if (!appliesOn(entry, day)) continue
      const amount = signedCents(entry)
      if (day <= selectedDate) cumulative.set(entry.id, cumulative.get(entry.id) + amount)
      if (!entry.disabled) { delta += amount; active = true }
    }
    total += delta
    days.set(day, { delta, total, active })
  }
  let income = 0
  let expense = 0
  for (const entry of entries) {
    if (entry.disabled) continue
    const amount = cumulative.get(entry.id)
    if (entry.kind === 'income') income += amount
    else expense += amount
  }
  return { days, cumulative, income, expense, net: income + expense }
}

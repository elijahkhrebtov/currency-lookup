export const SETTINGS_KEY = 'pocket-currency.settings.v1'
export const RATES_KEY = 'pocket-currency.rates.v1'
export const DAY = 24 * 60 * 60 * 1000
export const DEFAULT_SETTINGS = {
  currencies: ['USD', 'EUR', 'GBP', 'JPY', 'UZS'],
  source: 'USD',
  amount: '100',
}

export function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}

export function normalizeAmount(value) {
  const normalized = value.trim().replace(/[\s\u00a0]/g, '').replace(',', '.')
  return /^-?\d{0,15}(\.\d{0,8})?$/.test(normalized) ? normalized : null
}

export function groupAmount(value) {
  const [integer, fraction] = value.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

export function loadSettings() {
  const saved = readStorage(SETTINGS_KEY)
  if (!saved || !Array.isArray(saved.currencies) || saved.currencies.length < 1 ||
    saved.currencies.length > 5 || new Set(saved.currencies).size !== saved.currencies.length ||
    !saved.currencies.every((code) => typeof code === 'string' && /^[A-Z]{3}$/.test(code)) ||
    !saved.currencies.includes(saved.source) || typeof saved.amount !== 'string' ||
    normalizeAmount(saved.amount) !== saved.amount) return DEFAULT_SETTINGS
  return saved
}

export function parseRates(rows, fetchedAt = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Invalid rates response')
  const rates = { USD: 1 }
  const dates = {}
  for (const row of rows) {
    if (row?.base === 'USD' && /^[A-Z]{3}$/.test(row.quote) &&
      Number.isFinite(row.rate) && row.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      rates[row.quote] = row.rate
      dates[row.quote] = row.date
    }
  }
  if (Object.keys(rates).length < 2) throw new Error('No exchange rates available')
  return { rates, dates, fetchedAt }
}

export function loadRates() {
  const saved = readStorage(RATES_KEY)
  if (!saved || !Number.isFinite(saved.fetchedAt) || !saved.rates || !saved.dates ||
    saved.rates.USD !== 1 || Object.keys(saved.rates).length < 2 ||
    !Object.entries(saved.rates).every(([code, rate]) => /^[A-Z]{3}$/.test(code) &&
      Number.isFinite(rate) && rate > 0 && (code === 'USD' || /^\d{4}-\d{2}-\d{2}$/.test(saved.dates[code])))) return null
  return saved
}

export function convert(amount, from, to, rates) {
  if (amount === '' || !Number.isFinite(Number(amount))) return null
  if (from === to) return Number(amount)
  if (!rates?.[from] || !rates?.[to]) return null
  return Number(amount) / rates[from] * rates[to]
}

export function formatAmount(value, currency) {
  if (value === null || !Number.isFinite(value)) return ''
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits
  return new Intl.NumberFormat('en', {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 8 : Math.max(digits, 2),
  }).format(value)
}

const names = new Intl.DisplayNames(['en'], { type: 'currency' })
export function currencyName(code) { return names.of(code) }

export function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

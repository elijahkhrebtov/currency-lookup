import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { convert, currencyName, formatAmount, groupAmount, loadSettings, normalizeAmount, SETTINGS_KEY, writeStorage } from './currency'
import { useRates } from './useRates'
import { Icon, Modal } from './ui'
import Budget from './budget/Budget'
import './App.css'

const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', UZS: 'soʻm', AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '¥', INR: '₹', KRW: '₩', RUB: '₽', TRY: '₺', AED: 'د.إ' }

function AmountInput({ currency, value, placeholder, onChange }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef(null)
  const displayValue = editing ? value : groupAmount(value)

  useLayoutEffect(() => {
    if (editing) ref.current.select()
  }, [editing])

  return <input ref={ref} className={`amount-input ${displayValue.length > 13 ? 'long-amount' : ''}`} aria-label={`${currency} amount`} type="text" inputMode="decimal" autoComplete="off" spellCheck="false" value={displayValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} />
}

function CurrencyPicker({ current, currencies, available, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = available.filter((code) => `${code} ${currencyName(code)}`.toLowerCase().includes(search.toLowerCase().trim()))
  return <Modal title={current ? 'Change currency' : 'Add a currency'} onClose={onClose} className="picker">
    <div className="search-field"><Icon name="search" /><input data-autofocus placeholder="Search name or code" aria-label="Search currencies" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="currency-options">
      {filtered.map((code) => <button key={code} className="currency-option" disabled={currencies.includes(code) && code !== current} onClick={() => onSelect(code)}>
        <span className="currency-symbol">{symbols[code] || code.slice(0, 2)}</span>
        <span className="option-name"><strong>{code}</strong><span>{currencyName(code)}</span></span>
        {code === current ? <Icon name="check" /> : currencies.includes(code) ? <small>Added</small> : null}
      </button>)}
      {!filtered.length && <p className="no-results">No currencies found. Try a different name or code.</p>}
    </div>
  </Modal>
}

function App() {
  const [page, setPage] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pocket.page.v1')) === 'budget' ? 'budget' : 'converter' } catch { return 'converter' }
  })
  const [settings, setSettings] = useState(loadSettings)
  const { currencies, source, amount } = settings
  const { data, loading, error, online, storageError: rateStorageError, stale, refresh } = useRates()
  const [storageError, setStorageError] = useState(false)
  const [picker, setPicker] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const available = data ? Object.keys(data.rates).sort() : []

  useEffect(() => {
    // Persist edits and report failures from browser storage to the UI.
    // oxlint-disable-next-line react/set-state-in-effect
    setStorageError(!writeStorage(SETTINGS_KEY, settings))
  }, [settings])
  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setInstallPrompt(event) }
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); setInstallHelp(false) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function selectPage(next) {
    setPage(next)
    setPicker(null)
    setInstallHelp(false)
    writeStorage('pocket.page.v1', next)
  }

  async function install() {
    if (!installPrompt) { setInstallHelp(true); return }
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
    } catch { setInstallHelp(true) }
    setInstallPrompt(null)
  }

  function edit(code, value) {
    const normalized = normalizeAmount(value)
    if (normalized !== null) setSettings((previous) => ({ ...previous, source: code, amount: normalized }))
  }

  function selectCurrency(code) {
    setSettings((previous) => ({
      ...previous,
      currencies: picker === 'add' ? [...previous.currencies, code] : previous.currencies.map((currency) => currency === picker ? code : currency),
      source: previous.source === picker ? code : previous.source,
    }))
    setPicker(null)
  }

  function removeCurrency(code) {
    const remaining = currencies.filter((currency) => currency !== code)
    const nextSource = source === code ? remaining[0] : source
    const nextAmount = source === code ? formatAmount(convert(amount, source, nextSource, data?.rates), nextSource) : amount
    setSettings({ currencies: remaining, source: nextSource, amount: nextAmount })
  }

  const savingFailed = storageError || rateStorageError
  const rateStatus = !online ? 'Offline' : loading ? 'Updating rates' : error ? data ? 'Update failed · Saved rates' : 'Update failed' : savingFailed ? 'Storage unavailable' : stale ? 'Saved rates' : data ? 'Rates up to date' : 'Rates unavailable'
  const statusError = !loading && online && (error || savingFailed)
  const refreshedAt = data ? new Date(data.fetchedAt) : null

  return <div className={`app-shell ${installed ? '' : 'has-install'}`}>
    <main className={`page-content ${page}-page`}>
      {page === 'budget' ? <Budget /> : <>
        <section className="converter" aria-label="Currency converter">
          <div className="section-label"><span>YOUR CURRENCIES</span><span>{currencies.length} <span className="muted">/ 5</span></span></div>
          <div className="currency-stack">
            {currencies.map((code) => {
              const isSource = code === source
              const value = isSource ? amount : formatAmount(convert(amount, source, code, data?.rates), code)
              const unitRate = convert('1', source, code, data?.rates)
              return <article key={code} className={`currency-card ${isSource ? 'is-source' : ''}`}>
                <div className="card-top">
                  <button className="currency-select" onClick={() => setPicker(code)} disabled={!data} aria-label={`Change ${code} currency`}>
                    <span className={`currency-symbol symbol-${code}`}>{symbols[code] || code.slice(0, 2)}</span>
                    <span className="currency-code">{code}</span><Icon name="down" size={16} />
                  </button>
                  <div className="card-actions">{isSource && <span className="source-badge"><span /> SOURCE</span>}
                    {currencies.length > 1 && <button className="icon-button remove-button" onClick={() => removeCurrency(code)} aria-label={`Remove ${code}`}><Icon name="close" size={15} /></button>}
                  </div>
                </div>
                <div className="amount-line">
                  <AmountInput currency={code} value={value} placeholder={isSource ? '0' : loading && !data ? '…' : unitRate === null ? '—' : '0'} onChange={(nextAmount) => edit(code, nextAmount)} />
                </div>
                <div className="card-bottom"><span>{currencyName(code)}</span><span>{isSource ? 'Editing this converts the rest' : unitRate === null ? 'Rate unavailable' : `1 ${source} = ${new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(unitRate)} ${code}`}</span></div>
              </article>
            })}
          </div>
          {currencies.length < 5 && <button className="add-button" disabled={!data} onClick={() => setPicker('add')}><Icon name="plus" size={18} /> Add currency <span>{currencies.length}/5</span></button>}
        </section>

        <section className="rates-panel" aria-label="Exchange rate status">
          <div className="rate-status"><span role={statusError ? 'alert' : 'status'} title={error || (savingFailed ? 'Changes may not be saved.' : undefined)}>{rateStatus}</span><button className={`icon-button refresh-button ${loading ? 'spinning' : ''}`} aria-label="Refresh exchange rates" disabled={loading || !online} onClick={() => refresh(true)}><Icon name="refresh" size={16} /></button></div>
          {refreshedAt && Number.isFinite(refreshedAt.getTime()) && <time className="refresh-date" aria-label="Last refresh" dateTime={refreshedAt.toISOString()}>{refreshedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</time>}
        </section>
      </>}
    </main>
    <nav className="bottom-nav" aria-label="Pages">
      <button aria-current={page === 'converter' ? 'page' : undefined} onClick={() => selectPage('converter')}><Icon name="arrows" size={16} /><span>Converter</span></button>
      <button aria-current={page === 'budget' ? 'page' : undefined} onClick={() => selectPage('budget')}><Icon name="calendar" size={16} /><span>Budget</span></button>
    </nav>
    {!installed && <button className="install-button" onClick={install} aria-label="Install app" title="Install app"><Icon name="download" size={20} /></button>}
    {picker && <CurrencyPicker key={picker} current={picker === 'add' ? null : picker} currencies={currencies} available={available} onSelect={selectCurrency} onClose={() => setPicker(null)} />}
    {installHelp && <Modal title="Install app" onClose={() => setInstallHelp(false)}>
      <div className="install-help"><ol><li>Open this site in <strong>Chrome on Android</strong>.</li><li>Tap the <strong>⋮ menu</strong>.</li><li>Choose <strong>Add to home screen</strong>, then <strong>Install</strong>.</li></ol></div>
    </Modal>}
  </div>
}

export default App

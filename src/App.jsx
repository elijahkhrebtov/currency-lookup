import { useEffect, useRef, useState } from 'react'
import { convert, currencyName, formatAmount, formatDate, loadSettings, normalizeAmount, SETTINGS_KEY, writeStorage } from './currency'
import { useRates } from './useRates'
import './App.css'

function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrows: <><path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4" /></>,
    down: <path d="m8 10 4 4 4-4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11.6-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}

const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', UZS: 'soʻm', AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '¥', INR: '₹', KRW: '₩', RUB: '₽', TRY: '₺', AED: 'د.إ' }

function Modal({ children, title, onClose, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector('[data-autofocus]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="modal-title" onCancel={onClose} onClick={(event) => {
    if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }
  }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
    {children}
  </dialog>
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
    <div className="picker-footer">{available.length} currencies · Rates from Frankfurter</div>
  </Modal>
}

function App() {
  const [settings, setSettings] = useState(loadSettings)
  const { currencies, source, amount } = settings
  const { data, loading, error, online, storageError: rateStorageError, stale, refresh } = useRates()
  const [storageError, setStorageError] = useState(false)
  const [picker, setPicker] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
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

  const dates = currencies.map((code) => data?.dates[code]).filter(Boolean).sort()
  const rateStatus = !online ? 'Offline' : loading ? 'Updating rates' : error ? 'Update failed' : stale ? 'Saved rates' : data ? 'Rates up to date' : 'Rates unavailable'

  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="./" aria-label="Pocket currency home"><span className="brand-mark"><Icon name="arrows" size={22} /></span>pocket<span className="brand-dot">.</span></a>
      {!installed && <button className="install-button" onClick={install}><Icon name="download" size={16} /><span>Install app</span></button>}
    </header>

    <main>
      <section className="intro" aria-labelledby="page-title">
        <div className="eyebrow"><span /> A LITTLE CLARITY, IN ANY CURRENCY</div>
        <h1 id="page-title">Money, translated.</h1>
        <p>One amount. A world of possibilities.</p>
      </section>

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
                <input className={`amount-input ${value.length > 13 ? 'long-amount' : ''}`} aria-label={`${code} amount`} type="text" inputMode="decimal" autoComplete="off" spellCheck="false" value={value} placeholder={isSource ? '0' : loading && !data ? '…' : unitRate === null ? '—' : '0'} onChange={(event) => edit(code, event.target.value)} onFocus={(event) => event.target.select()} />
              </div>
              <div className="card-bottom"><span>{currencyName(code)}</span><span>{isSource ? 'Editing this converts the rest' : unitRate === null ? 'Rate unavailable' : `1 ${source} = ${new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(unitRate)} ${code}`}</span></div>
            </article>
          })}
        </div>
        {currencies.length < 5 && <button className="add-button" disabled={!data} onClick={() => setPicker('add')}><Icon name="plus" size={18} /> Add currency <span>{currencies.length}/5</span></button>}
        <p className="editing-hint"><Icon name="arrows" size={15} /> Edit any amount to make it your source.</p>
      </section>

      <section className="rates-panel" aria-label="Exchange rate status">
        <div className="rate-status"><span className={`status-dot ${!online || error || stale ? 'is-warning' : ''}`} /><span role="status">{rateStatus}</span><button className={`icon-button refresh-button ${loading ? 'spinning' : ''}`} aria-label="Refresh exchange rates" disabled={loading || !online} onClick={() => refresh(true)}><Icon name="refresh" size={16} /></button></div>
        <p>{data ? dates.length ? `Rate dates: ${formatDate(dates[0])}${dates[0] !== dates.at(-1) ? ` – ${formatDate(dates.at(-1))}` : ''}` : 'Rates refresh daily.' : 'Connect once to get the latest exchange rates.'}</p>
        {error && online && <p className="error-message" role="alert">{error}{data ? ' Using saved rates.' : ''}</p>}
        {!online && data && <p>Using saved rates. Conversions still work.</p>}
        {(storageError || rateStorageError) && <p className="error-message" role="alert">Device storage is unavailable. Changes may not be saved.</p>}
      </section>
    </main>

    <footer><span>Small tool. Fewer mental calculations.</span><span>Daily rates by <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter ↗</a></span></footer>
    {picker && <CurrencyPicker key={picker} current={picker === 'add' ? null : picker} currencies={currencies} available={available} onSelect={selectCurrency} onClose={() => setPicker(null)} />}
    {installHelp && <Modal title="Pocket, on your home screen" onClose={() => setInstallHelp(false)}>
      <div className="install-help"><span className="install-art"><Icon name="arrows" size={36} /></span><p>Your currencies, always a tap away. Saved rates let you convert offline, too.</p><ol><li>Open this site in <strong>Chrome on Android</strong>.</li><li>Tap the <strong>⋮ menu</strong> in your browser.</li><li>Choose <strong>Add to home screen</strong>, then <strong>Install</strong>.</li></ol><p className="muted">If Install isn’t available yet, try again after the page has finished loading.</p></div>
    </Modal>}
  </div>
}

export default App

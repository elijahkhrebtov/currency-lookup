import { useLayoutEffect, useRef, useState } from 'react'
import { convert, currencyName, formatAmount, groupAmount, normalizeAmount } from '../currency'
import { useCurrencySettings } from '../useCurrencySettings'
import { ConverterSkeleton } from './Skeleton'
import { useRates } from '../useRates'
import { Icon, Modal } from '../ui'

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

export default function Converter() {
  const { settings, setSettings, error: settingsError, storageError, syncError, retry } = useCurrencySettings()
  const { currencies = [], source, amount } = settings || {}
  const { data, loading, error, online, storageError: rateStorageError, stale, refresh } = useRates()
  const [picker, setPicker] = useState(null)
  const available = data ? Object.keys(data.rates).sort() : []

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

  function moveCurrency(code, offset) {
    const next = [...currencies]
    const index = next.indexOf(code)
    ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
    setSettings(previous => ({ ...previous, currencies: next }))
  }

  if (!settings) return settingsError
    ? <div className="converter-error"><p role="alert">{settingsError.message}</p><button className="save-entry-button" onClick={retry}>Retry</button></div>
    : <ConverterSkeleton />

  const savingFailed = storageError || rateStorageError
  const rateStatus = !online ? 'Offline' : loading ? 'Updating rates' : error ? data ? 'Update failed · Saved rates' : 'Update failed' : savingFailed ? 'Storage unavailable' : stale ? 'Saved rates' : data ? 'Rates up to date' : 'Rates unavailable'
  const statusError = !loading && online && (error || savingFailed)
  const refreshedAt = data ? new Date(data.fetchedAt) : null

  return <>
        <section className="converter" aria-label="Currency converter">
          <div className="section-label"><span>YOUR CURRENCIES</span><span>{currencies.length} <span className="muted">/ 5</span></span></div>
          <div className="currency-stack">
            {currencies.map((code, index) => {
              const isSource = code === source
              const value = isSource ? amount : formatAmount(convert(amount, source, code, data?.rates), code)
              const unitRate = convert('1', source, code, data?.rates)
              return <article key={code} className={`currency-card ${isSource ? 'is-source' : ''}`}>
                <div className="card-top">
                  <button className="currency-select" onClick={() => setPicker(code)} disabled={!data} aria-label={`Change ${code} currency`}>
                    <span className={`currency-symbol symbol-${code}`}>{symbols[code] || code.slice(0, 2)}</span>
                    <span className="currency-code">{code}</span><Icon name="down" size={16} />
                  </button>
                  <div className="card-actions">
                    <button className="icon-button reorder-button" disabled={index === 0} aria-label={`Move ${code} up`} onClick={() => moveCurrency(code, -1)}><Icon name="left" size={12} /></button>
                    <button className="icon-button reorder-button" disabled={index === currencies.length - 1} aria-label={`Move ${code} down`} onClick={() => moveCurrency(code, 1)}><Icon name="right" size={12} /></button>
                    {isSource && <span className="source-badge"><span /> SOURCE</span>}
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
          {syncError && <div className="sync-error" role="alert">{storageError ? 'Currency changes could not be saved.' : 'Currency changes are saved on this device.'} Sync failed. <button onClick={retry}>Retry</button></div>}
          <div className="rate-status"><span role={statusError ? 'alert' : 'status'} title={error || (savingFailed ? 'Changes may not be saved.' : undefined)}>{rateStatus}</span><button className={`icon-button refresh-button ${loading ? 'spinning' : ''}`} aria-label="Refresh exchange rates" disabled={loading || !online} onClick={() => refresh(true)}><Icon name="refresh" size={16} /></button></div>
          <div className="rate-timestamp">{refreshedAt && Number.isFinite(refreshedAt.getTime()) && <time className="refresh-date" aria-label="Last refresh" dateTime={refreshedAt.toISOString()}>{refreshedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</time>}</div>
        </section>
    {picker && <CurrencyPicker key={picker} current={picker === 'add' ? null : picker} currencies={currencies} available={available} onSelect={selectCurrency} onClose={() => setPicker(null)} />}
  </>
}

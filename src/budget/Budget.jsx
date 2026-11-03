import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../ui'
import { writeStorage } from '../currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request, draftId } from '../lib/client'
import BottomSheet from './BottomSheet'
import { adjustmentValues, appliesOn, balanceLevel, calculateBudget, calendarDays, calendarMoney, calendarRange, describeSchedule, fmt, formatMonth, formatShort, localToday, monthsInRange, RECURRENCE_LABELS, signedCents, tone, WEEKDAYS } from './model'

const SAVINGS_THRESHOLD_KEY = 'budget.savings-threshold.v1'
const EMPTY_ENTRIES = []

function loadSavingsThreshold() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVINGS_THRESHOLD_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch { return null }
}

export default function Budget({ onSignOut }) {
  const [today] = useState(localToday)
  const [selectedDate, setSelectedDate] = useState(today)
  const client = useQueryClient()
  const [cachedThreshold] = useState(loadSavingsThreshold)
  const query = useQuery({ queryKey: ['budget'], queryFn: async () => {
    const data = await request('/api/budget')
    if (data.settingsInitialized === false && cachedThreshold !== null) {
      const settings = await request('/api/budget/settings', { method: 'POST', body: { savingsThreshold: cachedThreshold, throughDate: data.throughDate } })
      return { ...data, ...settings, settingsInitialized: true }
    }
    return data
  }, staleTime: 0, refetchOnMount: 'always' })
  const entries = query.data?.entries ?? EMPTY_ENTRIES
  const loaded = Boolean(query.data)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const [pendingThroughDate, setPendingThroughDate] = useState(null)
  const savingsThreshold = query.data ? query.data.savingsThreshold : cachedThreshold
  const throughDate = pendingThroughDate ?? query.data?.throughDate ?? false
  const mutation = useMutation({ mutationFn: action => action(), scope: { id: 'budget' } })
  const busy = mutation.isPending
  const { start, calendarStart, end } = useMemo(() => calendarRange(today), [today])
  const months = useMemo(() => monthsInRange(calendarStart, end), [calendarStart, end])
  const days = useMemo(() => calendarDays(calendarStart, end), [calendarStart, end])
  const stats = useMemo(() => calculateBudget(entries, start, end, selectedDate), [entries, start, end, selectedDate])
  const sorted = useMemo(() => entries.filter((entry) => !throughDate || entry.date <= selectedDate).sort((a, b) =>
    Number(appliesOn(b, selectedDate)) - Number(appliesOn(a, selectedDate)) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  ), [entries, throughDate, selectedDate])

  useEffect(() => {
    if (query.data) writeStorage(SAVINGS_THRESHOLD_KEY, query.data.savingsThreshold)
  }, [query.data])

  async function mutate(action, update) {
    setError('')
    try {
      const result = await mutation.mutateAsync(action)
      client.setQueryData(['budget'], previous => ({ ...previous, entries: update(previous.entries, result) }))
      await client.invalidateQueries({ queryKey: ['budget'] })
      return true
    } catch (error) {
      setError(error.message || 'Could not save entries. Try again.')
      return false
    }
  }

  async function save(entry) {
    const saved = await mutate(() => request('/api/budget', { method: 'PUT', body: entry }), (previous, result) => previous.some((item) => item.id === entry.id)
      ? previous.map((item) => item.id === entry.id ? result : item) : [...previous, result])
    if (saved) closeSheet()
  }

  function closeSheet() { setSheet((previous) => previous ? { ...previous, open: false } : null) }

  async function saveSettings(settings) {
    setError('')
    try {
      const saved = await mutation.mutateAsync(() => request('/api/budget/settings', { method: 'PUT', body: settings }))
      client.setQueryData(['budget'], previous => ({ ...previous, ...saved, settingsInitialized: true }))
      writeStorage(SAVINGS_THRESHOLD_KEY, saved.savingsThreshold)
      return true
    } catch (error) { setError(error.message); return false }
  }

  async function saveSavingsThreshold(value) {
    if (await saveSettings({ savingsThreshold: value, throughDate })) closeSheet()
  }

  async function toggleThroughDate(value) {
    setPendingThroughDate(value)
    await saveSettings({ savingsThreshold, throughDate: value })
    setPendingThroughDate(null)
  }

  async function toggle(entry) {
    const updated = { ...entry, disabled: !entry.disabled }
    await mutate(() => request('/api/budget', { method: 'PUT', body: updated }), (previous, result) => previous.map((item) => item.id === entry.id ? result : item))
  }

  async function remove(entry) {
    const removed = await mutate(() => request('/api/budget', { method: 'DELETE', body: { id: entry.id } }), (previous) => previous.filter((item) => item.id !== entry.id))
    if (removed) closeSheet()
  }

  return <section className={`budget ${loaded ? '' : 'budget-loading'}`} aria-label="Budget" aria-busy={!loaded || busy}>
    <Calendar months={months} days={days} stats={stats.days} selectedDate={selectedDate} today={today} onSelect={setSelectedDate} savingsThreshold={savingsThreshold} loaded={loaded} onSignOut={onSignOut} />
    <div className="budget-toolbar">
      <label className="date-filter">
        <input type="checkbox" role="switch" checked={throughDate} disabled={!loaded || busy} onChange={(event) => toggleThroughDate(event.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
        <span>Through {formatShort(selectedDate)}</span>
      </label>
      <button className="new-entry-button" aria-label="New entry" disabled={!loaded || busy} onClick={() => { setError(''); setSheet({ entry: null, date: selectedDate, open: true }) }}><Icon name="plus" size={18} /></button>
    </div>
    <section className="budget-entries" aria-label="Entries" tabIndex={0}>
      <div className="entries-heading">
        <h2>Entries <span>{loaded ? sorted.length : '—'}</span></h2>
        <button className="savings-threshold" aria-label="Savings threshold" disabled={!loaded || busy} onClick={() => { setError(''); setSheet({ type: 'savings', open: true }) }}>
          <span>Threshold:</span>
          <span className="savings-value" aria-label="Current savings threshold">{savingsThreshold === null ? 'Not set' : fmt(savingsThreshold)}</span>
        </button>
      </div>
      {error && !sheet && <p className="budget-error" role="alert">{error}</p>}
      {query.error && <p className="budget-error" role="alert">Could not load budget. <button onClick={() => query.refetch()}>Retry</button></p>}
      {query.fetchStatus === 'paused' && <p className="budget-error" role="status">Reconnect to load budget.</p>}
      <div className="budget-summary" aria-label={`Summary through ${formatShort(selectedDate)}`}>
        <div className="summary-date"><span>{formatShort(selectedDate)}</span><span className={tone(stats.days.get(selectedDate).delta)} aria-label="Day change">Δ {fmt(stats.days.get(selectedDate).delta, true)}</span></div>
        <dl>
          <div><dt>Income</dt><dd className="pos">{fmt(stats.income, true)}</dd></div>
          <div><dt>Expense</dt><dd className="neg">{fmt(stats.expense, true)}</dd></div>
          <div><dt>Net</dt><dd className={balanceLevel(stats.net, savingsThreshold) || tone(stats.net)}>{fmt(stats.net, true)}</dd></div>
        </dl>
      </div>
      {!loaded && <div className="entry-skeletons" aria-label="Loading budget">{[0, 1, 2, 3].map(index => <div key={index} className="skeleton" />)}</div>}
      {loaded && !sorted.length && <p className="budget-empty">No entries</p>}
      <ul className="budget-entry-list">
        {sorted.map((entry) => <li key={entry.id} className={`${appliesOn(entry, selectedDate) ? 'highlight' : ''} ${entry.disabled ? 'disabled' : ''}`}>
          {!entry.adjustment && <label className="entry-enable">
            <input type="checkbox" checked={!entry.disabled} disabled={busy} aria-label={`Include ${entry.description || 'entry'} in calculations`} onChange={() => toggle(entry)} />
          </label>}
          <EntryBody entry={entry} cumulative={stats.cumulative.get(entry.id)} busy={busy} onEdit={() => { setError(''); setSheet({ entry, date: entry.date, open: true }) }} />
          <button className="icon-button entry-delete" disabled={busy} aria-label={`Delete ${entry.description || 'entry'}${entry.recurrence === 'once' ? '' : ' series'}`} onClick={() => remove(entry)}><Icon name="close" size={16} /></button>
        </li>)}
      </ul>
    </section>
    {sheet && <BottomSheet title={sheet.type === 'savings' ? 'Savings threshold' : sheet.entry ? 'Edit entry' : 'New entry'} open={sheet.open} busy={busy} onClose={closeSheet} onClosed={() => setSheet(null)}>
      {sheet.type === 'savings'
        ? <SavingsForm threshold={savingsThreshold} onSave={saveSavingsThreshold} busy={busy} error={error} />
        : <EntryForm editing={sheet.entry} initialDate={sheet.date} projectedCents={stats.days.get(sheet.date)?.total} start={start} end={end} onSave={save} onDelete={remove} busy={busy} error={error} />}
    </BottomSheet>}
  </section>
}

function EntryBody({ entry, cumulative, busy, onEdit }) {
  const Tag = entry.adjustment ? 'div' : 'button'
  return <Tag className={`entry-body${entry.adjustment ? ' adjustment-body' : ''}`} {...(!entry.adjustment && { disabled: busy, 'aria-label': `Edit ${entry.description || 'entry'}`, onClick: onEdit })}>
    <span className="entry-main"><span className="entry-description">{entry.description || (entry.kind === 'income' ? 'Income' : 'Expense')}</span><span className={`entry-amount ${tone(signedCents(entry))}`}>{fmt(signedCents(entry), true)}</span></span>
    <span className="entry-meta"><span>{describeSchedule(entry)}</span><span className={tone(cumulative)}>Σ {fmt(cumulative, true)}</span></span>
  </Tag>
}

function Calendar({ months, days, stats, selectedDate, today, onSelect, savingsThreshold, loaded, onSignOut }) {
  const viewport = useRef(null)
  const monthRefs = useRef(new Map())
  const initialMonth = months.findIndex((month) => month.date.slice(0, 7) === selectedDate.slice(0, 7))
  const [visibleMonth, setVisibleMonth] = useState(initialMonth)
  const monthIndexRef = useRef(initialMonth)

  function scrollToMonth(index, behavior = 'smooth') {
    const container = viewport.current
    const month = monthRefs.current.get(months[index]?.date)
    if (container && month) container.scrollTo({ top: month.offsetTop, behavior })
  }

  useLayoutEffect(() => {
    const container = viewport.current
    const observer = new ResizeObserver(() => {
      const month = monthRefs.current.get(months[monthIndexRef.current]?.date)
      if (month) container.scrollTo({ top: month.offsetTop, behavior: 'instant' })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [months])

  return <section className="budget-calendar" aria-label="Calendar">
    <div className="calendar-controls">
      <div className="calendar-start">
        <button className="icon-button sign-out" aria-label="Sign out" title="Sign out" onClick={onSignOut}><Icon name="logout" size={16} /></button>
        <button className="today-button" onClick={() => { onSelect(today); scrollToMonth(months.findIndex((month) => month.date.slice(0, 7) === today.slice(0, 7))) }}>Today</button>
      </div>
      <h1>{formatMonth(months[visibleMonth].date)}</h1>
      <div className="calendar-navigation">
        <button className="icon-button" aria-label="Previous month" disabled={visibleMonth === 0} onClick={() => scrollToMonth(visibleMonth - 1)}><Icon name="left" size={18} /></button>
        <button className="icon-button" aria-label="Next month" disabled={visibleMonth === months.length - 1} onClick={() => scrollToMonth(visibleMonth + 1)}><Icon name="right" size={18} /></button>
      </div>
    </div>
    <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
    <div ref={viewport} className="calendar-window" tabIndex={0} aria-label="Scrollable calendar" onScroll={() => {
      const container = viewport.current
      let index = 0
      for (let i = 0; i < months.length; i++) {
        const firstDay = monthRefs.current.get(months[i].date)
        if (firstDay && firstDay.offsetTop <= container.scrollTop + 1) index = i
        else break
      }
      monthIndexRef.current = index
      setVisibleMonth(index)
    }}>
      <div className="calendar-grid">{days.map((day, index) => {
          if (!day) return <span key={index} className="calendar-blank" />
          const { delta, total, active } = stats.get(day)
          return <button key={day} ref={day.endsWith('-01') ? (node) => { if (node) monthRefs.current.set(day, node); else monthRefs.current.delete(day) } : undefined} className={`calendar-day ${Number(day.slice(5, 7)) % 2 === 0 ? 'alt-month' : ''} ${day === selectedDate ? 'selected' : ''} ${day === today ? 'today' : ''}`} aria-label={formatShort(day)} aria-pressed={day === selectedDate} onClick={() => onSelect(day)}>
            <span className="day-heading">
              <span className="day-date">{formatShort(day).split(',')[0]}</span>
              {loaded && total < 0 && <span className="day-critical balance-critical" aria-hidden="true" title="Negative balance">!</span>}
            </span>
            <span className={`day-delta ${loaded ? tone(delta) : 'skeleton'}`} title={loaded ? fmt(delta, true) : undefined}>{loaded ? active ? calendarMoney(delta, true) : '—' : '\u00a0'}</span>
            <span className={`day-total ${loaded ? balanceLevel(total, savingsThreshold) : 'skeleton'}`} title={loaded ? fmt(total) : undefined}>{loaded ? calendarMoney(total) : '\u00a0'}</span>
          </button>
        })}</div>
    </div>
  </section>
}

function SavingsForm({ threshold, onSave, busy, error }) {
  const [amount, setAmount] = useState(threshold === null ? '' : String(threshold / 100))
  const [validation, setValidation] = useState('')

  function submit(event) {
    event.preventDefault()
    const value = amount === '' ? null : Math.round(Number(amount) * 100)
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
      setValidation('Enter a valid threshold.')
      return
    }
    setValidation('')
    onSave(value)
  }

  return <form className="budget-entry-form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <label>Amount<input data-autofocus type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      {(error || validation) && <p role="alert" className="budget-error">{error || validation}</p>}
      <div className="entry-form-actions">
        <button type="button" className="clear-savings-button" disabled={threshold === null} onClick={() => onSave(null)}>Clear</button>
        <button type="submit" className="save-entry-button">Save</button>
      </div>
    </fieldset>
  </form>
}

function EntryForm({ editing, initialDate, projectedCents, start, end, onSave, onDelete, busy, error }) {
  const [kind, setKind] = useState(editing?.kind ?? 'expense')
  const [recurrence, setRecurrence] = useState(editing?.recurrence ?? 'once')
  const [date, setDate] = useState(initialDate)
  const [amount, setAmount] = useState(editing ? String(editing.amountCents / 100) : '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [validation, setValidation] = useState('')
  const isAdjustment = kind === 'adjustment'

  function submit(event) {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)
    if (isAdjustment) {
      try {
        const values = adjustmentValues(amountCents, projectedCents, initialDate)
        setValidation('')
        onSave({ id: draftId(), createdAt: Date.now(), ...values })
      } catch (err) { setValidation(err.message) }
      return
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) { setValidation('Enter a valid amount.'); return }
    setValidation('')
    onSave({ id: editing?.id ?? draftId(), createdAt: editing?.createdAt ?? Date.now(), disabled: editing?.disabled, description: description.trim(), kind, recurrence, date, amountCents })
  }

  return <form className="budget-entry-form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <div className="entry-kind">{(editing ? ['expense', 'income'] : ['expense', 'income', 'adjustment']).map((value) => <button key={value} type="button" aria-pressed={kind === value} className={kind === value ? value : ''} onClick={() => { setKind(value); setValidation('') }}>{value === 'income' ? 'Income' : value === 'adjustment' ? 'Adjustment' : 'Expense'}</button>)}</div>
      <label>{isAdjustment ? 'Actual balance' : 'Amount'}<input data-autofocus type="number" required min={isAdjustment ? undefined : '0.01'} step="0.01" inputMode={isAdjustment ? undefined : 'decimal'} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      {!isAdjustment && <><label>Description<input type="text" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="form-row">
        <label>Repeats<select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{recurrence === 'once' ? 'Date' : 'Start date'}<input type="date" required min={editing?.date < start ? editing.date : start} max={editing?.date > end ? editing.date : end} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div></>}
      {(error || validation) && <p role="alert" className="budget-error">{error || validation}</p>}
      <div className="entry-form-actions">
        {editing && <button type="button" className="delete-entry-button" onClick={() => onDelete(editing)}>{editing.recurrence === 'once' ? 'Delete' : 'Delete series'}</button>}
        <button type="submit" className="save-entry-button">{busy ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
      </div>
    </fieldset>
  </form>
}

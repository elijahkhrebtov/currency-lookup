import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../ui'
import BottomSheet from './BottomSheet'
import { deleteEntry, getAllEntries, putEntries, putEntry } from './db'
import { downloadEntries, readEntriesFile } from './transfer'
import { appliesOn, calculateBudget, calendarDays, calendarMoney, calendarRange, describeSchedule, fmt, formatMonth, formatShort, localToday, monthsInRange, RECURRENCE_LABELS, signedCents, tone, WEEKDAYS } from './model'
import './Budget.css'

export default function Budget() {
  const [today] = useState(localToday)
  const [selectedDate, setSelectedDate] = useState(today)
  const [entries, setEntries] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [throughDate, setThroughDate] = useState(false)
  const [sheet, setSheet] = useState(null)
  const fileInput = useRef(null)
  const { start, calendarStart, end } = useMemo(() => calendarRange(today), [today])
  const months = useMemo(() => monthsInRange(calendarStart, end), [calendarStart, end])
  const days = useMemo(() => calendarDays(calendarStart, end), [calendarStart, end])
  const stats = useMemo(() => calculateBudget(entries, start, end, selectedDate), [entries, start, end, selectedDate])
  const sorted = useMemo(() => entries.filter((entry) => !throughDate || entry.date <= selectedDate).sort((a, b) =>
    Number(appliesOn(b, selectedDate)) - Number(appliesOn(a, selectedDate)) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  ), [entries, throughDate, selectedDate])

  useEffect(() => {
    let cancelled = false
    getAllEntries().then((saved) => {
      if (!cancelled) { setEntries(saved); setLoaded(true) }
    }).catch(() => { if (!cancelled) setError('Could not load entries. Reload to retry.') })
    return () => { cancelled = true }
  }, [])

  async function mutate(action, update) {
    setBusy(true)
    setError('')
    try {
      await action()
      setEntries(update)
      return true
    } catch {
      setError('Could not save entries. Try again.')
      return false
    } finally { setBusy(false) }
  }

  async function save(entry) {
    const saved = await mutate(() => putEntry(entry), (previous) => previous.some((item) => item.id === entry.id)
      ? previous.map((item) => item.id === entry.id ? entry : item) : [...previous, entry])
    if (saved) closeSheet()
  }

  function closeSheet() { setSheet((previous) => previous ? { ...previous, open: false } : null) }

  async function toggle(entry) {
    const updated = { ...entry, disabled: !entry.disabled }
    await mutate(() => putEntry(updated), (previous) => previous.map((item) => item.id === entry.id ? updated : item))
  }

  async function remove(entry) {
    const removed = await mutate(() => deleteEntry(entry.id), (previous) => previous.filter((item) => item.id !== entry.id))
    if (removed) closeSheet()
  }

  async function importFile(file) {
    setBusy(true)
    setError('')
    try {
      const imported = await readEntriesFile(file)
      await putEntries(imported)
      setEntries((previous) => {
        const byId = new Map(previous.map((entry) => [entry.id, entry]))
        for (const entry of imported) byId.set(entry.id, entry)
        return [...byId.values()]
      })
    } catch (err) { setError(`Import failed: ${err.message}`) }
    finally { setBusy(false) }
  }

  return <section className="budget" aria-label="Budget">
    <Calendar months={months} days={days} stats={stats.days} selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />
    <div className="budget-toolbar">
      <label className="date-filter">
        <input type="checkbox" role="switch" checked={throughDate} onChange={(event) => setThroughDate(event.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
        <span>Through {formatShort(selectedDate)}</span>
      </label>
      <button className="new-entry-button" aria-label="New entry" disabled={!loaded || busy} onClick={() => { setError(''); setSheet({ entry: null, date: selectedDate, open: true }) }}><Icon name="plus" size={18} /></button>
    </div>
    <section className="budget-entries" aria-label="Entries" tabIndex={0}>
      <div className="entries-heading">
        <h2>Entries <span>{sorted.length}</span></h2>
        <div className="transfer-actions">
          <button disabled={!loaded || busy} onClick={() => fileInput.current.click()}>Import</button>
          <button disabled={!loaded || busy || !entries.length} onClick={() => downloadEntries(entries)}>Export</button>
          <input ref={fileInput} aria-label="Import entries" type="file" accept="application/json,.json" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) importFile(file)
          }} />
        </div>
      </div>
      {error && !sheet && <p className="budget-error" role="alert">{error}</p>}
      <div className="budget-summary" aria-label={`Summary through ${formatShort(selectedDate)}`}>
        <div className="summary-date"><span>{formatShort(selectedDate)}</span><span className={tone(stats.days.get(selectedDate).delta)} aria-label="Day change">Δ {fmt(stats.days.get(selectedDate).delta, true)}</span></div>
        <dl>
          <div><dt>Income</dt><dd className="pos">{fmt(stats.income, true)}</dd></div>
          <div><dt>Expense</dt><dd className="neg">{fmt(stats.expense, true)}</dd></div>
          <div><dt>Net</dt><dd className={tone(stats.net)}>{fmt(stats.net, true)}</dd></div>
        </dl>
      </div>
      {!sorted.length && <p className="budget-empty">{loaded ? 'No entries' : 'Loading…'}</p>}
      <ul className="budget-entry-list">
        {sorted.map((entry) => <li key={entry.id} className={`${appliesOn(entry, selectedDate) ? 'highlight' : ''} ${entry.disabled ? 'disabled' : ''}`}>
          <label className="entry-enable">
            <input type="checkbox" checked={!entry.disabled} disabled={busy} aria-label={`Include ${entry.description || 'entry'} in calculations`} onChange={() => toggle(entry)} />
          </label>
          <button className="entry-body" disabled={busy} aria-label={`Edit ${entry.description || 'entry'}`} onClick={() => { setError(''); setSheet({ entry, date: entry.date, open: true }) }}>
            <span className="entry-main"><span className="entry-description">{entry.description || (entry.kind === 'income' ? 'Income' : 'Expense')}</span><span className={`entry-amount ${tone(signedCents(entry))}`}>{fmt(signedCents(entry), true)}</span></span>
            <span className="entry-meta"><span>{describeSchedule(entry)}</span><span className={tone(stats.cumulative.get(entry.id))}>Σ {fmt(stats.cumulative.get(entry.id), true)}</span></span>
          </button>
          <button className="icon-button entry-delete" disabled={busy} aria-label={`Delete ${entry.description || 'entry'}${entry.recurrence === 'once' ? '' : ' series'}`} onClick={() => remove(entry)}><Icon name="close" size={16} /></button>
        </li>)}
      </ul>
    </section>
    {sheet && <BottomSheet title={sheet.entry ? 'Edit entry' : 'New entry'} open={sheet.open} busy={busy} onClose={closeSheet} onClosed={() => setSheet(null)}>
      <EntryForm editing={sheet.entry} initialDate={sheet.date} start={start} end={end} onSave={save} onDelete={remove} busy={busy} error={error} />
    </BottomSheet>}
  </section>
}

function Calendar({ months, days, stats, selectedDate, today, onSelect }) {
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
      <h1>{formatMonth(months[visibleMonth].date)}</h1>
      <div>
        <button className="today-button" onClick={() => { onSelect(today); scrollToMonth(months.findIndex((month) => month.date.slice(0, 7) === today.slice(0, 7))) }}>Today</button>
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
            <span className="day-date">{formatShort(day).split(',')[0]}</span>
            <span className={`day-delta ${tone(delta)}`} title={fmt(delta, true)}>{active ? calendarMoney(delta, true) : '—'}</span>
            <span className={`day-total ${total < 0 ? 'neg' : ''}`} title={fmt(total)}>{calendarMoney(total)}</span>
          </button>
        })}</div>
    </div>
  </section>
}

function EntryForm({ editing, initialDate, start, end, onSave, onDelete, busy, error }) {
  const [kind, setKind] = useState(editing?.kind ?? 'expense')
  const [recurrence, setRecurrence] = useState(editing?.recurrence ?? 'once')
  const [date, setDate] = useState(initialDate)
  const [amount, setAmount] = useState(editing ? String(editing.amountCents / 100) : '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [validation, setValidation] = useState('')

  function submit(event) {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) { setValidation('Enter a valid amount.'); return }
    setValidation('')
    onSave({ id: editing?.id ?? crypto.randomUUID(), createdAt: editing?.createdAt ?? Date.now(), disabled: editing?.disabled, description: description.trim(), kind, recurrence, date, amountCents })
  }

  return <form className="budget-entry-form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <div className="entry-kind">{['expense', 'income'].map((value) => <button key={value} type="button" aria-pressed={kind === value} className={kind === value ? value : ''} onClick={() => setKind(value)}>{value === 'income' ? 'Income' : 'Expense'}</button>)}</div>
      <label>Amount<input data-autofocus type="number" required min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Description<input type="text" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="form-row">
        <label>Repeats<select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>{Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{recurrence === 'once' ? 'Date' : 'Start date'}<input type="date" required min={editing?.date < start ? editing.date : start} max={editing?.date > end ? editing.date : end} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      {(error || validation) && <p role="alert" className="budget-error">{error || validation}</p>}
      <div className="entry-form-actions">
        {editing && <button type="button" className="delete-entry-button" onClick={() => onDelete(editing)}>{editing.recurrence === 'once' ? 'Delete' : 'Delete series'}</button>}
        <button type="submit" className="save-entry-button">{busy ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
      </div>
    </fieldset>
  </form>
}

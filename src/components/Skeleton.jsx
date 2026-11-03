import { Icon } from './Icon'

export function ConverterSkeleton() {
  return <section className="converter" aria-busy="true" aria-label="Loading currencies"><div className="section-label"><span>YOUR CURRENCIES</span><span>— / 5</span></div><div className="currency-stack">{[0, 1, 2, 3, 4].map(index => <div key={index} className="currency-card skeleton-card"><div className="card-top"><span className="skeleton" /></div><div className="amount-line"><span className="amount-input skeleton">&nbsp;</span></div><div className="card-bottom"><span className="skeleton">&nbsp;</span></div></div>)}</div></section>
}

export function AppSkeleton() {
  return <div className="app-shell" aria-busy="true" aria-label="Loading app">
    <header className="app-header"><button className="icon-button" aria-label="Open sidebar" disabled><Icon name="menu" /></button><span className="app-title">Budget</span><button className="icon-button" aria-label="Sign out" disabled><Icon name="logout" size={18} /></button></header>
    <main className="page-content budget-page"><section className="budget budget-loading">
      <div className="budget-calendar"><div className="calendar-controls"><span className="skeleton">&nbsp;</span><span className="skeleton" style={{ width: 110 }}>&nbsp;</span></div><div className="calendar-weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div><div className="calendar-window"><div className="calendar-grid">{Array.from({ length: 42 }, (_, index) => <div key={index} className="calendar-day"><span className="skeleton">&nbsp;</span><span className="skeleton">&nbsp;</span></div>)}</div></div></div>
      <div className="budget-toolbar"><span className="skeleton" style={{ width: 120 }}>&nbsp;</span><button className="new-entry-button" aria-label="New entry" disabled><Icon name="plus" size={18} /></button></div>
      <div className="budget-entries"><div className="entries-heading"><h2>Entries <span>—</span></h2><span className="savings-threshold">Threshold: —</span></div><div className="budget-summary"><div className="summary-date"><span className="skeleton">&nbsp;</span></div><dl>{['Income', 'Expense', 'Net'].map(label => <div key={label}><dt>{label}</dt><dd>&nbsp;</dd></div>)}</dl></div><div className="entry-skeletons">{[0, 1, 2, 3].map(index => <div key={index} className="skeleton" />)}</div></div>
    </section></main>
  </div>
}

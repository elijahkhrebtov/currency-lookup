import { Icon } from './Icon'

export function AppSkeleton() {
  return <div className="app-shell" aria-busy="true" aria-label="Loading app"><main className="page-content converter-page"><section className="converter"><div className="section-label"><button className="icon-button sign-out" aria-label="Sign out" disabled><Icon name="logout" size={16} /></button><span>YOUR CURRENCIES</span><span>— / 5</span></div><div className="currency-stack">{[0, 1, 2, 3, 4].map(index => <div key={index} className="currency-card skeleton-card"><div className="card-top"><span className="skeleton" /></div><div className="amount-line"><span className="amount-input skeleton">&nbsp;</span></div><div className="card-bottom"><span className="skeleton">&nbsp;</span></div></div>)}</div></section></main><nav className="bottom-nav" aria-label="Pages"><button disabled>Converter</button><button disabled>Budget</button></nav></div>
}

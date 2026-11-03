import { useReducer } from 'react'
import { calculatorReducer, initialCalculator } from '../calculator'
import { Icon } from './Icon'

const keys = [
  ['CE', 'Clear entry', 'utility'], ['C', 'Clear all', 'utility'], ['backspace', 'Backspace', 'utility'], ['/', 'Divide', 'operator'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['*', 'Multiply', 'operator'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['-', 'Subtract', 'operator'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', 'Add', 'operator'],
  ['sign', 'Change sign'], ['0', '0'], ['.', 'Decimal point'], ['=', 'Equals', 'equals'],
]
const labels = { '/': '÷', '*': '×', '-': '−', sign: '±' }

export default function Calculator() {
  const [state, press] = useReducer(calculatorReducer, initialCalculator)
  return <section className="calculator" aria-label="Calculator">
    <div className="calculator-screen">
      <div className="calculator-history" aria-label="Calculation">{state.history.replace(/(^|\s)-(?=\d)/g, '$1−') || '\u00a0'}</div>
      <output className={`calculator-display ${state.entry.length > 12 ? 'long-result' : ''}`} aria-label="Calculator display" aria-live="polite">{state.entry.replace(/^-/, '−')}</output>
    </div>
    <div className="calculator-keypad">
      {keys.map(([key, name, style]) => <button key={key} className={`calculator-key ${style || ''}`} aria-label={name} aria-pressed={style === 'operator' ? state.operator === key : undefined} title={key === 'CE' ? 'Clear entry' : key === 'C' ? 'Clear all' : undefined} onClick={() => press(key)}>{key === 'backspace' ? <Icon name="backspace" size={22} /> : labels[key] || key}</button>)}
    </div>
  </section>
}

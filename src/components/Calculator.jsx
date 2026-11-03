import { useLayoutEffect, useReducer, useRef, useState } from 'react'
import { CALCULATOR_RESULTS_KEY, calculatorReducer, initialCalculator, loadCalculatorResults, rememberCalculatorResult } from '../calculator'
import { readStorage, writeStorage } from '../currency'
import { Icon } from './Icon'

const keys = [
  ['CE', 'Clear entry', 'utility'], ['C', 'Clear all', 'utility'], ['backspace', 'Backspace', 'utility'], ['/', 'Divide', 'operator'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['*', 'Multiply', 'operator'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['-', 'Subtract', 'operator'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', 'Add', 'operator'],
  ['sign', 'Change sign'], ['0', '0'], ['.', 'Decimal point'], ['=', 'Equals', 'equals'],
]
const formatNegative = value => value.replace(/(^|\s)-(?=\d)/g, '$1−')

const labels = { '/': '÷', '*': '×', '-': '−', sign: '±' }

export default function Calculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialCalculator)
  const [results, setResults] = useState(() => loadCalculatorResults(readStorage(CALCULATOR_RESULTS_KEY)))
  const [storageError, setStorageError] = useState(false)
  const historyRef = useRef(null)

  useLayoutEffect(() => {
    historyRef.current.scrollTop = 0
  }, [results])

  function press(key) {
    if (key === '=') {
      const next = rememberCalculatorResult(results, calculatorReducer(state, key))
      if (next !== results) {
        setResults(next)
        setStorageError(!writeStorage(CALCULATOR_RESULTS_KEY, next))
      }
    }
    dispatch(key)
  }
  return <section className="calculator" aria-label="Calculator">
    <section className="calculator-recents" aria-label="Recent results">
      {storageError && <p className="calculator-storage-error" role="status">History couldn't be saved on this device.</p>}
      <ol ref={historyRef} className="calculator-results">
        {results.map((result, index) => <li key={index}><button className="calculator-result" aria-label={`Use result ${formatNegative(result.value)}`} onClick={() => dispatch({ type: 'recall', value: result.value })}><span>{formatNegative(result.expression)}</span><strong>{formatNegative(result.value)}</strong></button></li>)}
        {!results.length && <li className="calculator-results-empty">Results appear here after =.</li>}
      </ol>
    </section>
    <div className="calculator-screen">
      <div className="calculator-history" aria-label="Calculation">{formatNegative(state.history) || '\u00a0'}</div>
      <output className={`calculator-display ${state.entry.length > 12 ? 'long-result' : ''}`} aria-label="Calculator display" aria-live="polite">{formatNegative(state.entry)}</output>
    </div>
    <div className="calculator-keypad">
      {keys.map(([key, name, style]) => <button key={key} className={`calculator-key ${style || ''}`} aria-label={name} aria-pressed={style === 'operator' ? state.operator === key : undefined} title={key === 'CE' ? 'Clear entry' : key === 'C' ? 'Clear all' : undefined} onClick={() => press(key)}>{key === 'backspace' ? <Icon name="backspace" size={22} /> : labels[key] || key}</button>)}
    </div>
  </section>
}

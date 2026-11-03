export const initialCalculator = {
  entry: '0', total: null, operator: null, waiting: false, result: false, repeat: null, history: '', error: false,
}

export const operationSymbols = { '+': '+', '-': '−', '*': '×', '/': '÷' }

export const CALCULATOR_RESULTS_KEY = 'pocket-calculator.results.v1'
export const MAX_CALCULATOR_RESULTS = 20

function isCalculatorValue(value) {
  return typeof value === 'string' && value.length <= 32 && /^-?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))
}

export function loadCalculatorResults(saved) {
  if (!Array.isArray(saved)) return []
  return saved.filter(item => item && isCalculatorValue(item.value) && typeof item.expression === 'string' && item.expression.length <= 160)
    .slice(0, MAX_CALCULATOR_RESULTS).map(({ value, expression }) => ({ value, expression }))
}

export function rememberCalculatorResult(results, state) {
  if (state.error || !isCalculatorValue(state.entry)) return results
  return [{ value: state.entry, expression: state.history || `${state.entry} =` }, ...results].slice(0, MAX_CALCULATOR_RESULTS)
}

function calculate(left, right, operator) {
  if (operator === '/' && right === 0) throw new Error('Cannot divide by zero')
  const value = operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right
  if (!Number.isFinite(value)) throw new Error('Result is too large')
  // Keep the display at calculator precision, without binary floating-point tails.
  return Number(value.toPrecision(15)).toString()
}

function evaluate(left, right, operator) {
  try {
    return { ...initialCalculator, entry: calculate(left, right, operator), result: true, repeat: { operator, operand: right }, history: `${left} ${operationSymbols[operator]} ${right} =` }
  } catch (error) {
    return { ...initialCalculator, entry: 'Error', history: error.message, error: true, result: true }
  }
}

export function calculatorReducer(state, key) {
  if (typeof key === 'object' && key?.type === 'recall') {
    if (!isCalculatorValue(key.value)) return state
    const base = state.error ? initialCalculator : state
    return { ...base, entry: key.value, waiting: false, result: true, repeat: null, history: base.operator ? base.history : '' }
  }
  if (key === 'C') return { ...initialCalculator }
  if (key === 'CE') return { ...state, entry: '0', waiting: false, result: false, repeat: null, error: false, history: state.operator ? state.history : '' }
  if (/^[\d.]$/.test(key)) {
    const base = state.error || (state.result && !state.operator) ? initialCalculator : state
    let entry = base.waiting || base.result ? '0' : base.entry
    if (key === '.') {
      if (entry.includes('.')) return state
      entry += '.'
    } else {
      if (entry.replace(/\D/g, '').replace(/^0+/, '').length >= 15 || entry.length >= 24) return state
      entry = /^-?0$/.test(entry) ? (entry.startsWith('-') ? '-' : '') + key : entry + key
    }
    return { ...base, entry, waiting: false, result: false, repeat: null }
  }
  if (state.error) return key === 'backspace' || key === 'sign' ? { ...initialCalculator } : state
  if (key === 'sign') {
    const entry = state.waiting ? '-0' : state.entry.startsWith('-') ? state.entry.slice(1) : '-' + state.entry
    return { ...state, entry, waiting: false, repeat: null, history: state.operator ? state.history : '' }
  }
  if (key === 'backspace') {
    if (state.waiting || state.result) return state
    const shortened = state.entry.slice(0, -1)
    return { ...state, entry: shortened && shortened !== '-' ? shortened : '0', repeat: null }
  }
  if (Object.hasOwn(operationSymbols, key)) {
    const evaluated = state.operator && !state.waiting ? evaluate(state.total, Number(state.entry), state.operator) : null
    if (evaluated?.error) return evaluated
    const entry = evaluated?.entry ?? state.entry
    const total = Number(entry)
    return { ...state, entry, total, operator: key, waiting: true, result: false, repeat: null, history: `${total} ${operationSymbols[key]}` }
  }
  if (key === '=') {
    if (state.operator) return evaluate(state.total, Number(state.entry), state.operator)
    if (state.repeat && state.result) return evaluate(Number(state.entry), state.repeat.operand, state.repeat.operator)
  }
  return state
}

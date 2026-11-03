import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatorReducer, initialCalculator, loadCalculatorResults, rememberCalculatorResult } from '../../src/calculator.js'

function press(...keys: string[]) {
  return keys.reduce(calculatorReducer, initialCalculator)
}

test('calculator handles decimal arithmetic, signs, chained operations and repeated equals', () => {
  assert.equal(press('0', '.', '1', '+', '0', '.', '2', '=').entry, '0.3')
  assert.equal(press('1', '2', '.', '5', 'sign', '*', '2', '+', '.', '5', '=').entry, '-24.5')
  assert.equal(press('2', '+', '3', '*', '4', '=').entry, '20')
  assert.equal(press('8', '/', '2', '=', '-', '6', '=').entry, '-2')
  assert.equal(press('2', '+', '3', '=', '=', '=').entry, '11')
  assert.equal(press('2', '+', '*', '3', '=').entry, '6')
  assert.equal(press('5', '+', 'sign', '2', '=').entry, '3')
  assert.equal(press('sign', 'sign', '2').entry, '2')
})

test('clear entry keeps the pending calculation while clear all resets it', () => {
  assert.equal(press('8', '+', '9', 'CE', '2', '=').entry, '10')
  assert.equal(press('8', '+', '9', 'C', '2', '=').entry, '2')
  assert.equal(press('8', '+', 'CE', '=').entry, '8')
  assert.equal(press('1', '2', '3', 'backspace', '+', '4', '=').entry, '16')
  assert.equal(press('1', 'sign', 'backspace').entry, '0')
  assert.equal(press('5', '+', 'backspace', '2', '=').entry, '7')
})

test('decimal entry rejects duplicate separators and new numbers replace completed results', () => {
  assert.equal(press('.', '.', '5').entry, '0.5')
  assert.equal(press('sign', '.', '5').entry, '-0.5')
  assert.equal(press('0', '0', '1').entry, '1')
  assert.equal(press('2', '+', '3', '=', '7').entry, '7')
  assert.equal(press('2', '+', '3', '=', '.', '5').entry, '0.5')
  assert.equal(press(...Array(30).fill('9')).entry, '999999999999999')
})

test('division by zero and overflow show a recoverable error', () => {
  const error = press('9', '/', '0', '=')
  assert.equal(error.entry, 'Error')
  assert.equal(error.history, 'Cannot divide by zero')
  assert.equal(calculatorReducer(error, '2').entry, '2')
  assert.equal(calculatorReducer(error, 'CE').entry, '0')
  assert.equal(calculatorReducer(error, 'C').entry, '0')
  const overflow = press(...Array(15).fill('9'), '*', ...Array(15).fill('9'), ...Array(25).fill('='))
  assert.equal(overflow.entry, 'Error')
  assert.equal(overflow.history, 'Result is too large')
})

test('recalling a result replaces the current operand while preserving the pending operation', () => {
  const pending = press('1', '2', '+', '9', '9')
  const recalled = calculatorReducer(pending, { type: 'recall', value: '-3.5' })
  assert.equal(recalled.entry, '-3.5')
  assert.equal(calculatorReducer(recalled, '=').entry, '8.5')
  const waiting = calculatorReducer(press('8', '*'), { type: 'recall', value: '2.5' })
  assert.equal(calculatorReducer(waiting, '=').entry, '20')
  const completed = calculatorReducer(press('2', '+', '3', '='), { type: 'recall', value: '7' })
  assert.equal(calculatorReducer(completed, '=').entry, '7')
  const scientific = calculatorReducer(press('1', '+'), { type: 'recall', value: '1e+21' })
  assert.equal(calculatorReducer(scientific, '2').entry, '2')
  assert.equal(calculatorReducer(calculatorReducer(scientific, '2'), '=').entry, '3')
  const recovered = calculatorReducer(press('8', '/', '0', '='), { type: 'recall', value: '0' })
  assert.equal(recovered.entry, '0')
  assert.equal(recovered.error, false)
  assert.equal(calculatorReducer(pending, { type: 'recall', value: 'Infinity' }), pending)
})

test('recent results keep the newest twenty, including duplicates, and skip errors', () => {
  let results: { value: string; expression: string }[] = []
  for (let n = 0; n < 25; n++) results = rememberCalculatorResult(results, press(...String(n), '='))
  assert.equal(results.length, 20)
  assert.equal(results[0].value, '24')
  assert.equal(results[19].value, '5')
  const duplicate = rememberCalculatorResult(results, press('2', '4', '='))
  assert.equal(duplicate[0].value, '24')
  assert.equal(duplicate[1].value, '24')
  assert.equal(duplicate[0].expression, '24 =')
  const arithmetic = rememberCalculatorResult([], press('0', '.', '1', '+', '0', '.', '2', '='))
  assert.deepEqual(arithmetic, [{ value: '0.3', expression: '0.1 + 0.2 =' }])
  assert.equal(rememberCalculatorResult(results, press('1', '/', '0', '=')), results)
})

test('cached calculator history rejects invalid data and caps valid results at twenty', () => {
  assert.deepEqual(loadCalculatorResults(null), [])
  assert.deepEqual(loadCalculatorResults({ value: '2' }), [])
  const valid = { value: '-3.5', expression: '−7 ÷ 2 =' }
  const saved = [null, {}, { value: 'NaN', expression: '' }, { value: '1e999', expression: '' }, { value: '0x10', expression: '' }, { value: '', expression: '' }, { value: '2', expression: 2 }, valid]
  assert.deepEqual(loadCalculatorResults(saved), [valid])
  assert.equal(loadCalculatorResults(Array(25).fill(valid)).length, 20)
})

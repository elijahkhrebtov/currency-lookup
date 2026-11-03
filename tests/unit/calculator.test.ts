import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatorReducer, initialCalculator } from '../../src/calculator.js'

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

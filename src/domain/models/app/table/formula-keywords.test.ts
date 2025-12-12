/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { FORMULA_KEYWORDS } from './formula-keywords'

describe('FORMULA_KEYWORDS', () => {
  test('should be a Set', () => {
    expect(FORMULA_KEYWORDS).toBeInstanceOf(Set)
  })

  test('should contain common SQL keywords', () => {
    expect(FORMULA_KEYWORDS.has('as')).toBe(true)
    expect(FORMULA_KEYWORDS.has('from')).toBe(true)
    expect(FORMULA_KEYWORDS.has('where')).toBe(true)
    expect(FORMULA_KEYWORDS.has('join')).toBe(true)
  })

  test('should contain SQL functions', () => {
    expect(FORMULA_KEYWORDS.has('concat')).toBe(true)
    expect(FORMULA_KEYWORDS.has('upper')).toBe(true)
    expect(FORMULA_KEYWORDS.has('lower')).toBe(true)
    expect(FORMULA_KEYWORDS.has('cast')).toBe(true)
    expect(FORMULA_KEYWORDS.has('extract')).toBe(true)
  })

  test('should contain aggregate functions', () => {
    expect(FORMULA_KEYWORDS.has('sum')).toBe(true)
    expect(FORMULA_KEYWORDS.has('avg')).toBe(true)
    expect(FORMULA_KEYWORDS.has('max')).toBe(true)
    expect(FORMULA_KEYWORDS.has('min')).toBe(true)
    expect(FORMULA_KEYWORDS.has('count')).toBe(true)
  })

  test('should contain date/time functions', () => {
    expect(FORMULA_KEYWORDS.has('current_date')).toBe(true)
    expect(FORMULA_KEYWORDS.has('now')).toBe(true)
    expect(FORMULA_KEYWORDS.has('year')).toBe(true)
    expect(FORMULA_KEYWORDS.has('month')).toBe(true)
    expect(FORMULA_KEYWORDS.has('day')).toBe(true)
  })

  test('should contain data types', () => {
    expect(FORMULA_KEYWORDS.has('numeric')).toBe(true)
    expect(FORMULA_KEYWORDS.has('integer')).toBe(true)
    expect(FORMULA_KEYWORDS.has('text')).toBe(true)
    expect(FORMULA_KEYWORDS.has('boolean')).toBe(true)
    expect(FORMULA_KEYWORDS.has('date')).toBe(true)
  })

  test('should not treat regular words as keywords', () => {
    expect(FORMULA_KEYWORDS.has('fieldname')).toBe(false)
    expect(FORMULA_KEYWORDS.has('myfield')).toBe(false)
    expect(FORMULA_KEYWORDS.has('custom_column')).toBe(false)
  })
})

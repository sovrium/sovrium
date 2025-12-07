/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { translateFormulaToPostgres } from './formula-utils'

describe('translateFormulaToPostgres', () => {
  test('should translate SUBSTR to SUBSTRING with FROM...FOR syntax', () => {
    const input = 'SUBSTR(text, 7, 5)'
    const expected = 'SUBSTRING(text FROM 7 FOR 5)'
    expect(translateFormulaToPostgres(input)).toBe(expected)
  })

  test('should handle whitespace in SUBSTR function', () => {
    const input = 'SUBSTR( text , 7 , 5 )'
    const expected = 'SUBSTRING(text FROM 7 FOR 5)'
    expect(translateFormulaToPostgres(input)).toBe(expected)
  })

  test('should be case-insensitive', () => {
    const input = 'substr(text, 1, 3)'
    const expected = 'SUBSTRING(text FROM 1 FOR 3)'
    expect(translateFormulaToPostgres(input)).toBe(expected)
  })

  test('should handle SUBSTR with field names', () => {
    const input = 'SUBSTR(first_name, 1, 1)'
    const expected = 'SUBSTRING(first_name FROM 1 FOR 1)'
    expect(translateFormulaToPostgres(input)).toBe(expected)
  })

  test('should leave non-SUBSTR formulas unchanged', () => {
    const input = 'UPPER(name)'
    expect(translateFormulaToPostgres(input)).toBe(input)
  })

  test('should handle multiple SUBSTR calls in one formula', () => {
    const input = "CONCAT(SUBSTR(first_name, 1, 1), '.', SUBSTR(last_name, 1, 1))"
    const expected =
      "CONCAT(SUBSTRING(first_name FROM 1 FOR 1), '.', SUBSTRING(last_name FROM 1 FOR 1))"
    expect(translateFormulaToPostgres(input)).toBe(expected)
  })
})

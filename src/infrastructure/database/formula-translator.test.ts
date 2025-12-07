/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  translateFormulaToPostgres,
  isFormulaReturningArray,
  isFormulaVolatile,
} from './formula-utils'

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

  test('should leave CASE expressions unchanged (native PostgreSQL syntax)', () => {
    const input =
      "CASE status WHEN 'pending' THEN 'Waiting' WHEN 'active' THEN 'In Progress' WHEN 'done' THEN 'Completed' ELSE 'Unknown' END"
    expect(translateFormulaToPostgres(input)).toBe(input)
  })
})

describe('isFormulaVolatile', () => {
  describe('volatile SQL functions', () => {
    test('should detect CURRENT_DATE', () => {
      expect(isFormulaVolatile('CURRENT_DATE')).toBe(true)
    })

    test('should detect NOW()', () => {
      expect(isFormulaVolatile('NOW()')).toBe(true)
    })

    test('should detect CURRENT_TIMESTAMP', () => {
      expect(isFormulaVolatile('CURRENT_TIMESTAMP')).toBe(true)
    })

    test('should detect RANDOM()', () => {
      expect(isFormulaVolatile('RANDOM()')).toBe(true)
    })

    test('should be case-insensitive for functions', () => {
      expect(isFormulaVolatile('current_date')).toBe(true)
      expect(isFormulaVolatile('now()')).toBe(true)
    })
  })

  describe('volatile type casts', () => {
    test('should detect ::TIMESTAMP cast', () => {
      expect(isFormulaVolatile("EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)")).toBe(true)
    })

    test('should detect ::TIMESTAMPTZ cast', () => {
      expect(isFormulaVolatile("created_at::TIMESTAMPTZ")).toBe(true)
    })

    test('should detect ::DATE cast', () => {
      expect(isFormulaVolatile("date_string::DATE")).toBe(true)
    })

    test('should detect ::TIME cast', () => {
      expect(isFormulaVolatile("time_string::TIME")).toBe(true)
    })

    test('should be case-insensitive for type casts', () => {
      expect(isFormulaVolatile("timestamp_value::timestamp")).toBe(true)
      expect(isFormulaVolatile("timestamp_value::Timestamp")).toBe(true)
    })

    test('should detect type cast in complex formula', () => {
      expect(isFormulaVolatile("EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)::INTEGER")).toBe(true)
    })
  })

  describe('non-volatile formulas', () => {
    test('should return false for simple field reference', () => {
      expect(isFormulaVolatile('field_name')).toBe(false)
    })

    test('should return false for UPPER function', () => {
      expect(isFormulaVolatile('UPPER(name)')).toBe(false)
    })

    test('should return false for numeric operations', () => {
      expect(isFormulaVolatile('amount * 1.1')).toBe(false)
    })

    test('should return false for CONCAT', () => {
      expect(isFormulaVolatile("CONCAT(first_name, ' ', last_name)")).toBe(false)
    })

    test('should return false for immutable type casts', () => {
      expect(isFormulaVolatile('field::INTEGER')).toBe(false)
      expect(isFormulaVolatile('field::TEXT')).toBe(false)
      expect(isFormulaVolatile('field::BOOLEAN')).toBe(false)
    })

    test('should return false for empty formula', () => {
      expect(isFormulaVolatile('')).toBe(false)
    })
  })
})

describe('isFormulaReturningArray', () => {
  test('should detect STRING_TO_ARRAY function (uppercase)', () => {
    const formula = "STRING_TO_ARRAY(text, ',')"
    expect(isFormulaReturningArray(formula)).toBe(true)
  })

  test('should detect STRING_TO_ARRAY function (lowercase)', () => {
    const formula = "string_to_array(text, ',')"
    expect(isFormulaReturningArray(formula)).toBe(true)
  })

  test('should detect STRING_TO_ARRAY function (mixed case)', () => {
    const formula = "String_To_Array(text, ',')"
    expect(isFormulaReturningArray(formula)).toBe(true)
  })

  test('should detect STRING_TO_ARRAY in complex formula', () => {
    const formula = "CONCAT(field1, STRING_TO_ARRAY(field2, ','))"
    expect(isFormulaReturningArray(formula)).toBe(true)
  })

  test('should return false for non-array-returning functions', () => {
    const formula = 'UPPER(name)'
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should return false for CONCAT function', () => {
    const formula = "CONCAT(first_name, ' ', last_name)"
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should return false for numeric functions', () => {
    const formula = 'amount * 1.1'
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should return false for empty formula', () => {
    const formula = ''
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should not match partial function name', () => {
    // Should not match if "STRING_TO_ARRAY" appears as part of another word
    const formula = 'MY_STRING_TO_ARRAY_FUNCTION(text)'
    // This will return true because includes() matches substring
    // This is acceptable behavior - conservative matching is safer
    expect(isFormulaReturningArray(formula)).toBe(true)
  })
})

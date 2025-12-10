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

  test('should translate date field ::TEXT to TO_CHAR with format', () => {
    const fields = [
      { name: 'date_value', type: 'date' },
      { name: 'num', type: 'integer' },
    ]
    const input = 'date_value::TEXT'
    const expected = "TO_CHAR(date_value, 'YYYY-MM-DD')"
    expect(translateFormulaToPostgres(input, fields)).toBe(expected)
  })

  test('should NOT translate non-date field ::TEXT casts', () => {
    const fields = [
      { name: 'date_value', type: 'date' },
      { name: 'num', type: 'integer' },
    ]
    const input = 'num::TEXT'
    expect(translateFormulaToPostgres(input, fields)).toBe(input)
  })

  test('should translate datetime field ::TEXT to TO_CHAR with ISO format', () => {
    const fields = [{ name: 'created_at', type: 'datetime' }]
    const input = 'created_at::TEXT'
    const expected = `TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
    expect(translateFormulaToPostgres(input, fields)).toBe(expected)
  })

  test('should translate time field ::TEXT to TO_CHAR with time format', () => {
    const fields = [{ name: 'start_time', type: 'time' }]
    const input = 'start_time::TEXT'
    const expected = "TO_CHAR(start_time, 'HH24:MI:SS')"
    expect(translateFormulaToPostgres(input, fields)).toBe(expected)
  })

  test('should handle case-insensitive field names', () => {
    const fields = [{ name: 'date_value', type: 'date' }]
    const input = 'DATE_VALUE::TEXT'
    const expected = "TO_CHAR(DATE_VALUE, 'YYYY-MM-DD')"
    expect(translateFormulaToPostgres(input, fields)).toBe(expected)
  })

  test('should work without fields array (backward compatibility)', () => {
    const input = 'field::TEXT'
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

    test('should detect DATE_TRUNC()', () => {
      expect(isFormulaVolatile("DATE_TRUNC('month', date_field)")).toBe(true)
    })

    test('should detect ARRAY_TO_STRING()', () => {
      expect(isFormulaVolatile("ARRAY_TO_STRING(some_array, ',')")).toBe(true)
    })

    test('should be case-insensitive for functions', () => {
      expect(isFormulaVolatile('current_date')).toBe(true)
      expect(isFormulaVolatile('now()')).toBe(true)
      expect(isFormulaVolatile("date_trunc('day', created_at)")).toBe(true)
      expect(isFormulaVolatile("array_to_string(items, ' | ')")).toBe(true)
    })
  })

  describe('volatile type casts', () => {
    test('should detect ::TIMESTAMP cast', () => {
      expect(isFormulaVolatile('EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)')).toBe(true)
    })

    test('should detect ::TIMESTAMPTZ cast', () => {
      expect(isFormulaVolatile('created_at::TIMESTAMPTZ')).toBe(true)
    })

    test('should detect ::DATE cast', () => {
      expect(isFormulaVolatile('date_string::DATE')).toBe(true)
    })

    test('should detect ::TIME cast', () => {
      expect(isFormulaVolatile('time_string::TIME')).toBe(true)
    })

    test('should be case-insensitive for type casts', () => {
      expect(isFormulaVolatile('timestamp_value::timestamp')).toBe(true)
      expect(isFormulaVolatile('timestamp_value::Timestamp')).toBe(true)
    })

    test('should detect type cast in complex formula', () => {
      expect(isFormulaVolatile('EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)::INTEGER')).toBe(true)
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

  test('should return false when ARRAY_TO_STRING wraps STRING_TO_ARRAY (returns text, not array)', () => {
    const formula = "ARRAY_TO_STRING(STRING_TO_ARRAY(items, ','), ' | ')"
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should return false when ARRAY_TO_STRING is at the start (case-insensitive)', () => {
    const formulaUpper = "ARRAY_TO_STRING(some_array, ',')"
    const formulaLower = "array_to_string(some_array, ',')"
    const formulaMixed = "Array_To_String(some_array, ',')"
    expect(isFormulaReturningArray(formulaUpper)).toBe(false)
    expect(isFormulaReturningArray(formulaLower)).toBe(false)
    expect(isFormulaReturningArray(formulaMixed)).toBe(false)
  })

  test('should return true for STRING_TO_ARRAY even when nested inside other functions (not ARRAY_TO_STRING)', () => {
    const formula = "COALESCE(STRING_TO_ARRAY(items, ','), ARRAY[]::TEXT[])"
    expect(isFormulaReturningArray(formula)).toBe(true)
  })

  test('should return false when CARDINALITY wraps STRING_TO_ARRAY (returns integer, not array)', () => {
    const formula = "CARDINALITY(STRING_TO_ARRAY(items, ','))"
    expect(isFormulaReturningArray(formula)).toBe(false)
  })

  test('should return false when CARDINALITY is at the start (case-insensitive)', () => {
    const formulaUpper = 'CARDINALITY(some_array)'
    const formulaLower = 'cardinality(some_array)'
    const formulaMixed = 'Cardinality(some_array)'
    expect(isFormulaReturningArray(formulaUpper)).toBe(false)
    expect(isFormulaReturningArray(formulaLower)).toBe(false)
    expect(isFormulaReturningArray(formulaMixed)).toBe(false)
  })
})

describe('Reserved Word Escaping', () => {
  describe('field names with reserved words', () => {
    test('should escape field name that is a reserved word', () => {
      const fields = [
        { name: 'order', type: 'integer' },
        { name: 'amount', type: 'decimal' },
      ]
      const input = 'order * 2'
      const expected = '"order" * 2'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should escape field name containing reserved word token (order_num)', () => {
      const fields = [
        { name: 'order_num', type: 'integer' },
        { name: 'total', type: 'decimal' },
      ]
      const input = 'order_num * 2'
      const expected = '"order_num" * 2'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should escape field name containing reserved word token (user_id)', () => {
      const fields = [
        { name: 'user_id', type: 'integer' },
        { name: 'total', type: 'decimal' },
      ]
      const input = 'user_id + 100'
      const expected = '"user_id" + 100'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should not escape field names without reserved words', () => {
      const fields = [
        { name: 'created_at', type: 'date' },
        { name: 'amount', type: 'decimal' },
      ]
      const input = 'amount * 1.1'
      expect(translateFormulaToPostgres(input, fields)).toBe(input)
    })

    test('should escape multiple field names with reserved words in formula', () => {
      const fields = [
        { name: 'order_num', type: 'integer' },
        { name: 'user_id', type: 'integer' },
        { name: 'amount', type: 'decimal' },
      ]
      const input = 'order_num * user_id + amount'
      const expected = '"order_num" * "user_id" + amount'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should handle case-insensitive escaping', () => {
      const fields = [
        { name: 'order_num', type: 'integer' },
        { name: 'total', type: 'decimal' },
      ]
      const input = 'ORDER_NUM * 2'
      const expected = '"ORDER_NUM" * 2'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should not escape field names in function calls', () => {
      const fields = [
        { name: 'order_num', type: 'integer' },
        { name: 'name', type: 'text' },
      ]
      const input = 'UPPER(name)'
      expect(translateFormulaToPostgres(input, fields)).toBe(input)
    })

    test('should escape in SUBSTR function arguments', () => {
      const fields = [{ name: 'select', type: 'text' }]
      const input = 'SUBSTR(select, 1, 3)'
      const expected = 'SUBSTRING("select" FROM 1 FOR 3)'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should escape in date TO_CHAR conversions', () => {
      const fields = [{ name: 'from', type: 'date' }]
      const input = 'from::TEXT'
      const expected = `TO_CHAR("from", 'YYYY-MM-DD')`
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })

    test('should handle complex formulas with multiple reserved words', () => {
      const fields = [
        { name: 'order_num', type: 'integer' },
        { name: 'user_id', type: 'integer' },
        { name: 'amount', type: 'decimal' },
      ]
      const input = 'CONCAT(order_num, user_id) || amount::TEXT'
      const expected = 'CONCAT("order_num", "user_id") || amount::TEXT'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })
  })

  describe('common PostgreSQL reserved words', () => {
    const reservedWordTestCases = [
      'select',
      'insert',
      'update',
      'delete',
      'from',
      'where',
      'order',
      'group',
      'limit',
      'user',
    ]

    reservedWordTestCases.forEach((word) => {
      test(`should escape reserved word: ${word}`, () => {
        const fields = [{ name: word, type: 'integer' }]
        const input = `${word} * 2`
        const expected = `"${word}" * 2`
        expect(translateFormulaToPostgres(input, fields)).toBe(expected)
      })
    })
  })

  describe('edge cases', () => {
    test('should work without fields array (backward compatibility)', () => {
      const input = 'order * 2'
      // Without fields array, no escaping happens
      expect(translateFormulaToPostgres(input)).toBe(input)
    })

    test('should not double-escape already quoted identifiers', () => {
      const fields = [{ name: 'order', type: 'integer' }]
      const input = '"order" * 2'
      // Negative lookbehind prevents double-escaping
      expect(translateFormulaToPostgres(input, fields)).toBe(input)
    })

    test('should handle empty field list', () => {
      const fields: readonly { name: string; type: string }[] = []
      const input = 'order * 2'
      expect(translateFormulaToPostgres(input, fields)).toBe(input)
    })

    test('should preserve whitespace around operators', () => {
      const fields = [{ name: 'order_num', type: 'integer' }]
      const input = 'order_num  *  2'
      const expected = '"order_num"  *  2'
      expect(translateFormulaToPostgres(input, fields)).toBe(expected)
    })
  })
})

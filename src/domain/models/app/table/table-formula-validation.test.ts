/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  SPECIAL_FIELDS,
  extractFieldReferences,
  validateFormulaFields,
} from './table-formula-validation'

describe('SPECIAL_FIELDS', () => {
  test('contains id', () => {
    expect(SPECIAL_FIELDS.has('id')).toBe(true)
  })

  test('contains created_at', () => {
    expect(SPECIAL_FIELDS.has('created_at')).toBe(true)
  })

  test('contains updated_at', () => {
    expect(SPECIAL_FIELDS.has('updated_at')).toBe(true)
  })

  test('contains deleted_at', () => {
    expect(SPECIAL_FIELDS.has('deleted_at')).toBe(true)
  })

  test('has exactly 4 fields', () => {
    expect(SPECIAL_FIELDS.size).toBe(4)
  })
})

describe('extractFieldReferences', () => {
  describe('When formula has simple field references', () => {
    test('Then extracts single field', () => {
      const result = extractFieldReferences('price * 2')
      expect(result).toContain('price')
    })

    test('Then extracts multiple fields', () => {
      const result = extractFieldReferences('price * quantity')
      expect(result).toContain('price')
      expect(result).toContain('quantity')
    })

    test('Then extracts fields with underscores', () => {
      const result = extractFieldReferences('unit_price + tax_rate')
      expect(result).toContain('unit_price')
      expect(result).toContain('tax_rate')
    })

    test('Then extracts fields with numbers', () => {
      const result = extractFieldReferences('field1 + field2')
      expect(result).toContain('field1')
      expect(result).toContain('field2')
    })
  })

  describe('When formula has string literals', () => {
    test('Then excludes single-quoted string content', () => {
      const result = extractFieldReferences("STRPOS(content, 'World')")
      expect(result).toContain('content')
      expect(result).not.toContain('world')
    })

    test('Then excludes double-quoted string content', () => {
      const result = extractFieldReferences('CONCAT(name, " - ", title)')
      expect(result).toContain('name')
      expect(result).toContain('title')
    })
  })

  describe('When formula has SQL functions', () => {
    test('Then excludes COALESCE keyword', () => {
      const result = extractFieldReferences('COALESCE(value, 0)')
      expect(result).toContain('value')
      expect(result).not.toContain('coalesce')
    })

    test('Then excludes UPPER keyword', () => {
      const result = extractFieldReferences('UPPER(name)')
      expect(result).toContain('name')
      expect(result).not.toContain('upper')
    })

    test('Then excludes ROUND keyword', () => {
      const result = extractFieldReferences('ROUND(price, 2)')
      expect(result).toContain('price')
      expect(result).not.toContain('round')
    })

    test('Then excludes CONCAT keyword', () => {
      const result = extractFieldReferences('CONCAT(first_name, last_name)')
      expect(result).toContain('first_name')
      expect(result).toContain('last_name')
      expect(result).not.toContain('concat')
    })
  })

  describe('When formula is complex', () => {
    test('Then handles nested functions', () => {
      const result = extractFieldReferences('ROUND(COALESCE(price, 0) * quantity, 2)')
      expect(result).toContain('price')
      expect(result).toContain('quantity')
      expect(result).not.toContain('round')
      expect(result).not.toContain('coalesce')
    })

    test('Then handles CASE expressions', () => {
      const result = extractFieldReferences('CASE WHEN status THEN amount ELSE 0 END')
      expect(result).toContain('status')
      expect(result).toContain('amount')
      expect(result).not.toContain('case')
      expect(result).not.toContain('when')
      expect(result).not.toContain('then')
      expect(result).not.toContain('else')
      expect(result).not.toContain('end')
    })
  })
})

describe('validateFormulaFields', () => {
  describe('When no formula fields exist', () => {
    test('Then returns undefined for empty fields', () => {
      const result = validateFormulaFields([])
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for non-formula fields only', () => {
      const result = validateFormulaFields([
        { name: 'name', type: 'single-line-text' },
        { name: 'price', type: 'decimal' },
      ])
      expect(result).toBeUndefined()
    })
  })

  describe('When formula syntax is invalid', () => {
    test('Then returns error for consecutive operators', () => {
      const result = validateFormulaFields([
        { name: 'bad_formula', type: 'formula', formula: 'price * * 2' },
      ])
      expect(result).toEqual({
        message: 'Invalid formula syntax: consecutive operators detected',
        path: ['fields'],
      })
    })

    test('Then returns error for unmatched parentheses (open)', () => {
      const result = validateFormulaFields([
        { name: 'bad_formula', type: 'formula', formula: 'ROUND(price' },
      ])
      expect(result).toEqual({
        message: 'Invalid formula syntax: unmatched parentheses',
        path: ['fields'],
      })
    })

    test('Then returns error for unmatched parentheses (close)', () => {
      const result = validateFormulaFields([
        { name: 'bad_formula', type: 'formula', formula: 'price)' },
      ])
      expect(result).toEqual({
        message: 'Invalid formula syntax: unmatched parentheses',
        path: ['fields'],
      })
    })

    test('Then returns error for empty parentheses', () => {
      const result = validateFormulaFields([
        { name: 'bad_formula', type: 'formula', formula: 'FUNC()' },
      ])
      expect(result).toEqual({
        message: 'Invalid formula syntax: empty parentheses',
        path: ['fields'],
      })
    })

    test('Then allows operators in string literals', () => {
      const result = validateFormulaFields([
        { name: 'text', type: 'single-line-text' },
        { name: 'good_formula', type: 'formula', formula: "CONCAT(text, ' + ')" },
      ])
      expect(result).toBeUndefined()
    })
  })

  describe('When formula references non-existent fields', () => {
    test('Then returns error for unknown field', () => {
      const result = validateFormulaFields([
        { name: 'total', type: 'formula', formula: 'missing_field * 2' },
      ])
      expect(result).toEqual({
        message:
          "Invalid field reference: field 'missing_field' not found in formula 'missing_field * 2'",
        path: ['fields'],
      })
    })

    test('Then allows reference to existing fields', () => {
      const result = validateFormulaFields([
        { name: 'price', type: 'decimal' },
        { name: 'quantity', type: 'integer' },
        { name: 'total', type: 'formula', formula: 'price * quantity' },
      ])
      expect(result).toBeUndefined()
    })

    test('Then allows reference to special fields', () => {
      const result = validateFormulaFields([
        {
          name: 'age_days',
          type: 'formula',
          formula: 'EXTRACT(DAY FROM current_timestamp - created_at)',
        },
      ])
      expect(result).toBeUndefined()
    })
  })

  describe('When formula has circular dependencies', () => {
    test('Then returns error for self-reference', () => {
      const result = validateFormulaFields([{ name: 'a', type: 'formula', formula: 'a + 1' }])
      expect(result?.message).toContain('Circular dependency detected')
      expect(result?.path).toEqual(['fields'])
    })

    test('Then returns error for mutual reference (A -> B -> A)', () => {
      const result = validateFormulaFields([
        { name: 'a', type: 'formula', formula: 'b + 1' },
        { name: 'b', type: 'formula', formula: 'a + 1' },
      ])
      expect(result?.message).toContain('Circular dependency detected')
    })

    test('Then returns error for transitive cycle (A -> B -> C -> A)', () => {
      const result = validateFormulaFields([
        { name: 'a', type: 'formula', formula: 'b + 1' },
        { name: 'b', type: 'formula', formula: 'c + 1' },
        { name: 'c', type: 'formula', formula: 'a + 1' },
      ])
      expect(result?.message).toContain('Circular dependency detected')
    })

    test('Then allows non-circular formula chains', () => {
      const result = validateFormulaFields([
        { name: 'base', type: 'decimal' },
        { name: 'a', type: 'formula', formula: 'base * 2' },
        { name: 'b', type: 'formula', formula: 'a + 10' },
        { name: 'c', type: 'formula', formula: 'b / 2' },
      ])
      expect(result).toBeUndefined()
    })
  })

  describe('When validation order matters', () => {
    test('Then syntax errors are reported before field reference errors', () => {
      const result = validateFormulaFields([
        { name: 'bad', type: 'formula', formula: 'missing * * 2' },
      ])
      // Syntax error (consecutive operators) should come before field reference error
      expect(result?.message).toContain('consecutive operators')
    })

    test('Then field reference errors are reported before circular dependency errors', () => {
      const result = validateFormulaFields([{ name: 'a', type: 'formula', formula: 'missing + a' }])
      // Field reference error should come before circular dependency detection
      expect(result?.message).toContain('not found in formula')
    })
  })
})

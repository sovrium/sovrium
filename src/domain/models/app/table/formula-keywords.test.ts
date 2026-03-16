/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  FORMULA_KEYWORDS,
  SQL_KEYWORDS,
  LOGICAL_OPERATORS,
  LITERALS,
  CONTROL_FLOW,
  STRING_FUNCTIONS,
  MATH_FUNCTIONS,
  AGGREGATE_FUNCTIONS,
  DATE_FUNCTIONS,
  DATE_PART_KEYWORDS,
  TYPE_CONVERSIONS,
  DATA_TYPES,
  ARRAY_FUNCTIONS,
  REGEX_FUNCTIONS,
  BINARY_FUNCTIONS,
  KEYWORD_CATEGORIES,
} from './formula-keywords'

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

describe('Categorized Keywords', () => {
  describe('SQL_KEYWORDS', () => {
    test('should be a Set', () => {
      expect(SQL_KEYWORDS).toBeInstanceOf(Set)
    })

    test('should contain query keywords', () => {
      expect(SQL_KEYWORDS.has('select')).toBe(true)
      expect(SQL_KEYWORDS.has('from')).toBe(true)
      expect(SQL_KEYWORDS.has('where')).toBe(true)
      expect(SQL_KEYWORDS.has('join')).toBe(true)
      expect(SQL_KEYWORDS.has('order')).toBe(true)
      expect(SQL_KEYWORDS.has('group')).toBe(true)
    })
  })

  describe('LOGICAL_OPERATORS', () => {
    test('should contain logical operators', () => {
      expect(LOGICAL_OPERATORS.has('and')).toBe(true)
      expect(LOGICAL_OPERATORS.has('or')).toBe(true)
      expect(LOGICAL_OPERATORS.has('not')).toBe(true)
      expect(LOGICAL_OPERATORS.has('if')).toBe(true)
      expect(LOGICAL_OPERATORS.has('then')).toBe(true)
      expect(LOGICAL_OPERATORS.has('else')).toBe(true)
    })
  })

  describe('LITERALS', () => {
    test('should contain boolean and null literals', () => {
      expect(LITERALS.has('true')).toBe(true)
      expect(LITERALS.has('false')).toBe(true)
      expect(LITERALS.has('null')).toBe(true)
    })
  })

  describe('CONTROL_FLOW', () => {
    test('should contain CASE/WHEN/END keywords', () => {
      expect(CONTROL_FLOW.has('case')).toBe(true)
      expect(CONTROL_FLOW.has('when')).toBe(true)
      expect(CONTROL_FLOW.has('end')).toBe(true)
    })
  })

  describe('STRING_FUNCTIONS', () => {
    test('should contain string manipulation functions', () => {
      expect(STRING_FUNCTIONS.has('concat')).toBe(true)
      expect(STRING_FUNCTIONS.has('upper')).toBe(true)
      expect(STRING_FUNCTIONS.has('lower')).toBe(true)
      expect(STRING_FUNCTIONS.has('trim')).toBe(true)
      expect(STRING_FUNCTIONS.has('substring')).toBe(true)
      expect(STRING_FUNCTIONS.has('replace')).toBe(true)
    })
  })

  describe('MATH_FUNCTIONS', () => {
    test('should contain mathematical functions', () => {
      expect(MATH_FUNCTIONS.has('round')).toBe(true)
      expect(MATH_FUNCTIONS.has('ceil')).toBe(true)
      expect(MATH_FUNCTIONS.has('floor')).toBe(true)
      expect(MATH_FUNCTIONS.has('abs')).toBe(true)
      expect(MATH_FUNCTIONS.has('sqrt')).toBe(true)
      expect(MATH_FUNCTIONS.has('power')).toBe(true)
    })
  })

  describe('AGGREGATE_FUNCTIONS', () => {
    test('should contain aggregate functions', () => {
      expect(AGGREGATE_FUNCTIONS.has('sum')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('avg')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('max')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('min')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('count')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('counta')).toBe(true)
      expect(AGGREGATE_FUNCTIONS.has('countall')).toBe(true)
    })
  })

  describe('DATE_FUNCTIONS', () => {
    test('should contain date/time functions', () => {
      expect(DATE_FUNCTIONS.has('now')).toBe(true)
      expect(DATE_FUNCTIONS.has('current_date')).toBe(true)
      expect(DATE_FUNCTIONS.has('current_timestamp')).toBe(true)
      expect(DATE_FUNCTIONS.has('extract')).toBe(true)
      expect(DATE_FUNCTIONS.has('date_trunc')).toBe(true)
      expect(DATE_FUNCTIONS.has('year')).toBe(true)
      expect(DATE_FUNCTIONS.has('month')).toBe(true)
      expect(DATE_FUNCTIONS.has('day')).toBe(true)
    })
  })

  describe('DATE_PART_KEYWORDS', () => {
    test('should contain date part keywords', () => {
      expect(DATE_PART_KEYWORDS.has('dow')).toBe(true)
      expect(DATE_PART_KEYWORDS.has('week')).toBe(true)
      expect(DATE_PART_KEYWORDS.has('epoch')).toBe(true)
      expect(DATE_PART_KEYWORDS.has('quarter')).toBe(true)
    })
  })

  describe('TYPE_CONVERSIONS', () => {
    test('should contain type conversion functions', () => {
      expect(TYPE_CONVERSIONS.has('cast')).toBe(true)
      expect(TYPE_CONVERSIONS.has('coalesce')).toBe(true)
      expect(TYPE_CONVERSIONS.has('nullif')).toBe(true)
    })
  })

  describe('DATA_TYPES', () => {
    test('should contain PostgreSQL data types', () => {
      expect(DATA_TYPES.has('numeric')).toBe(true)
      expect(DATA_TYPES.has('integer')).toBe(true)
      expect(DATA_TYPES.has('text')).toBe(true)
      expect(DATA_TYPES.has('varchar')).toBe(true)
      expect(DATA_TYPES.has('boolean')).toBe(true)
      expect(DATA_TYPES.has('date')).toBe(true)
      expect(DATA_TYPES.has('timestamp')).toBe(true)
    })
  })

  describe('ARRAY_FUNCTIONS', () => {
    test('should contain array functions', () => {
      expect(ARRAY_FUNCTIONS.has('array')).toBe(true)
      expect(ARRAY_FUNCTIONS.has('array_length')).toBe(true)
      expect(ARRAY_FUNCTIONS.has('unnest')).toBe(true)
      expect(ARRAY_FUNCTIONS.has('cardinality')).toBe(true)
    })
  })

  describe('REGEX_FUNCTIONS', () => {
    test('should contain regex functions', () => {
      expect(REGEX_FUNCTIONS.has('regexp_match')).toBe(true)
      expect(REGEX_FUNCTIONS.has('regexp_replace')).toBe(true)
    })
  })

  describe('BINARY_FUNCTIONS', () => {
    test('should contain binary/encoding functions', () => {
      expect(BINARY_FUNCTIONS.has('convert_from')).toBe(true)
    })
  })
})

describe('KEYWORD_CATEGORIES', () => {
  test('should contain all categories', () => {
    expect(KEYWORD_CATEGORIES).toHaveProperty('SQL_KEYWORDS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('LOGICAL_OPERATORS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('LITERALS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('CONTROL_FLOW')
    expect(KEYWORD_CATEGORIES).toHaveProperty('STRING_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('MATH_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('AGGREGATE_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('DATE_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('DATE_PART_KEYWORDS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('TYPE_CONVERSIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('DATA_TYPES')
    expect(KEYWORD_CATEGORIES).toHaveProperty('ARRAY_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('REGEX_FUNCTIONS')
    expect(KEYWORD_CATEGORIES).toHaveProperty('BINARY_FUNCTIONS')
  })

  test('FORMULA_KEYWORDS should be the union of all categories', () => {
    // Calculate expected total from all categories
    const allCategories = Object.values(KEYWORD_CATEGORIES)
    const allKeywords = new Set(allCategories.flatMap((set) => [...set]))

    // FORMULA_KEYWORDS should have the same size and content
    expect(FORMULA_KEYWORDS.size).toBe(allKeywords.size)

    // Every keyword in FORMULA_KEYWORDS should be in one of the categories
    for (const keyword of FORMULA_KEYWORDS) {
      expect(allKeywords.has(keyword)).toBe(true)
    }

    // Every keyword in categories should be in FORMULA_KEYWORDS
    for (const keyword of allKeywords) {
      expect(FORMULA_KEYWORDS.has(keyword)).toBe(true)
    }
  })
})

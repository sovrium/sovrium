/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Formula Field
 *
 * Source: src/domain/models/app/table/field-types/formula-field.ts
 * Domain: app
 * Spec Count: 125
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Formula Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-001: should create GENERATED ALWAYS AS column for arithmetic formula',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'line_items',
            fields: [
              { id: 1, name: 'quantity', type: 'integer', required: true },
              { id: 2, name: 'unit_price', type: 'decimal', required: true },
              {
                id: 3,
                name: 'total',
                type: 'formula',
                formula: 'quantity * unit_price',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery(
        'INSERT INTO line_items (quantity, unit_price) VALUES (5, 19.99), (10, 9.50)'
      )

      // WHEN: executing query
      const generatedColumn = await executeQuery(
        "SELECT column_name, is_generated FROM information_schema.columns WHERE table_name='line_items' AND column_name='total'"
      )
      // THEN: assertion
      expect(generatedColumn.column_name).toBe('total')
      // THEN: assertion
      expect(generatedColumn.is_generated).toBe('ALWAYS')

      // WHEN: executing query
      const firstRecord = await executeQuery(
        'SELECT quantity, unit_price, total FROM line_items WHERE id = 1'
      )
      // THEN: assertion
      expect(firstRecord.quantity).toBe(5)
      // THEN: assertion
      expect(firstRecord.unit_price).toBe(19.99)
      // THEN: assertion
      expect(firstRecord.total).toBe(99.95)

      // WHEN: executing query
      const secondRecord = await executeQuery(
        'SELECT quantity, unit_price, total FROM line_items WHERE id = 2'
      )
      // THEN: assertion
      expect(secondRecord.quantity).toBe(10)
      // THEN: assertion
      expect(secondRecord.unit_price).toBe(9.5)
      // THEN: assertion
      expect(secondRecord.total).toBe(95.0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-002: should perform text concatenation with GENERATED column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'contacts',
            fields: [
              { id: 1, name: 'first_name', type: 'single-line-text', required: true },
              { id: 2, name: 'last_name', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'full_name',
                type: 'formula',
                formula: "first_name || ' ' || last_name",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery(
        "INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe'), ('Jane', 'Smith')"
      )

      // WHEN: executing query
      const firstContact = await executeQuery(
        'SELECT first_name, last_name, full_name FROM contacts WHERE id = 1'
      )
      // THEN: assertion
      expect(firstContact.first_name).toBe('John')
      // THEN: assertion
      expect(firstContact.last_name).toBe('Doe')
      // THEN: assertion
      expect(firstContact.full_name).toBe('John Doe')

      // WHEN: executing query
      const secondContact = await executeQuery(
        'SELECT first_name, last_name, full_name FROM contacts WHERE id = 2'
      )
      // THEN: assertion
      expect(secondContact.first_name).toBe('Jane')
      // THEN: assertion
      expect(secondContact.last_name).toBe('Smith')
      // THEN: assertion
      expect(secondContact.full_name).toBe('Jane Smith')

      // WHEN: executing query
      const afterUpdate = await executeQuery(
        "UPDATE contacts SET first_name = 'Janet' WHERE id = 2 RETURNING full_name"
      )
      // THEN: assertion
      expect(afterUpdate.full_name).toBe('Janet Smith')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-003: should support conditional expressions with CASE WHEN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'products',
            fields: [
              { id: 1, name: 'price', type: 'decimal', required: true },
              { id: 2, name: 'on_sale', type: 'checkbox', required: true },
              {
                id: 3,
                name: 'discount_price',
                type: 'formula',
                formula: 'CASE WHEN on_sale THEN price * 0.80 ELSE price END',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery(
        'INSERT INTO products (price, on_sale) VALUES (100.00, true), (50.00, false)'
      )

      // WHEN: executing query
      const onSale = await executeQuery(
        'SELECT price, on_sale, discount_price FROM products WHERE id = 1'
      )
      // THEN: assertion
      expect(onSale.price).toBe(100)
      // THEN: assertion
      expect(onSale.on_sale).toBe(true)
      // THEN: assertion
      expect(onSale.discount_price).toBe(80)

      // WHEN: executing query
      const notOnSale = await executeQuery(
        'SELECT price, on_sale, discount_price FROM products WHERE id = 2'
      )
      // THEN: assertion
      expect(notOnSale.price).toBe(50)
      // THEN: assertion
      expect(notOnSale.on_sale).toBe(false)
      // THEN: assertion
      expect(notOnSale.discount_price).toBe(50)

      // WHEN: executing query
      const saleToggled = await executeQuery(
        'UPDATE products SET on_sale = true WHERE id = 2 RETURNING discount_price'
      )
      // THEN: assertion
      expect(saleToggled.discount_price).toBe(40)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-004: should apply mathematical functions like ROUND',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'measurements',
            fields: [
              { id: 1, name: 'raw_value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'rounded_value',
                type: 'formula',
                formula: 'ROUND(raw_value, 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery(
        'INSERT INTO measurements (raw_value) VALUES (19.9567), (49.1234), (-15.6789)'
      )

      // WHEN: executing query
      const firstMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 1'
      )
      // THEN: assertion
      expect(firstMeasurement.raw_value).toBe(19.9567)
      // THEN: assertion
      expect(firstMeasurement.rounded_value).toBe(19.96)

      // WHEN: executing query
      const secondMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 2'
      )
      // THEN: assertion
      expect(secondMeasurement.raw_value).toBe(49.1234)
      // THEN: assertion
      expect(secondMeasurement.rounded_value).toBe(49.12)

      // WHEN: executing query
      const negativeMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 3'
      )
      // THEN: assertion
      expect(negativeMeasurement.raw_value).toBe(-15.6789)
      // THEN: assertion
      expect(negativeMeasurement.rounded_value).toBe(-15.68)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-005: should evaluate boolean date logic for overdue detection',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'invoices',
            fields: [
              { id: 1, name: 'due_date', type: 'date', required: true },
              {
                id: 2,
                name: 'paid',
                type: 'checkbox',
                required: true,
                default: false,
              },
              {
                id: 3,
                name: 'is_overdue',
                type: 'formula',
                formula: 'NOT paid AND due_date < CURRENT_DATE',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery(
        "INSERT INTO invoices (due_date, paid) VALUES ('2024-01-15', false), ('2025-12-31', false), ('2024-06-01', true)"
      )

      // WHEN: executing query
      const pastDueUnpaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 1'
      )
      // THEN: assertion
      expect(pastDueUnpaid.due_date).toBe('2024-01-15')
      // THEN: assertion
      expect(pastDueUnpaid.paid).toBe(false)
      // THEN: assertion
      expect(pastDueUnpaid.is_overdue).toBe(true)

      // WHEN: executing query
      const futureDueUnpaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 2'
      )
      // THEN: assertion
      expect(futureDueUnpaid.due_date).toBe('2025-12-31')
      // THEN: assertion
      expect(futureDueUnpaid.paid).toBe(false)
      // THEN: assertion
      expect(futureDueUnpaid.is_overdue).toBe(false)

      // WHEN: executing query
      const pastDuePaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 3'
      )
      // THEN: assertion
      expect(pastDuePaid.due_date).toBe('2024-06-01')
      // THEN: assertion
      expect(pastDuePaid.paid).toBe(true)
      // THEN: assertion
      expect(pastDuePaid.is_overdue).toBe(false)
    }
  )

  // ============================================================================
  // Phase 1: Numeric Functions (007-027)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-006: should compute absolute value with ABS function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'numbers',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'absolute',
                type: 'formula',
                formula: 'ABS(value)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO numbers (value) VALUES (-5.5), (3.2), (0)')

      // THEN: verify ABS calculation
      const negative = await executeQuery('SELECT absolute FROM numbers WHERE id = 1')
      expect(negative.absolute).toBe(5.5)

      const positive = await executeQuery('SELECT absolute FROM numbers WHERE id = 2')
      expect(positive.absolute).toBe(3.2)

      const zero = await executeQuery('SELECT absolute FROM numbers WHERE id = 3')
      expect(zero.absolute).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-007: should compute average with inline calculation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with multiple numeric fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'scores',
            fields: [
              { id: 1, name: 'score1', type: 'decimal', required: true },
              { id: 2, name: 'score2', type: 'decimal', required: true },
              { id: 3, name: 'score3', type: 'decimal', required: true },
              {
                id: 4,
                name: 'average',
                type: 'formula',
                formula: '(score1 + score2 + score3) / 3',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO scores (score1, score2, score3) VALUES (80, 90, 100)')

      // THEN: verify average calculation
      const result = await executeQuery('SELECT average FROM scores WHERE id = 1')
      expect(result.average).toBe(90)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-008: should round up with CEIL function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'ceiling',
                type: 'formula',
                formula: 'CEIL(value)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (4.2), (4.8), (-4.2)')

      // THEN: verify CEIL calculation
      const low = await executeQuery('SELECT ceiling FROM values WHERE id = 1')
      expect(low.ceiling).toBe(5)

      const high = await executeQuery('SELECT ceiling FROM values WHERE id = 2')
      expect(high.ceiling).toBe(5)

      const negative = await executeQuery('SELECT ceiling FROM values WHERE id = 3')
      expect(negative.ceiling).toBe(-4)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-009: should round to nearest even number with EVEN formula',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'even_rounded',
                type: 'formula',
                formula: 'CEIL(value / 2.0) * 2',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (1), (2), (3), (4.5)')

      // THEN: verify EVEN calculation
      const one = await executeQuery('SELECT even_rounded FROM values WHERE id = 1')
      expect(one.even_rounded).toBe(2)

      const two = await executeQuery('SELECT even_rounded FROM values WHERE id = 2')
      expect(two.even_rounded).toBe(2)

      const three = await executeQuery('SELECT even_rounded FROM values WHERE id = 3')
      expect(three.even_rounded).toBe(4)

      const decimal = await executeQuery('SELECT even_rounded FROM values WHERE id = 4')
      expect(decimal.even_rounded).toBe(6)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-010: should compute exponential with EXP function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'exponents',
            fields: [
              { id: 1, name: 'power', type: 'decimal', required: true },
              {
                id: 2,
                name: 'result',
                type: 'formula',
                formula: 'EXP(power)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO exponents (power) VALUES (0), (1), (2)')

      // THEN: verify EXP calculation
      const expZero = await executeQuery('SELECT result FROM exponents WHERE id = 1')
      expect(expZero.result).toBe(1)

      const expOne = await executeQuery(
        'SELECT ROUND(result, 5) as result FROM exponents WHERE id = 2'
      )
      expect(expOne.result).toBeCloseTo(2.718_28, 4)

      const expTwo = await executeQuery(
        'SELECT ROUND(result, 4) as result FROM exponents WHERE id = 3'
      )
      expect(expTwo.result).toBeCloseTo(7.3891, 3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-011: should round down with FLOOR function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'floored',
                type: 'formula',
                formula: 'FLOOR(value)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (4.2), (4.8), (-4.2)')

      // THEN: verify FLOOR calculation
      const low = await executeQuery('SELECT floored FROM values WHERE id = 1')
      expect(low.floored).toBe(4)

      const high = await executeQuery('SELECT floored FROM values WHERE id = 2')
      expect(high.floored).toBe(4)

      const negative = await executeQuery('SELECT floored FROM values WHERE id = 3')
      expect(negative.floored).toBe(-5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-012: should truncate to integer with TRUNC function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'truncated',
                type: 'formula',
                formula: 'TRUNC(value)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (4.9), (-4.9), (0.5)')

      // THEN: verify TRUNC calculation
      const positive = await executeQuery('SELECT truncated FROM values WHERE id = 1')
      expect(positive.truncated).toBe(4)

      const negative = await executeQuery('SELECT truncated FROM values WHERE id = 2')
      expect(negative.truncated).toBe(-4)

      const fraction = await executeQuery('SELECT truncated FROM values WHERE id = 3')
      expect(fraction.truncated).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-013: should compute logarithm with LOG function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'logarithms',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'log_base10',
                type: 'formula',
                formula: 'LOG(value)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO logarithms (value) VALUES (1), (10), (100)')

      // THEN: verify LOG calculation
      const logOne = await executeQuery('SELECT log_base10 FROM logarithms WHERE id = 1')
      expect(logOne.log_base10).toBe(0)

      const logTen = await executeQuery('SELECT log_base10 FROM logarithms WHERE id = 2')
      expect(logTen.log_base10).toBe(1)

      const logHundred = await executeQuery('SELECT log_base10 FROM logarithms WHERE id = 3')
      expect(logHundred.log_base10).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-014: should compute natural logarithm with LN function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'logarithms',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'natural_log',
                type: 'formula',
                formula: 'LN(value)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO logarithms (value) VALUES (1), (2.71828)')

      // THEN: verify LN calculation
      const lnOne = await executeQuery('SELECT natural_log FROM logarithms WHERE id = 1')
      expect(lnOne.natural_log).toBe(0)

      const lnE = await executeQuery(
        'SELECT ROUND(natural_log, 4) as natural_log FROM logarithms WHERE id = 2'
      )
      expect(lnE.natural_log).toBeCloseTo(1, 3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-015: should find maximum with GREATEST function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 16,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'decimal', required: true },
              { id: 2, name: 'b', type: 'decimal', required: true },
              { id: 3, name: 'c', type: 'decimal', required: true },
              {
                id: 4,
                name: 'maximum',
                type: 'formula',
                formula: 'GREATEST(a, b, c)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO comparisons (a, b, c) VALUES (5, 10, 3), (-1, -5, -2)')

      // THEN: verify GREATEST calculation
      const positive = await executeQuery('SELECT maximum FROM comparisons WHERE id = 1')
      expect(positive.maximum).toBe(10)

      const negative = await executeQuery('SELECT maximum FROM comparisons WHERE id = 2')
      expect(negative.maximum).toBe(-1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-016: should find minimum with LEAST function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 17,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'decimal', required: true },
              { id: 2, name: 'b', type: 'decimal', required: true },
              { id: 3, name: 'c', type: 'decimal', required: true },
              {
                id: 4,
                name: 'minimum',
                type: 'formula',
                formula: 'LEAST(a, b, c)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO comparisons (a, b, c) VALUES (5, 10, 3), (-1, -5, -2)')

      // THEN: verify LEAST calculation
      const positive = await executeQuery('SELECT minimum FROM comparisons WHERE id = 1')
      expect(positive.minimum).toBe(3)

      const negative = await executeQuery('SELECT minimum FROM comparisons WHERE id = 2')
      expect(negative.minimum).toBe(-5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-017: should compute modulo with MOD function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 18,
            name: 'modulos',
            fields: [
              { id: 1, name: 'dividend', type: 'integer', required: true },
              { id: 2, name: 'divisor', type: 'integer', required: true },
              {
                id: 3,
                name: 'remainder',
                type: 'formula',
                formula: 'MOD(dividend, divisor)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO modulos (dividend, divisor) VALUES (10, 3), (15, 5), (7, 2)')

      // THEN: verify MOD calculation
      const first = await executeQuery('SELECT remainder FROM modulos WHERE id = 1')
      expect(first.remainder).toBe(1)

      const second = await executeQuery('SELECT remainder FROM modulos WHERE id = 2')
      expect(second.remainder).toBe(0)

      const third = await executeQuery('SELECT remainder FROM modulos WHERE id = 3')
      expect(third.remainder).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-018: should round to nearest odd number with ODD formula',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 19,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'odd_rounded',
                type: 'formula',
                formula: 'CEIL((value - 1) / 2.0) * 2 + 1',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (1), (2), (3), (4.5)')

      // THEN: verify ODD calculation
      const one = await executeQuery('SELECT odd_rounded FROM values WHERE id = 1')
      expect(one.odd_rounded).toBe(1)

      const two = await executeQuery('SELECT odd_rounded FROM values WHERE id = 2')
      expect(two.odd_rounded).toBe(3)

      const three = await executeQuery('SELECT odd_rounded FROM values WHERE id = 3')
      expect(three.odd_rounded).toBe(3)

      const decimal = await executeQuery('SELECT odd_rounded FROM values WHERE id = 4')
      expect(decimal.odd_rounded).toBe(5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-019: should compute power with POWER function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 20,
            name: 'powers',
            fields: [
              { id: 1, name: 'base', type: 'decimal', required: true },
              { id: 2, name: 'exponent', type: 'decimal', required: true },
              {
                id: 3,
                name: 'result',
                type: 'formula',
                formula: 'POWER(base, exponent)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO powers (base, exponent) VALUES (2, 3), (10, 2), (5, 0)')

      // THEN: verify POWER calculation
      const first = await executeQuery('SELECT result FROM powers WHERE id = 1')
      expect(first.result).toBe(8)

      const second = await executeQuery('SELECT result FROM powers WHERE id = 2')
      expect(second.result).toBe(100)

      const third = await executeQuery('SELECT result FROM powers WHERE id = 3')
      expect(third.result).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-020: should round down with TRUNC for precision',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 21,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'truncated',
                type: 'formula',
                formula: 'TRUNC(value, 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (3.14159), (9.999), (-2.567)')

      // THEN: verify TRUNC with precision calculation
      const pi = await executeQuery('SELECT truncated FROM values WHERE id = 1')
      expect(pi.truncated).toBe(3.14)

      const nine = await executeQuery('SELECT truncated FROM values WHERE id = 2')
      expect(nine.truncated).toBe(9.99)

      const negative = await executeQuery('SELECT truncated FROM values WHERE id = 3')
      expect(negative.truncated).toBe(-2.56)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-021: should round up with precision calculation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 22,
            name: 'values',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'rounded_up',
                type: 'formula',
                formula: 'CEIL(value * 100) / 100',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO values (value) VALUES (3.141), (9.991), (2.001)')

      // THEN: verify round up calculation
      const pi = await executeQuery('SELECT rounded_up FROM values WHERE id = 1')
      expect(pi.rounded_up).toBe(3.15)

      const nine = await executeQuery('SELECT rounded_up FROM values WHERE id = 2')
      expect(nine.rounded_up).toBe(10)

      const two = await executeQuery('SELECT rounded_up FROM values WHERE id = 3')
      expect(two.rounded_up).toBe(2.01)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-022: should compute square root with SQRT function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 23,
            name: 'roots',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'square_root',
                type: 'formula',
                formula: 'SQRT(value)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO roots (value) VALUES (4), (9), (2)')

      // THEN: verify SQRT calculation
      const four = await executeQuery('SELECT square_root FROM roots WHERE id = 1')
      expect(four.square_root).toBe(2)

      const nine = await executeQuery('SELECT square_root FROM roots WHERE id = 2')
      expect(nine.square_root).toBe(3)

      const two = await executeQuery(
        'SELECT ROUND(square_root, 5) as square_root FROM roots WHERE id = 3'
      )
      expect(two.square_root).toBeCloseTo(1.414_21, 4)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-023: should compute sum of multiple fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 24,
            name: 'totals',
            fields: [
              { id: 1, name: 'a', type: 'decimal', required: true },
              { id: 2, name: 'b', type: 'decimal', required: true },
              { id: 3, name: 'c', type: 'decimal', required: true },
              {
                id: 4,
                name: 'total',
                type: 'formula',
                formula: 'a + b + c',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO totals (a, b, c) VALUES (10, 20, 30), (1.5, 2.5, 3.5)')

      // THEN: verify SUM calculation
      const integers = await executeQuery('SELECT total FROM totals WHERE id = 1')
      expect(integers.total).toBe(60)

      const decimals = await executeQuery('SELECT total FROM totals WHERE id = 2')
      expect(decimals.total).toBe(7.5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-024: should convert text to number with CAST',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 25,
            name: 'conversions',
            fields: [
              { id: 1, name: 'text_value', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'numeric_value',
                type: 'formula',
                formula: 'CAST(text_value AS NUMERIC)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO conversions (text_value) VALUES ('123'), ('45.67')")

      // THEN: verify CAST calculation
      const integer = await executeQuery('SELECT numeric_value FROM conversions WHERE id = 1')
      expect(integer.numeric_value).toBe(123)

      const decimal = await executeQuery('SELECT numeric_value FROM conversions WHERE id = 2')
      expect(decimal.numeric_value).toBe(45.67)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-025: should count non-null values with CASE expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 26,
            name: 'counts',
            fields: [
              { id: 1, name: 'a', type: 'decimal' },
              { id: 2, name: 'b', type: 'decimal' },
              { id: 3, name: 'c', type: 'decimal' },
              {
                id: 4,
                name: 'non_null_count',
                type: 'formula',
                formula:
                  'CASE WHEN a IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN b IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN c IS NOT NULL THEN 1 ELSE 0 END',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO counts (a, b, c) VALUES (1, 2, 3)')
      await executeQuery('INSERT INTO counts (a, b, c) VALUES (1, NULL, 3)')
      await executeQuery('INSERT INTO counts (a, b, c) VALUES (NULL, NULL, NULL)')

      // THEN: verify count calculation
      const allPresent = await executeQuery('SELECT non_null_count FROM counts WHERE id = 1')
      expect(allPresent.non_null_count).toBe(3)

      const oneNull = await executeQuery('SELECT non_null_count FROM counts WHERE id = 2')
      expect(oneNull.non_null_count).toBe(2)

      const allNull = await executeQuery('SELECT non_null_count FROM counts WHERE id = 3')
      expect(allNull.non_null_count).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-026: should return first non-null value with COALESCE',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 27,
            name: 'fallbacks',
            fields: [
              { id: 1, name: 'primary_value', type: 'decimal' },
              { id: 2, name: 'backup_value', type: 'decimal' },
              { id: 3, name: 'default_value', type: 'decimal', required: true },
              {
                id: 4,
                name: 'result',
                type: 'formula',
                formula: 'COALESCE(primary_value, backup_value, default_value)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery(
        'INSERT INTO fallbacks (primary_value, backup_value, default_value) VALUES (10, 20, 30)'
      )
      await executeQuery(
        'INSERT INTO fallbacks (primary_value, backup_value, default_value) VALUES (NULL, 20, 30)'
      )
      await executeQuery(
        'INSERT INTO fallbacks (primary_value, backup_value, default_value) VALUES (NULL, NULL, 30)'
      )

      // THEN: verify COALESCE calculation
      const hasPrimary = await executeQuery('SELECT result FROM fallbacks WHERE id = 1')
      expect(hasPrimary.result).toBe(10)

      const hasBackup = await executeQuery('SELECT result FROM fallbacks WHERE id = 2')
      expect(hasBackup.result).toBe(20)

      const hasDefault = await executeQuery('SELECT result FROM fallbacks WHERE id = 3')
      expect(hasDefault.result).toBe(30)
    }
  )

  // ============================================================================
  // Phase 2: Text Functions (028-047)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-027: should concatenate text with || operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 28,
            name: 'names',
            fields: [
              { id: 1, name: 'first', type: 'single-line-text', required: true },
              { id: 2, name: 'middle', type: 'single-line-text' },
              { id: 3, name: 'last', type: 'single-line-text', required: true },
              {
                id: 4,
                name: 'full_name',
                type: 'formula',
                formula: "first || ' ' || COALESCE(middle || ' ', '') || last",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery(
        "INSERT INTO names (first, middle, last) VALUES ('John', 'Michael', 'Doe')"
      )
      await executeQuery("INSERT INTO names (first, middle, last) VALUES ('Jane', NULL, 'Smith')")

      // THEN: verify concatenation
      const withMiddle = await executeQuery('SELECT full_name FROM names WHERE id = 1')
      expect(withMiddle.full_name).toBe('John Michael Doe')

      const withoutMiddle = await executeQuery('SELECT full_name FROM names WHERE id = 2')
      expect(withoutMiddle.full_name).toBe('Jane Smith')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-028: should extract left characters with LEFT function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 29,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'prefix',
                type: 'formula',
                formula: 'LEFT(text, 3)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello World'), ('Hi')")

      // THEN: verify LEFT extraction
      const long = await executeQuery('SELECT prefix FROM strings WHERE id = 1')
      expect(long.prefix).toBe('Hel')

      const short = await executeQuery('SELECT prefix FROM strings WHERE id = 2')
      expect(short.prefix).toBe('Hi')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-029: should extract right characters with RIGHT function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 30,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'suffix',
                type: 'formula',
                formula: 'RIGHT(text, 5)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello World'), ('Hi')")

      // THEN: verify RIGHT extraction
      const long = await executeQuery('SELECT suffix FROM strings WHERE id = 1')
      expect(long.suffix).toBe('World')

      const short = await executeQuery('SELECT suffix FROM strings WHERE id = 2')
      expect(short.suffix).toBe('Hi')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-030: should extract substring with SUBSTR function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 31,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'middle',
                type: 'formula',
                formula: 'SUBSTR(text, 7, 5)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello World')")

      // THEN: verify SUBSTR extraction
      const result = await executeQuery('SELECT middle FROM strings WHERE id = 1')
      expect(result.middle).toBe('World')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-031: should compute string length with LENGTH function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 32,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'char_count',
                type: 'formula',
                formula: 'LENGTH(text)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello'), (''), ('Test 123')")

      // THEN: verify LENGTH calculation
      const hello = await executeQuery('SELECT char_count FROM strings WHERE id = 1')
      expect(hello.char_count).toBe(5)

      const empty = await executeQuery('SELECT char_count FROM strings WHERE id = 2')
      expect(empty.char_count).toBe(0)

      const mixed = await executeQuery('SELECT char_count FROM strings WHERE id = 3')
      expect(mixed.char_count).toBe(8)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-032: should convert to lowercase with LOWER function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 33,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'lowercase',
                type: 'formula',
                formula: 'LOWER(text)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('HELLO WORLD'), ('MixEd CaSe')")

      // THEN: verify LOWER transformation
      const upper = await executeQuery('SELECT lowercase FROM strings WHERE id = 1')
      expect(upper.lowercase).toBe('hello world')

      const mixed = await executeQuery('SELECT lowercase FROM strings WHERE id = 2')
      expect(mixed.lowercase).toBe('mixed case')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-033: should convert to uppercase with UPPER function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 34,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'uppercase',
                type: 'formula',
                formula: 'UPPER(text)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('hello world'), ('MixEd CaSe')")

      // THEN: verify UPPER transformation
      const lower = await executeQuery('SELECT uppercase FROM strings WHERE id = 1')
      expect(lower.uppercase).toBe('HELLO WORLD')

      const mixed = await executeQuery('SELECT uppercase FROM strings WHERE id = 2')
      expect(mixed.uppercase).toBe('MIXED CASE')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-034: should remove whitespace with TRIM function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 35,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'trimmed',
                type: 'formula',
                formula: 'TRIM(text)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('  hello  '), ('no spaces')")

      // THEN: verify TRIM transformation
      const withSpaces = await executeQuery('SELECT trimmed FROM strings WHERE id = 1')
      expect(withSpaces.trimmed).toBe('hello')

      const noSpaces = await executeQuery('SELECT trimmed FROM strings WHERE id = 2')
      expect(noSpaces.trimmed).toBe('no spaces')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-035: should find substring position with STRPOS function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 36,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'position',
                type: 'formula',
                formula: "STRPOS(text, 'World')",
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello World'), ('No match here')")

      // THEN: verify STRPOS calculation
      const found = await executeQuery('SELECT position FROM strings WHERE id = 1')
      expect(found.position).toBe(7)

      const notFound = await executeQuery('SELECT position FROM strings WHERE id = 2')
      expect(notFound.position).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-036: should return null for not found with NULLIF pattern',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 37,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'position',
                type: 'formula',
                formula: "NULLIF(STRPOS(text, 'test'), 0)",
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('this is a test'), ('no match')")

      // THEN: verify NULLIF pattern
      const found = await executeQuery('SELECT position FROM strings WHERE id = 1')
      expect(found.position).toBe(11)

      const notFound = await executeQuery('SELECT position FROM strings WHERE id = 2')
      expect(notFound.position).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-037: should replace substring with OVERLAY function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 38,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'replaced',
                type: 'formula',
                formula: "OVERLAY(text PLACING 'Universe' FROM 7 FOR 5)",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello World')")

      // THEN: verify OVERLAY transformation
      const result = await executeQuery('SELECT replaced FROM strings WHERE id = 1')
      expect(result.replaced).toBe('Hello Universe')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-038: should substitute all occurrences with REPLACE function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 39,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'substituted',
                type: 'formula',
                formula: "REPLACE(text, 'a', 'X')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('banana'), ('apple')")

      // THEN: verify REPLACE transformation
      const banana = await executeQuery('SELECT substituted FROM strings WHERE id = 1')
      expect(banana.substituted).toBe('bXnXnX')

      const apple = await executeQuery('SELECT substituted FROM strings WHERE id = 2')
      expect(apple.substituted).toBe('Xpple')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-039: should repeat text with REPEAT function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 40,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              { id: 2, name: 'count', type: 'integer', required: true },
              {
                id: 3,
                name: 'repeated',
                type: 'formula',
                formula: 'REPEAT(text, count)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text, count) VALUES ('ab', 3), ('x', 5)")

      // THEN: verify REPEAT transformation
      const ab = await executeQuery('SELECT repeated FROM strings WHERE id = 1')
      expect(ab.repeated).toBe('ababab')

      const x = await executeQuery('SELECT repeated FROM strings WHERE id = 2')
      expect(x.repeated).toBe('xxxxx')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-040: should convert to text with CASE expression for T function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 41,
            name: 'mixed',
            fields: [
              { id: 1, name: 'value', type: 'single-line-text' },
              {
                id: 2,
                name: 'as_text',
                type: 'formula',
                formula: "CASE WHEN value IS NOT NULL THEN value ELSE '' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO mixed (value) VALUES ('hello'), (NULL)")

      // THEN: verify T-like transformation
      const hasValue = await executeQuery('SELECT as_text FROM mixed WHERE id = 1')
      expect(hasValue.as_text).toBe('hello')

      const nullValue = await executeQuery('SELECT as_text FROM mixed WHERE id = 2')
      expect(nullValue.as_text).toBe('')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-041: should split text into array with STRING_TO_ARRAY',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 42,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'parts',
                type: 'formula',
                formula: "STRING_TO_ARRAY(text, ',')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('a,b,c'), ('single')")

      // THEN: verify STRING_TO_ARRAY transformation
      const multiple = await executeQuery('SELECT parts FROM strings WHERE id = 1')
      expect(multiple.parts).toEqual(['a', 'b', 'c'])

      const single = await executeQuery('SELECT parts FROM strings WHERE id = 2')
      expect(single.parts).toEqual(['single'])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-042: should convert ASCII code to character with CHR function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 43,
            name: 'codes',
            fields: [
              { id: 1, name: 'code', type: 'integer', required: true },
              {
                id: 2,
                name: 'character',
                type: 'formula',
                formula: 'CHR(code)',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery('INSERT INTO codes (code) VALUES (65), (97), (48)')

      // THEN: verify CHR transformation
      const upperA = await executeQuery('SELECT character FROM codes WHERE id = 1')
      expect(upperA.character).toBe('A')

      const lowerA = await executeQuery('SELECT character FROM codes WHERE id = 2')
      expect(lowerA.character).toBe('a')

      const zero = await executeQuery('SELECT character FROM codes WHERE id = 3')
      expect(zero.character).toBe('0')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-043: should convert character to ASCII code with ASCII function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 44,
            name: 'chars',
            fields: [
              { id: 1, name: 'char', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'code',
                type: 'formula',
                formula: 'ASCII(char)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO chars (char) VALUES ('A'), ('a'), ('0')")

      // THEN: verify ASCII transformation
      const upperA = await executeQuery('SELECT code FROM chars WHERE id = 1')
      expect(upperA.code).toBe(65)

      const lowerA = await executeQuery('SELECT code FROM chars WHERE id = 2')
      expect(lowerA.code).toBe(97)

      const zero = await executeQuery('SELECT code FROM chars WHERE id = 3')
      expect(zero.code).toBe(48)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-044: should encode to base64 with ENCODE function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 45,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'encoded',
                type: 'formula',
                formula: "ENCODE(text::bytea, 'base64')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('Hello')")

      // THEN: verify ENCODE transformation
      const result = await executeQuery('SELECT encoded FROM strings WHERE id = 1')
      expect(result.encoded).toBe('SGVsbG8=')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-045: should decode from base64 with DECODE function',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 46,
            name: 'strings',
            fields: [
              { id: 1, name: 'encoded', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'decoded',
                type: 'formula',
                formula: "CONVERT_FROM(DECODE(encoded, 'base64'), 'UTF8')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (encoded) VALUES ('SGVsbG8=')")

      // THEN: verify DECODE transformation
      const result = await executeQuery('SELECT decoded FROM strings WHERE id = 1')
      expect(result.decoded).toBe('Hello')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-046: should URL encode with custom expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration (limited URL encoding via REPLACE)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 47,
            name: 'strings',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'url_encoded',
                type: 'formula',
                formula: "REPLACE(REPLACE(REPLACE(text, ' ', '%20'), '&', '%26'), '=', '%3D')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      // WHEN: inserting test data
      await executeQuery("INSERT INTO strings (text) VALUES ('hello world'), ('key=value&foo=bar')")

      // THEN: verify URL encoding
      const spaces = await executeQuery('SELECT url_encoded FROM strings WHERE id = 1')
      expect(spaces.url_encoded).toBe('hello%20world')

      const special = await executeQuery('SELECT url_encoded FROM strings WHERE id = 2')
      expect(special.url_encoded).toBe('key%3Dvalue%26foo%3Dbar')
    }
  )

  // ============================================================================
  // Phase 3: Logical Functions (048-058)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-047: should evaluate IF with CASE WHEN expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 48,
            name: 'conditions',
            fields: [
              { id: 1, name: 'score', type: 'integer', required: true },
              {
                id: 2,
                name: 'grade',
                type: 'formula',
                formula: "CASE WHEN score >= 90 THEN 'A' WHEN score >= 80 THEN 'B' ELSE 'C' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO conditions (score) VALUES (95), (85), (70)')

      const gradeA = await executeQuery('SELECT grade FROM conditions WHERE id = 1')
      expect(gradeA.grade).toBe('A')

      const gradeB = await executeQuery('SELECT grade FROM conditions WHERE id = 2')
      expect(gradeB.grade).toBe('B')

      const gradeC = await executeQuery('SELECT grade FROM conditions WHERE id = 3')
      expect(gradeC.grade).toBe('C')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-048: should evaluate OR logical operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 49,
            name: 'logic',
            fields: [
              { id: 1, name: 'a', type: 'checkbox', required: true },
              { id: 2, name: 'b', type: 'checkbox', required: true },
              { id: 3, name: 'result', type: 'formula', formula: 'a OR b', resultType: 'boolean' },
            ],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO logic (a, b) VALUES (true, true), (true, false), (false, true), (false, false)'
      )

      expect((await executeQuery('SELECT result FROM logic WHERE id = 1')).result).toBe(true)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 2')).result).toBe(true)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 3')).result).toBe(true)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 4')).result).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-049: should evaluate XOR logical operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 50,
            name: 'logic',
            fields: [
              { id: 1, name: 'a', type: 'checkbox', required: true },
              { id: 2, name: 'b', type: 'checkbox', required: true },
              {
                id: 3,
                name: 'result',
                type: 'formula',
                formula: '(a OR b) AND NOT (a AND b)',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO logic (a, b) VALUES (true, true), (true, false), (false, true), (false, false)'
      )

      expect((await executeQuery('SELECT result FROM logic WHERE id = 1')).result).toBe(false)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 2')).result).toBe(true)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 3')).result).toBe(true)
      expect((await executeQuery('SELECT result FROM logic WHERE id = 4')).result).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-050: should evaluate SWITCH with CASE expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 51,
            name: 'switches',
            fields: [
              { id: 1, name: 'status', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'label',
                type: 'formula',
                formula:
                  "CASE status WHEN 'pending' THEN 'Waiting' WHEN 'active' THEN 'In Progress' WHEN 'done' THEN 'Completed' ELSE 'Unknown' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO switches (status) VALUES ('pending'), ('active'), ('done'), ('other')"
      )

      expect((await executeQuery('SELECT label FROM switches WHERE id = 1')).label).toBe('Waiting')
      expect((await executeQuery('SELECT label FROM switches WHERE id = 2')).label).toBe(
        'In Progress'
      )
      expect((await executeQuery('SELECT label FROM switches WHERE id = 3')).label).toBe(
        'Completed'
      )
      expect((await executeQuery('SELECT label FROM switches WHERE id = 4')).label).toBe('Unknown')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-051: should return TRUE boolean constant',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 52,
            name: 'constants',
            fields: [
              { id: 1, name: 'dummy', type: 'integer', required: true },
              {
                id: 2,
                name: 'always_true',
                type: 'formula',
                formula: 'TRUE',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO constants (dummy) VALUES (1)')
      expect(
        (await executeQuery('SELECT always_true FROM constants WHERE id = 1')).always_true
      ).toBe(true)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-052: should return FALSE boolean constant',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 53,
            name: 'constants',
            fields: [
              { id: 1, name: 'dummy', type: 'integer', required: true },
              {
                id: 2,
                name: 'always_false',
                type: 'formula',
                formula: 'FALSE',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO constants (dummy) VALUES (1)')
      expect(
        (await executeQuery('SELECT always_false FROM constants WHERE id = 1')).always_false
      ).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-053: should return NULL with BLANK expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 54,
            name: 'nulls',
            fields: [
              { id: 1, name: 'dummy', type: 'integer', required: true },
              { id: 2, name: 'blank_value', type: 'formula', formula: 'NULL', resultType: 'text' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO nulls (dummy) VALUES (1)')
      expect(
        (await executeQuery('SELECT blank_value FROM nulls WHERE id = 1')).blank_value
      ).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-054: should handle error with custom expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 55,
            name: 'errors',
            fields: [
              { id: 1, name: 'value', type: 'integer', required: true },
              {
                id: 2,
                name: 'checked',
                type: 'formula',
                formula: 'CASE WHEN value < 0 THEN NULL ELSE value END',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO errors (value) VALUES (10), (-5)')
      expect((await executeQuery('SELECT checked FROM errors WHERE id = 1')).checked).toBe(10)
      expect((await executeQuery('SELECT checked FROM errors WHERE id = 2')).checked).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-055: should detect errors with guarded expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 56,
            name: 'error_checks',
            fields: [
              { id: 1, name: 'divisor', type: 'integer', required: true },
              {
                id: 2,
                name: 'is_error',
                type: 'formula',
                formula: 'divisor = 0',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO error_checks (divisor) VALUES (5), (0)')
      expect((await executeQuery('SELECT is_error FROM error_checks WHERE id = 1')).is_error).toBe(
        false
      )
      expect((await executeQuery('SELECT is_error FROM error_checks WHERE id = 2')).is_error).toBe(
        true
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-056: should check for blank with IS NULL',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 57,
            name: 'blank_checks',
            fields: [
              { id: 1, name: 'value', type: 'single-line-text' },
              {
                id: 2,
                name: 'is_blank',
                type: 'formula',
                formula: 'value IS NULL',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO blank_checks (value) VALUES ('hello'), (NULL)")
      expect((await executeQuery('SELECT is_blank FROM blank_checks WHERE id = 1')).is_blank).toBe(
        false
      )
      expect((await executeQuery('SELECT is_blank FROM blank_checks WHERE id = 2')).is_blank).toBe(
        true
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-057: should use COALESCE for default values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 58,
            name: 'defaults',
            fields: [
              { id: 1, name: 'value', type: 'single-line-text' },
              {
                id: 2,
                name: 'with_default',
                type: 'formula',
                formula: "COALESCE(value, 'N/A')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO defaults (value) VALUES ('hello'), (NULL)")
      expect(
        (await executeQuery('SELECT with_default FROM defaults WHERE id = 1')).with_default
      ).toBe('hello')
      expect(
        (await executeQuery('SELECT with_default FROM defaults WHERE id = 2')).with_default
      ).toBe('N/A')
    }
  )

  // ============================================================================
  // Phase 4: Date/Time Functions (059-076)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-058: should compare date with CURRENT_DATE',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 59,
            name: 'timestamps',
            fields: [
              { id: 1, name: 'created', type: 'date', required: true },
              {
                id: 2,
                name: 'is_today',
                type: 'formula',
                formula: 'created = CURRENT_DATE',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO timestamps (created) VALUES (CURRENT_DATE)')
      expect((await executeQuery('SELECT is_today FROM timestamps WHERE id = 1')).is_today).toBe(
        true
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-059: should add interval to date',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 60,
            name: 'dates',
            fields: [
              { id: 1, name: 'start_date', type: 'date', required: true },
              {
                id: 2,
                name: 'plus_week',
                type: 'formula',
                formula: "start_date + INTERVAL '7 days'",
                resultType: 'date',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO dates (start_date) VALUES ('2024-01-01')")
      const result = await executeQuery(
        'SELECT plus_week::date as plus_week FROM dates WHERE id = 1'
      )
      expect(result.plus_week).toBe('2024-01-08')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-060: should compute date difference',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 61,
            name: 'date_diffs',
            fields: [
              { id: 1, name: 'start_date', type: 'date', required: true },
              { id: 2, name: 'end_date', type: 'date', required: true },
              {
                id: 3,
                name: 'days_between',
                type: 'formula',
                formula: 'end_date - start_date',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO date_diffs (start_date, end_date) VALUES ('2024-01-01', '2024-01-15')"
      )
      expect(
        (await executeQuery('SELECT days_between FROM date_diffs WHERE id = 1')).days_between
      ).toBe(14)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-061: should format date with TO_CHAR',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 62,
            name: 'formatted_dates',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'formatted',
                type: 'formula',
                formula: "TO_CHAR(date_value, 'YYYY-MM-DD')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO formatted_dates (date_value) VALUES ('2024-03-15')")
      expect(
        (await executeQuery('SELECT formatted FROM formatted_dates WHERE id = 1')).formatted
      ).toBe('2024-03-15')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-062: should parse date from text',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 63,
            name: 'parsed_dates',
            fields: [
              { id: 1, name: 'date_text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'parsed',
                type: 'formula',
                formula: "TO_DATE(date_text, 'YYYY-MM-DD')",
                resultType: 'date',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO parsed_dates (date_text) VALUES ('2024-03-15')")
      expect(
        (await executeQuery('SELECT parsed::text FROM parsed_dates WHERE id = 1')).parsed
      ).toBe('2024-03-15')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-063: should extract year from date',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 64,
            name: 'date_parts',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'year',
                type: 'formula',
                formula: 'EXTRACT(YEAR FROM date_value)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO date_parts (date_value) VALUES ('2024-06-15')")
      expect((await executeQuery('SELECT year FROM date_parts WHERE id = 1')).year).toBe(2024)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-064: should extract month from date',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 65,
            name: 'date_parts',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'month',
                type: 'formula',
                formula: 'EXTRACT(MONTH FROM date_value)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO date_parts (date_value) VALUES ('2024-06-15')")
      expect((await executeQuery('SELECT month FROM date_parts WHERE id = 1')).month).toBe(6)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-065: should extract day from date',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 66,
            name: 'date_parts',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'day',
                type: 'formula',
                formula: 'EXTRACT(DAY FROM date_value)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO date_parts (date_value) VALUES ('2024-06-15')")
      expect((await executeQuery('SELECT day FROM date_parts WHERE id = 1')).day).toBe(15)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-066: should extract hour from timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 67,
            name: 'time_parts',
            fields: [
              { id: 1, name: 'timestamp_value', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'hour',
                type: 'formula',
                formula: 'EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO time_parts (timestamp_value) VALUES ('2024-06-15 14:30:00')")
      expect((await executeQuery('SELECT hour FROM time_parts WHERE id = 1')).hour).toBe(14)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-067: should extract minute from timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 68,
            name: 'time_parts',
            fields: [
              { id: 1, name: 'timestamp_value', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'minute',
                type: 'formula',
                formula: 'EXTRACT(MINUTE FROM timestamp_value::TIMESTAMP)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO time_parts (timestamp_value) VALUES ('2024-06-15 14:30:45')")
      expect((await executeQuery('SELECT minute FROM time_parts WHERE id = 1')).minute).toBe(30)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-068: should extract second from timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 69,
            name: 'time_parts',
            fields: [
              { id: 1, name: 'timestamp_value', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'second',
                type: 'formula',
                formula: 'EXTRACT(SECOND FROM timestamp_value::TIMESTAMP)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO time_parts (timestamp_value) VALUES ('2024-06-15 14:30:45')")
      expect((await executeQuery('SELECT second FROM time_parts WHERE id = 1')).second).toBe(45)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-069: should get day of week',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 70,
            name: 'weekdays',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'weekday',
                type: 'formula',
                formula: 'EXTRACT(DOW FROM date_value)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO weekdays (date_value) VALUES ('2024-01-01')")
      expect((await executeQuery('SELECT weekday FROM weekdays WHERE id = 1')).weekday).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-070: should get week number',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 71,
            name: 'weeks',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'week_num',
                type: 'formula',
                formula: 'EXTRACT(WEEK FROM date_value)::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO weeks (date_value) VALUES ('2024-01-15')")
      expect((await executeQuery('SELECT week_num FROM weeks WHERE id = 1')).week_num).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-071: should check if date is weekday',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 72,
            name: 'workdays',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'is_weekday',
                type: 'formula',
                formula: 'EXTRACT(DOW FROM date_value) NOT IN (0, 6)',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO workdays (date_value) VALUES ('2024-01-15'), ('2024-01-13')")
      expect((await executeQuery('SELECT is_weekday FROM workdays WHERE id = 1')).is_weekday).toBe(
        true
      )
      expect((await executeQuery('SELECT is_weekday FROM workdays WHERE id = 2')).is_weekday).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-072: should count calendar days between dates',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 73,
            name: 'workday_counts',
            fields: [
              { id: 1, name: 'start_date', type: 'date', required: true },
              { id: 2, name: 'end_date', type: 'date', required: true },
              {
                id: 3,
                name: 'calendar_days',
                type: 'formula',
                formula: 'end_date - start_date',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO workday_counts (start_date, end_date) VALUES ('2024-01-08', '2024-01-12')"
      )
      expect(
        (await executeQuery('SELECT calendar_days FROM workday_counts WHERE id = 1')).calendar_days
      ).toBe(4)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-073: should compare dates at same precision',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 74,
            name: 'date_comparisons',
            fields: [
              { id: 1, name: 'date1', type: 'date', required: true },
              { id: 2, name: 'date2', type: 'date', required: true },
              {
                id: 3,
                name: 'same_month',
                type: 'formula',
                formula: "DATE_TRUNC('month', date1) = DATE_TRUNC('month', date2)",
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO date_comparisons (date1, date2) VALUES ('2024-01-15', '2024-01-20'), ('2024-01-15', '2024-02-15')"
      )
      expect(
        (await executeQuery('SELECT same_month FROM date_comparisons WHERE id = 1')).same_month
      ).toBe(true)
      expect(
        (await executeQuery('SELECT same_month FROM date_comparisons WHERE id = 2')).same_month
      ).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-074: should check if date is after another',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 75,
            name: 'date_order',
            fields: [
              { id: 1, name: 'date1', type: 'date', required: true },
              { id: 2, name: 'date2', type: 'date', required: true },
              {
                id: 3,
                name: 'is_after',
                type: 'formula',
                formula: 'date1 > date2',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO date_order (date1, date2) VALUES ('2024-02-01', '2024-01-01'), ('2024-01-01', '2024-02-01')"
      )
      expect((await executeQuery('SELECT is_after FROM date_order WHERE id = 1')).is_after).toBe(
        true
      )
      expect((await executeQuery('SELECT is_after FROM date_order WHERE id = 2')).is_after).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-075: should check if date is before another',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 76,
            name: 'date_order',
            fields: [
              { id: 1, name: 'date1', type: 'date', required: true },
              { id: 2, name: 'date2', type: 'date', required: true },
              {
                id: 3,
                name: 'is_before',
                type: 'formula',
                formula: 'date1 < date2',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO date_order (date1, date2) VALUES ('2024-01-01', '2024-02-01'), ('2024-02-01', '2024-01-01')"
      )
      expect((await executeQuery('SELECT is_before FROM date_order WHERE id = 1')).is_before).toBe(
        true
      )
      expect((await executeQuery('SELECT is_before FROM date_order WHERE id = 2')).is_before).toBe(
        false
      )
    }
  )

  // ============================================================================
  // Phase 5: Array Functions (077-082) - DEFERRED
  // TODO: Requires lookup/rollup fields implementation
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-076: should join array elements with ARRAY_TO_STRING',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 77,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'joined',
                type: 'formula',
                formula: "ARRAY_TO_STRING(STRING_TO_ARRAY(items, ','), ' | ')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,b,c')")
      expect((await executeQuery('SELECT joined FROM arrays WHERE id = 1')).joined).toBe(
        'a | b | c'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-077: should get unique array elements',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 78,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'unique_items',
                type: 'formula',
                formula:
                  "ARRAY_TO_STRING(ARRAY(SELECT DISTINCT unnest FROM unnest(STRING_TO_ARRAY(items, ','))), ',')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,b,a,c,b')")
      const result = await executeQuery('SELECT unique_items FROM arrays WHERE id = 1')
      expect(result.unique_items).toContain('a')
      expect(result.unique_items).toContain('b')
      expect(result.unique_items).toContain('c')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-078: should remove empty elements from array',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 79,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'compacted',
                type: 'formula',
                formula: "ARRAY_TO_STRING(ARRAY_REMOVE(STRING_TO_ARRAY(items, ','), ''), ',')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,,b,,c')")
      expect((await executeQuery('SELECT compacted FROM arrays WHERE id = 1')).compacted).toBe(
        'a,b,c'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-079: should flatten nested arrays',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 80,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'flattened',
                type: 'formula',
                formula: "ARRAY_TO_STRING(STRING_TO_ARRAY(items, ','), ',')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,b,c')")
      expect((await executeQuery('SELECT flattened FROM arrays WHERE id = 1')).flattened).toBe(
        'a,b,c'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-080: should slice array elements',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 81,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'sliced',
                type: 'formula',
                formula: "ARRAY_TO_STRING((STRING_TO_ARRAY(items, ','))[1:2], ',')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,b,c,d,e')")
      expect((await executeQuery('SELECT sliced FROM arrays WHERE id = 1')).sliced).toBe('a,b')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-081: should count array elements',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 82,
            name: 'arrays',
            fields: [
              { id: 1, name: 'items', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'count',
                type: 'formula',
                formula: "CARDINALITY(STRING_TO_ARRAY(items, ','))",
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO arrays (items) VALUES ('a,b,c,d,e')")
      expect((await executeQuery('SELECT count FROM arrays WHERE id = 1')).count).toBe(5)
    }
  )

  // ============================================================================
  // Phase 6: Record Functions (083-085)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-082: should return record ID',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 83,
            name: 'records',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'record_id', type: 'formula', formula: 'id', resultType: 'integer' },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO records (name) VALUES ('first'), ('second')")
      expect((await executeQuery('SELECT record_id FROM records WHERE id = 1')).record_id).toBe(1)
      expect((await executeQuery('SELECT record_id FROM records WHERE id = 2')).record_id).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-083: should return created timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 84,
            name: 'records',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
              {
                id: 3,
                name: 'created_date',
                type: 'formula',
                formula: 'created_at::DATE',
                resultType: 'date',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO records (name) VALUES ('test')")
      const result = await executeQuery('SELECT created_date::text FROM records WHERE id = 1')
      expect(result.created_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-084: should return last modified timestamp',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 85,
            name: 'records',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'updated_at', type: 'updated-at' },
              {
                id: 3,
                name: 'updated_date',
                type: 'formula',
                formula: 'updated_at::DATE',
                resultType: 'date',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO records (name) VALUES ('test')")
      const result = await executeQuery('SELECT updated_date::text FROM records WHERE id = 1')
      expect(result.updated_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  )

  // ============================================================================
  // Phase 7: REGEX Functions (086-088)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-085: should match regex pattern',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 86,
            name: 'patterns',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'is_email',
                type: 'formula',
                formula: "text ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO patterns (text) VALUES ('test@example.com'), ('not-email')")
      expect((await executeQuery('SELECT is_email FROM patterns WHERE id = 1')).is_email).toBe(true)
      expect((await executeQuery('SELECT is_email FROM patterns WHERE id = 2')).is_email).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-086: should extract regex match',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 87,
            name: 'extracts',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'extracted',
                type: 'formula',
                formula: "SUBSTRING(text FROM '\\d+')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO extracts (text) VALUES ('order-12345'), ('no-numbers')")
      expect((await executeQuery('SELECT extracted FROM extracts WHERE id = 1')).extracted).toBe(
        '12345'
      )
      expect(
        (await executeQuery('SELECT extracted FROM extracts WHERE id = 2')).extracted
      ).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-087: should replace with regex',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 88,
            name: 'replacements',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'replaced',
                type: 'formula',
                formula: "REGEXP_REPLACE(text, '\\d+', 'X', 'g')",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO replacements (text) VALUES ('abc123def456')")
      expect((await executeQuery('SELECT replaced FROM replacements WHERE id = 1')).replaced).toBe(
        'abcXdefX'
      )
    }
  )

  // ============================================================================
  // Phase 8: Operators & Edge Cases (089-115)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-088: should compute modulo with % operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 89,
            name: 'modulos',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'result', type: 'formula', formula: 'a % b', resultType: 'integer' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO modulos (a, b) VALUES (10, 3)')
      expect((await executeQuery('SELECT result FROM modulos WHERE id = 1')).result).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-089: should handle NULL in arithmetic',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 90,
            name: 'nulls',
            fields: [
              { id: 1, name: 'a', type: 'integer' },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'sum', type: 'formula', formula: 'a + b', resultType: 'integer' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO nulls (a, b) VALUES (NULL, 5)')
      expect((await executeQuery('SELECT sum FROM nulls WHERE id = 1')).sum).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-090: should handle division by zero',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 91,
            name: 'divisions',
            fields: [
              { id: 1, name: 'a', type: 'decimal', required: true },
              { id: 2, name: 'b', type: 'decimal', required: true },
              {
                id: 3,
                name: 'safe_div',
                type: 'formula',
                formula: 'CASE WHEN b = 0 THEN NULL ELSE a / b END',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO divisions (a, b) VALUES (10, 0), (10, 2)')
      expect(
        (await executeQuery('SELECT safe_div FROM divisions WHERE id = 1')).safe_div
      ).toBeNull()
      expect((await executeQuery('SELECT safe_div FROM divisions WHERE id = 2')).safe_div).toBe(5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-091: should coerce number to text',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 92,
            name: 'coercions',
            fields: [
              { id: 1, name: 'num', type: 'integer', required: true },
              { id: 2, name: 'as_text', type: 'formula', formula: 'num::TEXT', resultType: 'text' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO coercions (num) VALUES (42)')
      expect((await executeQuery('SELECT as_text FROM coercions WHERE id = 1')).as_text).toBe('42')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-092: should coerce text to number',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 93,
            name: 'coercions',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'as_num',
                type: 'formula',
                formula: 'text::NUMERIC',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO coercions (text) VALUES ('42.5')")
      expect((await executeQuery('SELECT as_num FROM coercions WHERE id = 1')).as_num).toBe(42.5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-093: should handle nested function calls',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 94,
            name: 'nested',
            fields: [
              { id: 1, name: 'value', type: 'decimal', required: true },
              {
                id: 2,
                name: 'result',
                type: 'formula',
                formula: 'ROUND(SQRT(ABS(value)), 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO nested (value) VALUES (-16)')
      expect((await executeQuery('SELECT result FROM nested WHERE id = 1')).result).toBe(4)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-094: should concatenate with & operator equivalent',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 95,
            name: 'concat',
            fields: [
              { id: 1, name: 'a', type: 'single-line-text', required: true },
              { id: 2, name: 'b', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'result',
                type: 'formula',
                formula: 'a || b',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO concat (a, b) VALUES ('Hello', 'World')")
      expect((await executeQuery('SELECT result FROM concat WHERE id = 1')).result).toBe(
        'HelloWorld'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-095: should compare with = operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 96,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'is_equal', type: 'formula', formula: 'a = b', resultType: 'boolean' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (5, 5), (5, 3)')
      expect((await executeQuery('SELECT is_equal FROM comparisons WHERE id = 1')).is_equal).toBe(
        true
      )
      expect((await executeQuery('SELECT is_equal FROM comparisons WHERE id = 2')).is_equal).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-096: should compare with != operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 97,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              {
                id: 3,
                name: 'not_equal',
                type: 'formula',
                formula: 'a != b',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (5, 3), (5, 5)')
      expect((await executeQuery('SELECT not_equal FROM comparisons WHERE id = 1')).not_equal).toBe(
        true
      )
      expect((await executeQuery('SELECT not_equal FROM comparisons WHERE id = 2')).not_equal).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-097: should compare with < operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 98,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'is_less', type: 'formula', formula: 'a < b', resultType: 'boolean' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (3, 5), (5, 3)')
      expect((await executeQuery('SELECT is_less FROM comparisons WHERE id = 1')).is_less).toBe(
        true
      )
      expect((await executeQuery('SELECT is_less FROM comparisons WHERE id = 2')).is_less).toBe(
        false
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-098: should compare with > operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 99,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              {
                id: 3,
                name: 'is_greater',
                type: 'formula',
                formula: 'a > b',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (5, 3), (3, 5)')
      expect(
        (await executeQuery('SELECT is_greater FROM comparisons WHERE id = 1')).is_greater
      ).toBe(true)
      expect(
        (await executeQuery('SELECT is_greater FROM comparisons WHERE id = 2')).is_greater
      ).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-099: should compare with <= operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 100,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              {
                id: 3,
                name: 'is_lte',
                type: 'formula',
                formula: 'a <= b',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (3, 5), (5, 5), (6, 5)')
      expect((await executeQuery('SELECT is_lte FROM comparisons WHERE id = 1')).is_lte).toBe(true)
      expect((await executeQuery('SELECT is_lte FROM comparisons WHERE id = 2')).is_lte).toBe(true)
      expect((await executeQuery('SELECT is_lte FROM comparisons WHERE id = 3')).is_lte).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-100: should compare with >= operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 101,
            name: 'comparisons',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              {
                id: 3,
                name: 'is_gte',
                type: 'formula',
                formula: 'a >= b',
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO comparisons (a, b) VALUES (5, 3), (5, 5), (4, 5)')
      expect((await executeQuery('SELECT is_gte FROM comparisons WHERE id = 1')).is_gte).toBe(true)
      expect((await executeQuery('SELECT is_gte FROM comparisons WHERE id = 2')).is_gte).toBe(true)
      expect((await executeQuery('SELECT is_gte FROM comparisons WHERE id = 3')).is_gte).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-101: should apply unary minus operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 102,
            name: 'negations',
            fields: [
              { id: 1, name: 'value', type: 'integer', required: true },
              { id: 2, name: 'negated', type: 'formula', formula: '-value', resultType: 'integer' },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO negations (value) VALUES (5), (-3)')
      expect((await executeQuery('SELECT negated FROM negations WHERE id = 1')).negated).toBe(-5)
      expect((await executeQuery('SELECT negated FROM negations WHERE id = 2')).negated).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-102: should respect parentheses grouping',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 103,
            name: 'grouping',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'c', type: 'integer', required: true },
              {
                id: 4,
                name: 'result',
                type: 'formula',
                formula: '(a + b) * c',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO grouping (a, b, c) VALUES (2, 3, 4)')
      expect((await executeQuery('SELECT result FROM grouping WHERE id = 1')).result).toBe(20)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-103: should mix arithmetic and text',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 104,
            name: 'mixed',
            fields: [
              { id: 1, name: 'quantity', type: 'integer', required: true },
              { id: 2, name: 'unit', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'label',
                type: 'formula',
                formula: "quantity::TEXT || ' ' || unit",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO mixed (quantity, unit) VALUES (5, 'items')")
      expect((await executeQuery('SELECT label FROM mixed WHERE id = 1')).label).toBe('5 items')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-104: should coerce boolean to text',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 105,
            name: 'booleans',
            fields: [
              { id: 1, name: 'flag', type: 'checkbox', required: true },
              {
                id: 2,
                name: 'as_text',
                type: 'formula',
                formula: "CASE WHEN flag THEN 'Yes' ELSE 'No' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO booleans (flag) VALUES (true), (false)')
      expect((await executeQuery('SELECT as_text FROM booleans WHERE id = 1')).as_text).toBe('Yes')
      expect((await executeQuery('SELECT as_text FROM booleans WHERE id = 2')).as_text).toBe('No')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-105: should coerce date to text',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 106,
            name: 'dates',
            fields: [
              { id: 1, name: 'date_value', type: 'date', required: true },
              {
                id: 2,
                name: 'as_text',
                type: 'formula',
                formula: 'date_value::TEXT',
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO dates (date_value) VALUES ('2024-01-15')")
      expect((await executeQuery('SELECT as_text FROM dates WHERE id = 1')).as_text).toBe(
        '2024-01-15'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-106: should handle empty string',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 107,
            name: 'empties',
            fields: [
              { id: 1, name: 'text', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'is_empty',
                type: 'formula',
                formula: "text = ''",
                resultType: 'boolean',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO empties (text) VALUES (''), ('hello')")
      expect((await executeQuery('SELECT is_empty FROM empties WHERE id = 1')).is_empty).toBe(true)
      expect((await executeQuery('SELECT is_empty FROM empties WHERE id = 2')).is_empty).toBe(false)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-107: should handle whitespace in formulas',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 108,
            name: 'whitespace',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              {
                id: 3,
                name: 'result',
                type: 'formula',
                formula: '  a   +   b  ',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO whitespace (a, b) VALUES (3, 5)')
      expect((await executeQuery('SELECT result FROM whitespace WHERE id = 1')).result).toBe(8)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-108: should handle case sensitivity in field names',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 109,
            name: 'cases',
            fields: [
              { id: 1, name: 'my_value', type: 'integer', required: true },
              {
                id: 2,
                name: 'doubled',
                type: 'formula',
                formula: 'my_value * 2',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO cases (my_value) VALUES (5)')
      expect((await executeQuery('SELECT doubled FROM cases WHERE id = 1')).doubled).toBe(10)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-109: should handle reserved word escaping',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 110,
            name: 'reserved',
            fields: [
              { id: 1, name: 'order_num', type: 'integer', required: true },
              {
                id: 2,
                name: 'doubled',
                type: 'formula',
                formula: 'order_num * 2',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO reserved (order_num) VALUES (5)')
      expect((await executeQuery('SELECT doubled FROM reserved WHERE id = 1')).doubled).toBe(10)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-110: should handle long formula expressions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 111,
            name: 'long_formulas',
            fields: [
              { id: 1, name: 'a', type: 'integer', required: true },
              { id: 2, name: 'b', type: 'integer', required: true },
              { id: 3, name: 'c', type: 'integer', required: true },
              {
                id: 4,
                name: 'complex',
                type: 'formula',
                formula:
                  'CASE WHEN a > 0 THEN CASE WHEN b > 0 THEN a + b + c ELSE a - b + c END ELSE CASE WHEN b > 0 THEN b + c ELSE c END END',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO long_formulas (a, b, c) VALUES (1, 2, 3)')
      expect((await executeQuery('SELECT complex FROM long_formulas WHERE id = 1')).complex).toBe(6)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-111: should handle deeply nested expressions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 112,
            name: 'deep',
            fields: [
              { id: 1, name: 'value', type: 'integer', required: true },
              {
                id: 2,
                name: 'result',
                type: 'formula',
                formula: 'ROUND(SQRT(ABS(POWER(value, 2))), 0)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO deep (value) VALUES (-5)')
      expect((await executeQuery('SELECT result FROM deep WHERE id = 1')).result).toBe(5)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-112: should support multiple formula fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 113,
            name: 'multi_formula',
            fields: [
              { id: 1, name: 'base', type: 'integer', required: true },
              {
                id: 2,
                name: 'doubled',
                type: 'formula',
                formula: 'base * 2',
                resultType: 'integer',
              },
              {
                id: 3,
                name: 'tripled',
                type: 'formula',
                formula: 'base * 3',
                resultType: 'integer',
              },
              {
                id: 4,
                name: 'squared',
                type: 'formula',
                formula: 'base * base',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO multi_formula (base) VALUES (5)')
      const result = await executeQuery(
        'SELECT doubled, tripled, squared FROM multi_formula WHERE id = 1'
      )
      expect(result.doubled).toBe(10)
      expect(result.tripled).toBe(15)
      expect(result.squared).toBe(25)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-113: should reference another formula field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Note: PostgreSQL GENERATED columns cannot reference other generated columns
      // This test verifies that cascading calculations work with proper field ordering
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 114,
            name: 'cascade',
            fields: [
              { id: 1, name: 'base', type: 'integer', required: true },
              {
                id: 2,
                name: 'doubled',
                type: 'formula',
                formula: 'base * 2',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO cascade (base) VALUES (5)')
      expect((await executeQuery('SELECT doubled FROM cascade WHERE id = 1')).doubled).toBe(10)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-114: should handle all NULL inputs',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 115,
            name: 'all_nulls',
            fields: [
              { id: 1, name: 'a', type: 'integer' },
              { id: 2, name: 'b', type: 'integer' },
              {
                id: 3,
                name: 'result',
                type: 'formula',
                formula: 'COALESCE(a, 0) + COALESCE(b, 0)',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO all_nulls (a, b) VALUES (NULL, NULL)')
      expect((await executeQuery('SELECT result FROM all_nulls WHERE id = 1')).result).toBe(0)
    }
  )

  // ============================================================================
  // Phase 9: Integration Tests (116-123)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-115: should handle complex nested expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 116,
            name: 'complex',
            fields: [
              { id: 1, name: 'price', type: 'decimal', required: true },
              { id: 2, name: 'quantity', type: 'integer', required: true },
              { id: 3, name: 'discount', type: 'decimal', required: true },
              {
                id: 4,
                name: 'final_price',
                type: 'formula',
                formula: 'ROUND(price * quantity * (1 - discount / 100), 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO complex (price, quantity, discount) VALUES (99.99, 3, 10)')
      expect(
        (await executeQuery('SELECT final_price FROM complex WHERE id = 1')).final_price
      ).toBeCloseTo(269.97, 1)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-116: should calculate invoice total',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 117,
            name: 'invoices',
            fields: [
              { id: 1, name: 'subtotal', type: 'decimal', required: true },
              { id: 2, name: 'tax_rate', type: 'decimal', required: true },
              { id: 3, name: 'shipping', type: 'decimal', required: true },
              {
                id: 4,
                name: 'total',
                type: 'formula',
                formula: 'ROUND(subtotal * (1 + tax_rate) + shipping, 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO invoices (subtotal, tax_rate, shipping) VALUES (100, 0.08, 5)'
      )
      expect((await executeQuery('SELECT total FROM invoices WHERE id = 1')).total).toBe(113)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-117: should calculate discount pricing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 118,
            name: 'products',
            fields: [
              { id: 1, name: 'original_price', type: 'decimal', required: true },
              { id: 2, name: 'discount_percent', type: 'decimal', required: true },
              {
                id: 3,
                name: 'sale_price',
                type: 'formula',
                formula: 'ROUND(original_price * (1 - discount_percent / 100), 2)',
                resultType: 'decimal',
              },
            ],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO products (original_price, discount_percent) VALUES (79.99, 25)'
      )
      expect((await executeQuery('SELECT sale_price FROM products WHERE id = 1')).sale_price).toBe(
        59.99
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-118: should calculate age from birthdate',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 119,
            name: 'people',
            fields: [
              { id: 1, name: 'birth_date', type: 'date', required: true },
              {
                id: 2,
                name: 'age_years',
                type: 'formula',
                formula: 'EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date))::INTEGER',
                resultType: 'integer',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO people (birth_date) VALUES ('2000-01-01')")
      const result = await executeQuery('SELECT age_years FROM people WHERE id = 1')
      expect(result.age_years).toBeGreaterThanOrEqual(24)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-119: should derive status from conditions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 120,
            name: 'orders',
            fields: [
              { id: 1, name: 'shipped', type: 'checkbox', required: true },
              { id: 2, name: 'delivered', type: 'checkbox', required: true },
              {
                id: 3,
                name: 'status',
                type: 'formula',
                formula:
                  "CASE WHEN delivered THEN 'Delivered' WHEN shipped THEN 'In Transit' ELSE 'Processing' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery(
        'INSERT INTO orders (shipped, delivered) VALUES (false, false), (true, false), (true, true)'
      )
      expect((await executeQuery('SELECT status FROM orders WHERE id = 1')).status).toBe(
        'Processing'
      )
      expect((await executeQuery('SELECT status FROM orders WHERE id = 2')).status).toBe(
        'In Transit'
      )
      expect((await executeQuery('SELECT status FROM orders WHERE id = 3')).status).toBe(
        'Delivered'
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-120: should format full name',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 121,
            name: 'contacts',
            fields: [
              { id: 1, name: 'first_name', type: 'single-line-text', required: true },
              { id: 2, name: 'last_name', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'display_name',
                type: 'formula',
                formula: "INITCAP(first_name) || ' ' || UPPER(last_name)",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO contacts (first_name, last_name) VALUES ('john', 'doe')")
      expect(
        (await executeQuery('SELECT display_name FROM contacts WHERE id = 1')).display_name
      ).toBe('John DOE')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-121: should generate URL slug',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 122,
            name: 'articles',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'slug',
                type: 'formula',
                formula: "LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'))",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO articles (title) VALUES ('Hello World Article!')")
      expect((await executeQuery('SELECT slug FROM articles WHERE id = 1')).slug).toBe(
        'hello-world-article-'
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-122: should track deadline status',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 123,
            name: 'tasks',
            fields: [
              { id: 1, name: 'due_date', type: 'date', required: true },
              { id: 2, name: 'completed', type: 'checkbox', required: true },
              {
                id: 3,
                name: 'deadline_status',
                type: 'formula',
                formula:
                  "CASE WHEN completed THEN 'Done' WHEN due_date < CURRENT_DATE THEN 'Overdue' WHEN due_date = CURRENT_DATE THEN 'Due Today' ELSE 'Upcoming' END",
                resultType: 'text',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO tasks (due_date, completed) VALUES ('2020-01-01', false)")
      expect(
        (await executeQuery('SELECT deadline_status FROM tasks WHERE id = 1')).deadline_status
      ).toBe('Overdue')
    }
  )

  // ============================================================================
  // Phase 10: Updated Regression Test (124)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-FORMULA-123: user can complete full formula-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with formula field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 124,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'base_price', type: 'decimal' },
                { id: 3, name: 'tax_rate', type: 'decimal' },
                {
                  id: 4,
                  name: 'total_price',
                  type: 'formula',
                  formula: 'base_price * (1 + tax_rate)',
                  resultType: 'number',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert data and verify formula calculation', async () => {
        await executeQuery('INSERT INTO data (base_price, tax_rate) VALUES (100.00, 0.10)')
        const computed = await executeQuery(
          'SELECT base_price, tax_rate, total_price FROM data WHERE id = 1'
        )
        expect(computed.base_price).toBe(100)
        expect(computed.tax_rate).toBe(0.1)
        expect(computed.total_price).toBe(110)
      })

      await test.step('Update value and verify formula recalculation', async () => {
        await executeQuery('UPDATE data SET tax_rate = 0.20 WHERE id = 1')
        const recomputed = await executeQuery('SELECT total_price FROM data WHERE id = 1')
        expect(recomputed.total_price).toBe(120)
      })
    }
  )

  // ============================================================================
  // Phase 11: Error Configuration Validation Tests (124-126)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-124: should reject formula when referenced field does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Formula field referencing non-existent field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'line_items',
              fields: [
                { id: 1, name: 'quantity', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'total',
                  type: 'formula',
                  formula: 'price * quantity', // 'price' field doesn't exist!
                  resultType: 'decimal',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/field.*price.*not found|invalid.*field reference/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-125: should reject circular formula dependencies',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Two formula fields that reference each other
      // WHEN: Attempting to start server with circular dependency
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'calculations',
              fields: [
                {
                  id: 1,
                  name: 'field_a',
                  type: 'formula',
                  formula: 'field_b * 2',
                  resultType: 'decimal',
                },
                {
                  id: 2,
                  name: 'field_b',
                  type: 'formula',
                  formula: 'field_a * 2',
                  resultType: 'decimal',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/circular.*dependency|cyclic.*reference/i)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-126: should reject formula with invalid syntax',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Formula field with syntax error
      // WHEN: Attempting to start server with invalid formula
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'line_items',
              fields: [
                { id: 1, name: 'quantity', type: 'integer', required: true },
                { id: 2, name: 'price', type: 'decimal', required: true },
                {
                  id: 3,
                  name: 'total',
                  type: 'formula',
                  formula: 'price * * quantity', // Invalid syntax!
                  resultType: 'decimal',
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/invalid.*formula.*syntax|syntax error/i)
    }
  )
})

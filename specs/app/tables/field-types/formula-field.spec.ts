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
 * Spec Count: 5
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

  test.fixme(
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-FORMULA-006: user can complete full formula-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with formula field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
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
        expect(computed.base_price).toBe('100.00')
        expect(computed.tax_rate).toBe('0.10')
        expect(computed.total_price).toBe('110.00')
      })

      await test.step('Update value and verify formula recalculation', async () => {
        await executeQuery('UPDATE data SET tax_rate = 0.20 WHERE id = 1')
        const recomputed = await executeQuery('SELECT total_price FROM data WHERE id = 1')
        expect(recomputed.total_price).toBe('120.00')
      })
    }
  )
})

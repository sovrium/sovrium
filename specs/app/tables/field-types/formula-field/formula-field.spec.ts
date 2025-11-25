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
 * Source: specs/app/tables/field-types/formula-field/formula-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Formula Field', () => {
  test.fixme(
    'APP-FORMULA-FIELD-001: should create GENERATED ALWAYS AS column for arithmetic formula',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE line_items (id SERIAL PRIMARY KEY, quantity INTEGER NOT NULL, unit_price DECIMAL(10,2) NOT NULL, total DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED)',
        'INSERT INTO line_items (quantity, unit_price) VALUES (5, 19.99), (10, 9.50)',
      ])

      const generatedColumn = await executeQuery(
        "SELECT column_name, is_generated FROM information_schema.columns WHERE table_name='line_items' AND column_name='total'"
      )
      expect(generatedColumn.column_name).toBe('total')
      expect(generatedColumn.is_generated).toBe('ALWAYS')

      const firstRecord = await executeQuery(
        'SELECT quantity, unit_price, total FROM line_items WHERE id = 1'
      )
      expect(firstRecord.quantity).toBe(5)
      expect(firstRecord.unit_price).toBe('19.99')
      expect(firstRecord.total).toBe('99.95')

      const secondRecord = await executeQuery(
        'SELECT quantity, unit_price, total FROM line_items WHERE id = 2'
      )
      expect(secondRecord.quantity).toBe(10)
      expect(secondRecord.unit_price).toBe('9.50')
      expect(secondRecord.total).toBe('95.00')
    }
  )

  test.fixme(
    'APP-FORMULA-FIELD-002: should perform text concatenation with GENERATED column',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        "CREATE TABLE contacts (id SERIAL PRIMARY KEY, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED)",
        "INSERT INTO contacts (first_name, last_name) VALUES ('John', 'Doe'), ('Jane', 'Smith')",
      ])

      const firstContact = await executeQuery(
        'SELECT first_name, last_name, full_name FROM contacts WHERE id = 1'
      )
      expect(firstContact.first_name).toBe('John')
      expect(firstContact.last_name).toBe('Doe')
      expect(firstContact.full_name).toBe('John Doe')

      const secondContact = await executeQuery(
        'SELECT first_name, last_name, full_name FROM contacts WHERE id = 2'
      )
      expect(secondContact.first_name).toBe('Jane')
      expect(secondContact.last_name).toBe('Smith')
      expect(secondContact.full_name).toBe('Jane Smith')

      const afterUpdate = await executeQuery(
        "UPDATE contacts SET first_name = 'Janet' WHERE id = 2 RETURNING full_name"
      )
      expect(afterUpdate.full_name).toBe('Janet Smith')
    }
  )

  test.fixme(
    'APP-FORMULA-FIELD-003: should support conditional expressions with CASE WHEN',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE products (id SERIAL PRIMARY KEY, price DECIMAL(10,2) NOT NULL, on_sale BOOLEAN NOT NULL, discount_price DECIMAL(10,2) GENERATED ALWAYS AS (CASE WHEN on_sale THEN price * 0.80 ELSE price END) STORED)',
        'INSERT INTO products (price, on_sale) VALUES (100.00, true), (50.00, false)',
      ])

      const onSale = await executeQuery(
        'SELECT price, on_sale, discount_price FROM products WHERE id = 1'
      )
      expect(onSale.price).toBe('100.00')
      expect(onSale.on_sale).toBe(true)
      expect(onSale.discount_price).toBe('80.00')

      const notOnSale = await executeQuery(
        'SELECT price, on_sale, discount_price FROM products WHERE id = 2'
      )
      expect(notOnSale.price).toBe('50.00')
      expect(notOnSale.on_sale).toBe(false)
      expect(notOnSale.discount_price).toBe('50.00')

      const saleToggled = await executeQuery(
        'UPDATE products SET on_sale = true WHERE id = 2 RETURNING discount_price'
      )
      expect(saleToggled.discount_price).toBe('40.00')
    }
  )

  test.fixme(
    'APP-FORMULA-FIELD-004: should apply mathematical functions like ROUND',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE measurements (id SERIAL PRIMARY KEY, raw_value DECIMAL(10,4) NOT NULL, rounded_value DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(raw_value, 2)) STORED)',
        'INSERT INTO measurements (raw_value) VALUES (19.9567), (49.1234), (-15.6789)',
      ])

      const firstMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 1'
      )
      expect(firstMeasurement.raw_value).toBe('19.9567')
      expect(firstMeasurement.rounded_value).toBe('19.96')

      const secondMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 2'
      )
      expect(secondMeasurement.raw_value).toBe('49.1234')
      expect(secondMeasurement.rounded_value).toBe('49.12')

      const negativeMeasurement = await executeQuery(
        'SELECT raw_value, rounded_value FROM measurements WHERE id = 3'
      )
      expect(negativeMeasurement.raw_value).toBe('-15.6789')
      expect(negativeMeasurement.rounded_value).toBe('-15.68')
    }
  )

  test.fixme(
    'APP-FORMULA-FIELD-005: should evaluate boolean date logic for overdue detection',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE invoices (id SERIAL PRIMARY KEY, due_date DATE NOT NULL, paid BOOLEAN NOT NULL DEFAULT false, is_overdue BOOLEAN GENERATED ALWAYS AS (NOT paid AND due_date < CURRENT_DATE) STORED)',
        "INSERT INTO invoices (due_date, paid) VALUES ('2024-01-15', false), ('2025-12-31', false), ('2024-06-01', true)",
      ])

      const pastDueUnpaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 1'
      )
      expect(pastDueUnpaid.due_date).toBe('2024-01-15')
      expect(pastDueUnpaid.paid).toBe(false)
      expect(pastDueUnpaid.is_overdue).toBe(true)

      const futureDueUnpaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 2'
      )
      expect(futureDueUnpaid.due_date).toBe('2025-12-31')
      expect(futureDueUnpaid.paid).toBe(false)
      expect(futureDueUnpaid.is_overdue).toBe(false)

      const pastDuePaid = await executeQuery(
        'SELECT due_date, paid, is_overdue FROM invoices WHERE id = 3'
      )
      expect(pastDuePaid.due_date).toBe('2024-06-01')
      expect(pastDuePaid.paid).toBe(true)
      expect(pastDuePaid.is_overdue).toBe(false)
    }
  )

  test.fixme(
    'user can complete full formula-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'base_price', type: 'decimal' },
              { name: 'tax_rate', type: 'decimal' },
              {
                name: 'total_price',
                type: 'formula',
                formula: 'base_price * (1 + tax_rate)',
                resultType: 'number',
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO data (base_price, tax_rate) VALUES (100.00, 0.10)')
      const computed = await executeQuery(
        'SELECT base_price, tax_rate, total_price FROM data WHERE id = 1'
      )
      expect(computed.base_price).toBe('100.00')
      expect(computed.tax_rate).toBe('0.10')
      expect(computed.total_price).toBe('110.00')

      await executeQuery('UPDATE data SET tax_rate = 0.20 WHERE id = 1')
      const recomputed = await executeQuery('SELECT total_price FROM data WHERE id = 1')
      expect(recomputed.total_price).toBe('120.00')
    }
  )
})

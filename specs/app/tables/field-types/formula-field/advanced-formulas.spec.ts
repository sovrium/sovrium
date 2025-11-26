/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'APP-FORMULA-ADV-001: should evaluate nested formula with multiple functions',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: table 'invoices' with formula calculating total with tax
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_invoices',
          name: 'invoices',
          fields: [
            { id: 'fld_subtotal', name: 'subtotal', type: 'decimal', precision: 10, scale: 2 },
            { id: 'fld_tax_rate', name: 'tax_rate', type: 'percentage' },
            { id: 'fld_discount', name: 'discount', type: 'decimal', precision: 10, scale: 2 },
            {
              id: 'fld_total',
              name: 'total',
              type: 'formula',
              config: {
                formula: 'ROUND((subtotal - discount) * (1 + tax_rate), 2)',
                returnType: 'decimal',
              },
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO invoices (subtotal, tax_rate, discount) VALUES
      (100.00, 0.20, 10.00),
      (250.50, 0.15, 25.00),
      (1000.00, 0.10, 0.00)
    `)

    const results = await executeQuery(
      `SELECT subtotal, tax_rate, discount, total FROM invoices ORDER BY subtotal`
    )

    expect(results[0].total).toBe('108.00')
    expect(results[1].total).toBe('259.33')
    expect(results[2].total).toBe('1100.00')
  }
)

test.fixme(
  'APP-FORMULA-ADV-002: should detect circular dependencies in formulas',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              {
                id: 'fld_a',
                name: 'field_a',
                type: 'formula',
                config: {
                  formula: 'field_b + 10',
                  returnType: 'integer',
                },
              },
              {
                id: 'fld_b',
                name: 'field_b',
                type: 'formula',
                config: {
                  formula: 'field_a * 2',
                  returnType: 'integer',
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/circular dependency detected/i)
  }
)

test.fixme(
  'APP-FORMULA-ADV-003: should validate formula syntax before applying',
  { tag: '@spec' },
  async ({ startServerWithSchema }) => {
    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { id: 'fld_price', name: 'price', type: 'decimal' },
              {
                id: 'fld_markup',
                name: 'markup',
                type: 'formula',
                config: {
                  formula: 'price * (1 +',
                  returnType: 'decimal',
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/formula syntax error.*unclosed parenthesis/i)
  }
)

test.fixme(
  'APP-FORMULA-ADV-004: should evaluate formula using lookup field from related table',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_customers',
          name: 'customers',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_discount_rate', name: 'discount_rate', type: 'percentage' },
          ],
        },
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [
            {
              id: 'fld_customer',
              name: 'customer',
              type: 'relationship',
              config: { linkedTableId: 'tbl_customers' },
            },
            { id: 'fld_amount', name: 'amount', type: 'decimal' },
            {
              id: 'fld_customer_discount',
              name: 'customer_discount',
              type: 'lookup',
              config: {
                relationshipField: 'fld_customer',
                lookupField: 'fld_discount_rate',
              },
            },
            {
              id: 'fld_final_amount',
              name: 'final_amount',
              type: 'formula',
              config: {
                formula: 'amount * (1 - customer_discount)',
                returnType: 'decimal',
              },
            },
          ],
        },
      ],
    })

    const customerResult = await executeQuery(`
      INSERT INTO customers (name, discount_rate) VALUES ('VIP Customer', 0.15) RETURNING id
    `)
    const customerId = customerResult.id

    await executeQuery(`INSERT INTO orders (customer_id, amount) VALUES ($1, 200.00)`, [customerId])

    const order = await executeQuery(`SELECT final_amount FROM orders`)
    expect(order.final_amount).toBe('170.00')
  }
)

test.fixme(
  'APP-FORMULA-ADV-005: should compute formula for 10k records in < 2 seconds',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_calculations',
          name: 'calculations',
          fields: [
            { id: 'fld_value', name: 'value', type: 'integer' },
            {
              id: 'fld_squared',
              name: 'squared',
              type: 'formula',
              config: {
                formula: 'value * value',
                returnType: 'integer',
              },
            },
          ],
        },
      ],
    })

    const values = Array.from({ length: 10000 }, (_, i) => i + 1)
    const batchSize = 1000

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize)
      const placeholders = batch.map((_, idx) => `($${idx + 1})`).join(',')
      await executeQuery(`INSERT INTO calculations (value) VALUES ${placeholders}`, batch)
    }

    const startTime = performance.now()
    const results = await executeQuery(
      `SELECT value, squared FROM calculations ORDER BY value LIMIT 100`
    )
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(2000)
    expect(results[0]).toEqual({ value: 1, squared: 1 })
    expect(results[99]).toEqual({ value: 100, squared: 10000 })
  }
)

test.fixme(
  'APP-FORMULA-REGRESSION: formula fields work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_test',
          name: 'test',
          fields: [
            { id: 'fld_a', name: 'a', type: 'integer' },
            { id: 'fld_b', name: 'b', type: 'integer' },
            {
              id: 'fld_sum',
              name: 'sum',
              type: 'formula',
              config: {
                formula: 'a + b',
                returnType: 'integer',
              },
            },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO test (a, b) VALUES (5, 3)`)
    const result = await executeQuery(`SELECT sum FROM test`)
    expect(result.sum).toBe(8)
  }
)

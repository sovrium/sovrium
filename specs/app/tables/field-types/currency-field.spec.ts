/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Currency Field
 *
 * Source: specs/app/tables/field-types/currency-field/currency-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Currency Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-CURRENCY-FIELD-001: should create PostgreSQL DECIMAL column for currency storage when table configuration has currency field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with currency field 'price'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'price', type: 'currency', currency: 'USD' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL DECIMAL column is created for precise currency values
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='price'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('price')
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO products (price) VALUES (19.99) RETURNING price'
      )
      // THEN: assertion
      expect(parseFloat(validInsert.price)).toBe(19.99)
    }
  )

  test.fixme(
    'APP-CURRENCY-FIELD-002: should reject values outside min/max range when CHECK constraint enforces range validation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with currency field 'budget' (min=0, max=10000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'budget', type: 'currency', currency: 'USD', min: 0, max: 10_000 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: CHECK constraint enforces range validation
      // THEN: PostgreSQL rejects values outside min/max range
      const validInsert = await executeQuery(
        'INSERT INTO projects (budget) VALUES (5000.00) RETURNING budget'
      )
      // THEN: assertion
      expect(parseFloat(validInsert.budget)).toBe(5000)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (budget) VALUES (-0.01)')).rejects.toThrow(
        /violates check constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (budget) VALUES (10000.01)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-CURRENCY-FIELD-003: should enforce NOT NULL and UNIQUE constraints when currency field is required and unique',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with currency field 'transaction_id' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'transactions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'amount',
                type: 'currency',
                currency: 'USD',
                unique: true,
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO transactions (amount) VALUES (100.50)'])

      // WHEN: constraints are applied
      // THEN: PostgreSQL enforces NOT NULL and UNIQUE constraints
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='transactions' AND column_name='amount'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO transactions (amount) VALUES (100.50)')
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO transactions (amount) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-CURRENCY-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with currency field 'fee' and default value 9.99
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'subscriptions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'fee', type: 'currency', currency: 'USD', default: 9.99 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing fee value
      // THEN: PostgreSQL applies DEFAULT value 9.99
      const defaultInsert = await executeQuery(
        'INSERT INTO subscriptions (id) VALUES (DEFAULT) RETURNING fee'
      )
      // THEN: assertion
      expect(parseFloat(defaultInsert.fee)).toBe(9.99)

      const explicitInsert = await executeQuery(
        'INSERT INTO subscriptions (fee) VALUES (14.99) RETURNING fee'
      )
      // THEN: assertion
      expect(parseFloat(explicitInsert.fee)).toBe(14.99)
    }
  )

  test.fixme(
    'APP-CURRENCY-FIELD-005: should create btree index for fast queries when currency field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with currency field 'total', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'total',
                type: 'currency',
                currency: 'USD',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the currency field
      // THEN: PostgreSQL btree index exists for fast queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_orders_total'"
      )
      // THEN: assertion
      expect(indexExists).toEqual({
        indexname: 'idx_orders_total',
        tablename: 'orders',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-CURRENCY-REGRESSION-001: user can complete full currency-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative currency field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'currency_field',
                type: 'currency',
                currency: 'USD',
                required: true,
                indexed: true,
                min: 0,
                max: 1000,
                default: 99.99,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='currency_field'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test precision for currency (2 decimal places)
      await executeQuery('INSERT INTO data (currency_field) VALUES (499.99)')
      const stored = await executeQuery('SELECT currency_field FROM data WHERE id = 1')
      // THEN: assertion
      expect(parseFloat(stored.currency_field)).toBe(499.99)
    }
  )
})

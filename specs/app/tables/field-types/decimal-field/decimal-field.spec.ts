/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Decimal Field
 *
 * Source: specs/app/tables/field-types/decimal-field/decimal-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Decimal Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-DECIMAL-FIELD-001: should create PostgreSQL DECIMAL column when table configuration has decimal field',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table configuration with decimal field 'price'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL DECIMAL/NUMERIC column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='price'"
      )
      expect(columnInfo.column_name).toBe('price')
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO products (price) VALUES (99.99) RETURNING price'
      )
      expect(validInsert.price).toBe('99.99')
    }
  )

  test.fixme(
    'APP-DECIMAL-FIELD-002: should reject values outside min/max range when CHECK constraint enforces range validation',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table with decimal field 'amount' (min=0, max=1000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_transactions',
            name: 'transactions',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'amount', type: 'decimal', min: 0, max: 1000 },
            ],
          },
        ],
      })

      // WHEN: CHECK constraint enforces range validation
      // THEN: PostgreSQL rejects values outside min/max range
      const validInsert = await executeQuery(
        'INSERT INTO transactions (amount) VALUES (500.50) RETURNING amount'
      )
      expect(parseFloat(validInsert.amount)).toBe(500.5)

      await expect(
        executeQuery('INSERT INTO transactions (amount) VALUES (-0.01)')
      ).rejects.toThrow(/violates check constraint/)

      await expect(
        executeQuery('INSERT INTO transactions (amount) VALUES (1000.01)')
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-DECIMAL-FIELD-003: should enforce NOT NULL and UNIQUE constraints when decimal field is required and unique',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table with decimal field 'value' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_measurements',
            name: 'measurements',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'value', type: 'decimal', unique: true, required: true },
            ],
          },
        ],
      })

      await executeQuery(['INSERT INTO measurements (value) VALUES (123.45)'])

      // WHEN: constraints are applied
      // THEN: PostgreSQL enforces NOT NULL and UNIQUE constraints
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='measurements' AND column_name='value'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      await expect(
        executeQuery('INSERT INTO measurements (value) VALUES (123.45)')
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      await expect(executeQuery('INSERT INTO measurements (value) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-DECIMAL-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table with decimal field 'rate' and default value 1.5
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_config',
            name: 'config',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rate', type: 'decimal', default: 1.5 },
            ],
          },
        ],
      })

      // WHEN: row inserted without providing rate value
      // THEN: PostgreSQL applies DEFAULT value 1.5
      const defaultInsert = await executeQuery(
        'INSERT INTO config (id) VALUES (DEFAULT) RETURNING rate'
      )
      expect(parseFloat(defaultInsert.rate)).toBe(1.5)

      const explicitInsert = await executeQuery(
        'INSERT INTO config (rate) VALUES (2.75) RETURNING rate'
      )
      expect(parseFloat(explicitInsert.rate)).toBe(2.75)
    }
  )

  test.fixme(
    'APP-DECIMAL-FIELD-005: should create btree index for fast numerical queries when decimal field has indexed=true',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: table configuration with decimal field 'score', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_scores',
            name: 'scores',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'score', type: 'decimal', required: true, indexed: true },
            ],
          },
        ],
      })

      // WHEN: index is created on the decimal field
      // THEN: PostgreSQL btree index exists for fast numerical queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_scores_score'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_scores_score',
        tablename: 'scores',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full decimal-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: Application configured with representative decimal field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'decimal_field',
                type: 'decimal',
                required: true,
                indexed: true,
                min: 0,
                max: 100,
                default: 50.5,
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='decimal_field'"
      )
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test precise decimal values
      await executeQuery('INSERT INTO data (decimal_field) VALUES (75.25)')
      const stored = await executeQuery('SELECT decimal_field FROM data WHERE id = 1')
      expect(parseFloat(stored.decimal_field)).toBe(75.25)
    }
  )
})

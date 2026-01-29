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
 * Source: src/domain/models/app/table/field-types/decimal-field.ts
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

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-001: should create PostgreSQL DECIMAL column when table configuration has decimal field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with decimal field 'price'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'price', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL DECIMAL/NUMERIC column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='price'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('price')
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO products (price) VALUES (99.99) RETURNING price'
      )
      // THEN: assertion
      expect(validInsert.price).toBe('99.99')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-002: should reject values outside min/max range when CHECK constraint enforces range validation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with decimal field 'amount' (min=0, max=1000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'transactions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'amount', type: 'decimal', min: 0, max: 1000 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: CHECK constraint enforces range validation
      // THEN: PostgreSQL rejects values outside min/max range
      const validInsert = await executeQuery(
        'INSERT INTO transactions (amount) VALUES (500.50) RETURNING amount'
      )
      // THEN: assertion
      expect(validInsert.amount).toBe('500.50')

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO transactions (amount) VALUES (-0.01)')
      ).rejects.toThrow(/violates check constraint/)

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO transactions (amount) VALUES (1000.01)')
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-003: should enforce NOT NULL and UNIQUE constraints when decimal field is required and unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with decimal field 'value' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'measurements',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'decimal', unique: true, required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO measurements (value) VALUES (123.45)'])

      // WHEN: constraints are applied
      // THEN: PostgreSQL enforces NOT NULL and UNIQUE constraints
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='measurements' AND column_name='value'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO measurements (value) VALUES (123.45)')
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO measurements (value) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with decimal field 'rate' and default value 1.5
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'config',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rate', type: 'decimal', default: 1.5 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing rate value
      // THEN: PostgreSQL applies DEFAULT value 1.5
      const defaultInsert = await executeQuery(
        'INSERT INTO config (id) VALUES (DEFAULT) RETURNING rate'
      )
      // THEN: assertion
      expect(parseFloat(defaultInsert.rate)).toBe(1.5)

      const explicitInsert = await executeQuery(
        'INSERT INTO config (rate) VALUES (2.75) RETURNING rate'
      )
      // THEN: assertion
      expect(parseFloat(explicitInsert.rate)).toBe(2.75)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-005: should create btree index for fast numerical queries when decimal field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with decimal field 'score', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'scores',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'score', type: 'decimal', required: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the decimal field
      // THEN: PostgreSQL btree index exists for fast numerical queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_scores_score'"
      )
      // THEN: assertion
      expect(indexExists.rows[0]).toEqual({
        indexname: 'idx_scores_score',
        tablename: 'scores',
      })
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DECIMAL-REGRESSION: user can complete full decimal-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with decimal fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'price', type: 'decimal' },
              { id: 3, name: 'amount', type: 'decimal', min: 0, max: 1000 },
              { id: 4, name: 'value', type: 'decimal', unique: true, required: true },
              { id: 5, name: 'rate', type: 'decimal', default: 1.5 },
              { id: 6, name: 'score', type: 'decimal', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-DECIMAL-001: Creates PostgreSQL DECIMAL column', async () => {
        // WHEN: querying column info for decimal field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='price'"
        )
        // THEN: DECIMAL/NUMERIC column is created
        expect(columnInfo.column_name).toBe('price')
        expect(columnInfo.data_type).toMatch(/numeric|decimal/)
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting decimal value
        const validInsert = await executeQuery(
          'INSERT INTO data (price, value) VALUES (99.99, 1.00) RETURNING price'
        )
        // THEN: value is stored correctly
        expect(validInsert.price).toBe('99.99')
      })

      await test.step('APP-TABLES-FIELD-TYPES-DECIMAL-002: Enforces range via CHECK constraint', async () => {
        // WHEN: inserting valid amount within range
        const validInsert = await executeQuery(
          'INSERT INTO data (amount, value) VALUES (500.50, 2.00) RETURNING amount'
        )
        // THEN: value is stored correctly
        expect(validInsert.amount).toBe('500.50')

        // WHEN: attempting to insert amount below min
        // THEN: CHECK constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (amount, value) VALUES (-0.01, 3.00)')
        ).rejects.toThrow(/violates check constraint/)

        // WHEN: attempting to insert amount above max
        // THEN: CHECK constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (amount, value) VALUES (1000.01, 4.00)')
        ).rejects.toThrow(/violates check constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DECIMAL-003: Enforces NOT NULL and UNIQUE constraints', async () => {
        // WHEN: querying NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='value'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: attempting to insert duplicate value
        // THEN: UNIQUE constraint rejects insertion
        await expect(executeQuery('INSERT INTO data (value) VALUES (1.00)')).rejects.toThrow(
          /duplicate key value violates unique constraint/
        )

        // WHEN: attempting to insert NULL for required value
        // THEN: NOT NULL constraint rejects insertion
        await expect(executeQuery('INSERT INTO data (value) VALUES (NULL)')).rejects.toThrow(
          /violates not-null constraint/
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-DECIMAL-004: Applies DEFAULT value', async () => {
        // WHEN: inserting row without providing rate value
        const defaultInsert = await executeQuery(
          'INSERT INTO data (value) VALUES (5.00) RETURNING rate'
        )
        // THEN: DEFAULT value is applied
        expect(parseFloat(defaultInsert.rate)).toBe(1.5)

        // WHEN: inserting with explicit value
        const explicitInsert = await executeQuery(
          'INSERT INTO data (value, rate) VALUES (6.00, 2.75) RETURNING rate'
        )
        // THEN: explicit value overrides default
        expect(parseFloat(explicitInsert.rate)).toBe(2.75)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DECIMAL-005: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed decimal field
        const indexExists = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_data_score'"
        )
        // THEN: btree index exists
        expect(indexExists).toMatchObject({
          indexname: 'idx_data_score',
          tablename: 'data',
        })
      })
    }
  )
})

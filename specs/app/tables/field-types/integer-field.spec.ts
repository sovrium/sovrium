/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Integer Field
 *
 * Source: specs/app/tables/field-types/integer-field/integer-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Integer Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-001: should create PostgreSQL INTEGER column when table configuration has integer field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with integer field 'quantity'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'quantity', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL INTEGER column is created (32-bit signed integer)
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='quantity'"
      )
      // THEN: assertion
      expect(columnInfo).toEqual({
        column_name: 'quantity',
        data_type: 'integer',
        is_nullable: 'YES',
      })

      const positiveInsert = await executeQuery(
        'INSERT INTO products (quantity) VALUES (42) RETURNING quantity'
      )
      // THEN: assertion
      expect(positiveInsert.quantity).toBe(42)

      const negativeInsert = await executeQuery(
        'INSERT INTO products (quantity) VALUES (-10) RETURNING quantity'
      )
      // THEN: assertion
      expect(negativeInsert.quantity).toBe(-10)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-002: should reject values outside min/max range when CHECK constraint enforces range validation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'inventory' with integer field 'stock' (min=0, max=1000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'inventory',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'stock', type: 'integer', min: 0, max: 1000 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: CHECK constraint enforces range validation
      // THEN: PostgreSQL rejects values outside min/max range
      const checkConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.check_constraints WHERE constraint_name LIKE '%stock%'"
      )
      // THEN: assertion
      expect(checkConstraint.count).toBe(1)

      const validInsert = await executeQuery(
        'INSERT INTO inventory (stock) VALUES (500) RETURNING stock'
      )
      // THEN: assertion
      expect(validInsert.stock).toBe(500)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO inventory (stock) VALUES (-1)')).rejects.toThrow(
        /violates check constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO inventory (stock) VALUES (1001)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-003: should enforce NOT NULL and UNIQUE constraints when integer field is required and unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with integer field 'order_number' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'order_number', type: 'integer', unique: true, required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO orders (order_number) VALUES (1001)'])

      // WHEN: constraints are applied
      // THEN: PostgreSQL enforces NOT NULL and UNIQUE constraints
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='orders' AND column_name='order_number'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='UNIQUE' AND constraint_name LIKE '%order_number%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBe(1)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO orders (order_number) VALUES (1001)')).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO orders (order_number) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'settings' with integer field 'timeout' and default value 30
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'settings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'timeout', type: 'integer', default: 30 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing timeout value
      // THEN: PostgreSQL applies DEFAULT value 30
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='settings' AND column_name='timeout'"
      )
      // THEN: assertion
      expect(defaultCheck.column_default).toBe('30')

      const defaultInsert = await executeQuery(
        'INSERT INTO settings (id) VALUES (DEFAULT) RETURNING timeout'
      )
      // THEN: assertion
      expect(defaultInsert.timeout).toBe(30)

      const explicitInsert = await executeQuery(
        'INSERT INTO settings (timeout) VALUES (60) RETURNING timeout'
      )
      // THEN: assertion
      expect(explicitInsert.timeout).toBe(60)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-005: should create btree index for fast numerical queries when integer field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with integer field 'score', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'leaderboard',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'score', type: 'integer', required: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the integer field
      // THEN: PostgreSQL btree index exists for fast numerical queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_leaderboard_score'"
      )
      // THEN: assertion
      expect(indexExists).toEqual({
        indexname: 'idx_leaderboard_score',
        tablename: 'leaderboard',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_leaderboard_score'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_leaderboard_score ON public.leaderboard USING btree (score)'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-INTEGER-006: user can complete full integer-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative integer field
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
                name: 'integer_field',
                type: 'integer',
                required: true,
                unique: true,
                indexed: true,
                min: 0,
                max: 100,
                default: 50,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='integer_field'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.is_nullable).toBe('NO')

      // Test range constraint
      // THEN: assertion
      await expect(executeQuery('INSERT INTO data (integer_field) VALUES (101)')).rejects.toThrow(
        /violates check constraint/
      )

      // Test valid value
      await executeQuery('INSERT INTO data (integer_field) VALUES (75)')

      // Test uniqueness
      // THEN: assertion
      await expect(executeQuery('INSERT INTO data (integer_field) VALUES (75)')).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )
    }
  )
})

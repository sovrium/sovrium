/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Barcode Field
 *
 * Source: src/domain/models/app/table/field-types/barcode-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Barcode Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-001: should create VARCHAR column for barcode storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [{ id: 1, name: 'barcode', type: 'barcode' }],
          },
        ],
      })
      // WHEN: querying the database
      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='products' AND column_name='barcode'"
      )
      // THEN: assertion
      expect(column.data_type).toBe('character varying')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-002: should enforce barcode format via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'items',
            fields: [{ id: 1, name: 'ean', type: 'barcode', format: 'EAN-13' }],
          },
        ],
      })
      // WHEN: executing query
      await expect(executeQuery("INSERT INTO items (ean) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-003: should store valid barcode values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'inventory',
            fields: [{ id: 1, name: 'code', type: 'barcode' }],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO inventory (code) VALUES ('1234567890123')")
      // WHEN: querying the database
      const result = await executeQuery('SELECT code FROM inventory WHERE id = 1')
      // THEN: assertion
      expect(result.code).toBe('1234567890123')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-004: should enforce UNIQUE constraint for barcode uniqueness',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'assets',
            fields: [{ id: 1, name: 'barcode', type: 'barcode', unique: true }],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO assets (barcode) VALUES ('ABC123')")
      // WHEN: executing query
      await expect(executeQuery("INSERT INTO assets (barcode) VALUES ('ABC123')")).rejects.toThrow(
        /duplicate key/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-005: should create index on barcode for fast lookups',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'shipments',
            fields: [{ id: 1, name: 'tracking', type: 'barcode', indexed: true }],
          },
        ],
      })
      // WHEN: querying the database
      const index = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_shipments_tracking'"
      )
      // THEN: assertion
      expect(index.indexname).toBe('idx_shipments_tracking')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-BARCODE-REGRESSION: user can complete full barcode-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with barcode fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'barcode', type: 'barcode' },
              { id: 2, name: 'ean', type: 'barcode', format: 'EAN-13' },
              { id: 3, name: 'code', type: 'barcode' },
              { id: 4, name: 'unique_barcode', type: 'barcode', unique: true },
              { id: 5, name: 'tracking', type: 'barcode', indexed: true },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-BARCODE-001: Creates VARCHAR column for barcode storage', async () => {
        // WHEN: querying column info for barcode field
        const column = await executeQuery(
          "SELECT data_type FROM information_schema.columns WHERE table_name='data' AND column_name='barcode'"
        )
        // THEN: VARCHAR column is created
        expect(column.data_type).toBe('character varying')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BARCODE-002: Enforces barcode format via CHECK constraint', async () => {
        // WHEN: attempting to insert invalid barcode format
        // THEN: CHECK constraint rejects insertion
        await expect(executeQuery("INSERT INTO data (ean) VALUES ('invalid')")).rejects.toThrow(
          /violates check constraint/
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-BARCODE-003: Stores valid barcode values', async () => {
        // WHEN: inserting valid barcode value
        await executeQuery("INSERT INTO data (code) VALUES ('1234567890123')")
        // WHEN: querying stored barcode value
        const result = await executeQuery('SELECT code FROM data WHERE code IS NOT NULL LIMIT 1')
        // THEN: barcode is stored correctly
        expect(result.code).toBe('1234567890123')
      })

      await test.step('APP-TABLES-FIELD-TYPES-BARCODE-004: Enforces UNIQUE constraint for barcode uniqueness', async () => {
        // WHEN: inserting first unique barcode
        await executeQuery("INSERT INTO data (unique_barcode) VALUES ('ABC123')")
        // WHEN: attempting to insert duplicate unique barcode
        // THEN: UNIQUE constraint rejects insertion
        await expect(
          executeQuery("INSERT INTO data (unique_barcode) VALUES ('ABC123')")
        ).rejects.toThrow(/duplicate key/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-BARCODE-005: Creates index on barcode for fast lookups', async () => {
        // WHEN: checking for btree index on indexed barcode field
        const index = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_data_tracking'"
        )
        // THEN: btree index exists
        expect(index.indexname).toBe('idx_data_tracking')
      })
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

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
    'APP-TABLES-FIELD-TYPES-BARCODE-006: user can complete full barcode-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with barcode field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [{ id: 1, name: 'barcode', type: 'barcode', unique: true }],
            },
          ],
        })
      })

      await test.step('Insert and verify barcode value', async () => {
        await executeQuery("INSERT INTO data (barcode) VALUES ('9876543210987')")
        const result = await executeQuery(
          "SELECT barcode FROM data WHERE barcode = '9876543210987'"
        )
        expect(result.barcode).toBe('9876543210987')
      })
    }
  )
})

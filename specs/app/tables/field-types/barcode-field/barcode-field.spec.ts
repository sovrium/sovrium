/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Barcode Field', () => {
  test.fixme(
    'APP-BARCODE-FIELD-001: should create VARCHAR column for barcode storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [{ name: 'barcode', type: 'barcode' }],
          },
        ],
      })
      const column = await executeQuery(
        "SELECT data_type FROM information_schema.columns WHERE table_name='products' AND column_name='barcode'"
      )
      expect(column.data_type).toBe('character varying')
    }
  )

  test.fixme(
    'APP-BARCODE-FIELD-002: should enforce barcode format via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [{ name: 'ean', type: 'barcode', format: 'EAN-13' }],
          },
        ],
      })
      await expect(executeQuery("INSERT INTO items (ean) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-BARCODE-FIELD-003: should store valid barcode values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_inventory',
            name: 'inventory',
            fields: [{ name: 'code', type: 'barcode' }],
          },
        ],
      })
      await executeQuery("INSERT INTO inventory (code) VALUES ('1234567890123')")
      const result = await executeQuery('SELECT code FROM inventory WHERE id = 1')
      expect(result.code).toBe('1234567890123')
    }
  )

  test.fixme(
    'APP-BARCODE-FIELD-004: should enforce UNIQUE constraint for barcode uniqueness',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_assets',
            name: 'assets',
            fields: [{ name: 'barcode', type: 'barcode', unique: true }],
          },
        ],
      })
      await executeQuery("INSERT INTO assets (barcode) VALUES ('ABC123')")
      await expect(executeQuery("INSERT INTO assets (barcode) VALUES ('ABC123')")).rejects.toThrow(
        /duplicate key/
      )
    }
  )

  test.fixme(
    'APP-BARCODE-FIELD-005: should create index on barcode for fast lookups',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_shipments',
            name: 'shipments',
            fields: [{ name: 'tracking', type: 'barcode', indexed: true }],
          },
        ],
      })
      const index = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_shipments_tracking'"
      )
      expect(index.indexname).toBe('idx_shipments_tracking')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-BARCODE-REGRESSION-001: user can complete full barcode-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [{ name: 'barcode', type: 'barcode', unique: true }],
          },
        ],
      })
      await executeQuery("INSERT INTO data (barcode) VALUES ('9876543210987')")
      const result = await executeQuery("SELECT barcode FROM data WHERE barcode = '9876543210987'")
      expect(result.barcode).toBe('9876543210987')
    }
  )
})

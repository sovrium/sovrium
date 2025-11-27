/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Modify Field Type Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-type/modify-field-type.json
 * Domain: migrations
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Type Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-TYPE-001: should alter table alter column type text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with field 'bio' (VARCHAR(255))
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, bio VARCHAR(255))`,
        `INSERT INTO users (name, bio) VALUES ('Alice', 'Short bio'), ('Bob', 'Another bio')`,
      ])

      // WHEN: field type changed to long-text (TEXT)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'bio', type: 'long-text' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN TYPE TEXT

      // Column type changed to TEXT
      const columnCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='bio'`
      )
      expect(columnCheck.data_type).toBe('text')

      // Existing data preserved
      const existingData = await executeQuery(`SELECT bio FROM users WHERE name = 'Alice'`)
      expect(existingData.bio).toBe('Short bio')

      // Can now store longer text
      const longText = 'A'.repeat(1000)
      await executeQuery(`UPDATE users SET bio = '${longText}' WHERE name = 'Bob'`)
      const updatedData = await executeQuery(`SELECT bio FROM users WHERE name = 'Bob'`)
      expect(updatedData.bio).toBe(longText)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-TYPE-002: should alter table alter column type varchar(50) using left(sku, 50)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with field 'sku' (TEXT)
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sku TEXT)`,
        `INSERT INTO products (name, sku) VALUES ('Widget', 'SKU-123'), ('Gadget', '${'X'.repeat(100)}')`,
      ])

      // WHEN: field type changed to single-line-text with maxLength=50
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'sku', type: 'single-line-text', maxLength: 50 },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN TYPE VARCHAR(50) USING LEFT(sku, 50)

      // Column type changed to VARCHAR(50)
      const columnCheck = await executeQuery(
        `SELECT character_maximum_length FROM information_schema.columns WHERE table_name='products' AND column_name='sku'`
      )
      expect(columnCheck.character_maximum_length).toBe(50)

      // Short SKU preserved
      const shortSku = await executeQuery(`SELECT sku FROM products WHERE name = 'Widget'`)
      expect(shortSku.sku).toBe('SKU-123')

      // Long SKU truncated to 50 characters
      const truncatedSku = await executeQuery(`SELECT sku FROM products WHERE name = 'Gadget'`)
      expect(truncatedSku.sku.length).toBe(50)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-TYPE-003: should alter table alter column type numeric(10,2)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with field 'total' (INTEGER)
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL, total INTEGER)`,
        `INSERT INTO orders (order_number, total) VALUES ('ORD-001', 100), ('ORD-002', 250)`,
      ])

      // WHEN: field type changed to decimal
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'order_number', type: 'single-line-text', required: true },
              { id: 3, name: 'total', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN TYPE NUMERIC(10,2)

      // Column type changed to NUMERIC
      const columnCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='total'`
      )
      expect(columnCheck.data_type).toBe('numeric')

      // Existing integer values converted
      const existingData = await executeQuery(
        `SELECT total FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(parseFloat(existingData.total)).toBe(100.0)

      // Can now store decimal values
      await executeQuery(`INSERT INTO orders (order_number, total) VALUES ('ORD-003', 199.99)`)
      const decimalData = await executeQuery(
        `SELECT total FROM orders WHERE order_number = 'ORD-003'`
      )
      expect(decimalData.total).toBe('199.99')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-TYPE-004: should alter table alter column type integer using count::integer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'metrics' with field 'count' stored as TEXT
      await executeQuery([
        `CREATE TABLE metrics (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, count TEXT)`,
        `INSERT INTO metrics (name, count) VALUES ('page_views', '1500'), ('clicks', '250')`,
      ])

      // WHEN: field type changed to integer
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'metrics',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'count', type: 'integer' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN TYPE INTEGER USING count::INTEGER

      // Column type changed to INTEGER
      const columnCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='metrics' AND column_name='count'`
      )
      expect(columnCheck.data_type).toBe('integer')

      // Text values converted to integers
      const existingData = await executeQuery(`SELECT count FROM metrics WHERE name = 'page_views'`)
      expect(existingData.count).toBe(1500)

      // Can perform arithmetic operations
      await executeQuery(`UPDATE metrics SET count = count + 100 WHERE name = 'clicks'`)
      const updatedData = await executeQuery(`SELECT count FROM metrics WHERE name = 'clicks'`)
      expect(updatedData.count).toBe(350)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-TYPE-005: should alter table alter column type timestamptz using occurred_at::timestamptz',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'events' with field 'occurred_at' (TEXT) containing ISO-8601 strings
      await executeQuery([
        `CREATE TABLE events (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, occurred_at TEXT)`,
        `INSERT INTO events (name, occurred_at) VALUES ('signup', '2024-01-15T10:30:00Z'), ('purchase', '2024-02-20T14:45:00Z')`,
      ])

      // WHEN: field type changed to timestamp
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'occurred_at', type: 'datetime' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN TYPE TIMESTAMPTZ USING occurred_at::TIMESTAMPTZ

      // Column type changed to TIMESTAMPTZ
      const columnCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='events' AND column_name='occurred_at'`
      )
      expect(columnCheck.data_type).toMatch(/timestamp/i)

      // ISO-8601 strings converted to timestamps
      const existingData = await executeQuery(
        `SELECT occurred_at FROM events WHERE name = 'signup'`
      )
      expect(existingData.occurred_at).toBeInstanceOf(Date)

      // Can perform timestamp operations
      const rangeQuery = await executeQuery(
        `SELECT COUNT(*) as count FROM events WHERE occurred_at > '2024-01-01'::timestamptz`
      )
      expect(rangeQuery.count).toBe(2)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-TYPE-006: should migration fails with data conversion error, transaction rolled back',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'data' with field 'value' (TEXT) containing non-numeric values
      await executeQuery([
        `CREATE TABLE data (id SERIAL PRIMARY KEY, label VARCHAR(255) NOT NULL, value TEXT)`,
        `INSERT INTO data (label, value) VALUES ('numeric', '42'), ('invalid', 'not-a-number')`,
      ])

      // WHEN: field type changed to INTEGER
      // THEN: Migration fails with data conversion error, transaction rolled back
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'label', type: 'single-line-text', required: true },
                { id: 3, name: 'value', type: 'integer' },
              ],
            },
          ],
        })
      }).rejects.toThrow(/invalid input syntax|cannot be cast/i)

      // Original data unchanged (migration rolled back)
      const originalData = await executeQuery(`SELECT value FROM data WHERE label = 'invalid'`)
      expect(originalData.value).toBe('not-a-number')

      // Column type remains TEXT
      const columnCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='data' AND column_name='value'`
      )
      expect(columnCheck.data_type).toBe('text')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-TYPE-007: user can complete full modify-field-type workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative modify-field-type scenarios
      await executeQuery([
        `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, quantity TEXT, price INTEGER)`,
        `INSERT INTO items (name, quantity, price) VALUES ('Widget', '100', 50), ('Gadget', '200', 75)`,
      ])

      // WHEN: Change quantity TEXT→INTEGER and price INTEGER→DECIMAL
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'quantity', type: 'integer' },
              { id: 4, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: Both type changes applied successfully

      // Quantity converted from TEXT to INTEGER
      const quantityCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='items' AND column_name='quantity'`
      )
      expect(quantityCheck.data_type).toBe('integer')

      // Price converted from INTEGER to NUMERIC
      const priceCheck = await executeQuery(
        `SELECT data_type FROM information_schema.columns WHERE table_name='items' AND column_name='price'`
      )
      expect(priceCheck.data_type).toBe('numeric')

      // Existing data preserved and converted
      const existingData = await executeQuery(
        `SELECT quantity, price FROM items WHERE name = 'Widget'`
      )
      expect(existingData.quantity).toBe(100)
      expect(parseFloat(existingData.price)).toBe(50.0)
    }
  )
})

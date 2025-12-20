/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Add Field Migration
 *
 * Source: src/domain/models/app/table/index.ts (Effect Schema)
 * Domain: migrations
 * Spec Count: 6
 *
 * Soft Delete Migration:
 * - Adding deleted_at field to existing table creates TIMESTAMP NULL column
 * - Existing records remain active (deleted_at = NULL) after migration
 * - Index is created when indexed=true for fast soft-delete queries
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Add Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-ALTER-ADD-001: should add TEXT NOT NULL column to existing table when runtime migration generates ALTER TABLE ADD COLUMN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with email field exists, new field 'name' (single-line-text, required) is added to schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', unique: true },
            ],
          },
        ],
      })
      await executeQuery([`INSERT INTO users (id, email) VALUES (1, 'user@example.com')`])

      // WHEN: runtime migration generates ALTER TABLE ADD COLUMN
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', unique: true },
              { id: 3, name: 'name', type: 'single-line-text', required: true, default: '' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT NOT NULL column to existing table

      // Column added to existing table
      const columnCheck = await executeQuery(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='name'`
      )
      // THEN: assertion
      expect(columnCheck.column_name).toBe('name')
      expect(columnCheck.data_type).toBe('character varying')
      expect(columnCheck.is_nullable).toBe('NO')

      // Existing data preserved after migration
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE email = 'user@example.com'`
      )
      // THEN: assertion
      expect(dataCheck.count).toBe('1')
    }
  )

  test(
    'MIGRATION-ALTER-ADD-002: should add TEXT column without NOT NULL constraint when ALTER TABLE adds nullable column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with title field, new optional field 'description' (long-text) is added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO products (id, title) VALUES (1, 'MacBook Pro'), (2, 'iPhone 15')`,
      ])

      // WHEN: ALTER TABLE adds nullable column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'description', type: 'single-line-text' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT column without NOT NULL constraint

      // Nullable column added
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='description'`
      )
      // THEN: assertion
      expect(columnCheck.is_nullable).toBe('YES')

      // Existing records have NULL for new column
      const dataCheck = await executeQuery(
        `SELECT title, description FROM products WHERE title = 'MacBook Pro'`
      )
      // THEN: assertion
      expect(dataCheck.title).toBe('MacBook Pro')
      expect(dataCheck.description).toBeNull()
    }
  )

  test(
    'MIGRATION-ALTER-ADD-003: should add TEXT column with CHECK constraint for enum values when ALTER TABLE adds column with CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' exists, new field 'priority' (single-select with options) is added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      // WHEN: ALTER TABLE adds column with CHECK constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT column with CHECK constraint for enum values

      // CHECK constraint enforced after addition
      const validInsert = await executeQuery(
        `INSERT INTO tasks (title, priority) VALUES ('Valid task', 'high') RETURNING priority`
      )
      // THEN: assertion
      expect(validInsert.priority).toBe('high')

      // Invalid enum value rejected
      // THEN: assertion
      await expect(async () => {
        await executeQuery(
          `INSERT INTO tasks (title, priority) VALUES ('Invalid task', 'critical')`
        )
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  test(
    'MIGRATION-ALTER-ADD-004: should add column with default value applied to existing rows when ALTER TABLE adds column with DEFAULT',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' exists with data, new field 'total' (decimal) with default: 0 is added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [{ id: 1, name: 'order_number', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery([`INSERT INTO orders (order_number) VALUES ('ORD-001'), ('ORD-002')`])

      // WHEN: ALTER TABLE adds column with DEFAULT
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              { id: 1, name: 'order_number', type: 'single-line-text' },
              { id: 2, name: 'total', type: 'decimal', default: 0 },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds column with default value applied to existing rows

      // Default applied to existing rows
      const existingRow = await executeQuery(
        `SELECT order_number, total FROM orders WHERE order_number = 'ORD-001'`
      )
      // THEN: assertion
      expect(existingRow.order_number).toBe('ORD-001')
      expect(parseFloat(existingRow.total)).toBe(0) // NUMERIC returned as string by pg

      // New rows can override default
      const newRow = await executeQuery(
        `INSERT INTO orders (order_number, total) VALUES ('ORD-003', 150.50) RETURNING total`
      )
      // THEN: assertion
      expect(parseFloat(newRow.total)).toBe(150.5) // NUMERIC returned as string by pg
    }
  )

  // ============================================================================
  // Soft Delete Migration Tests
  // ============================================================================

  test(
    'MIGRATION-ALTER-ADD-005: should add deleted_at TIMESTAMP NULL column with index',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' exists without deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO tasks (id, title) VALUES (1, 'Task 1'), (2, 'Task 2'), (3, 'Task 3')`,
      ])

      // WHEN: deleted_at field with index is added via schema migration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TIMESTAMP NULL column (nullable by design)
      const columnCheck = await executeQuery(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name='tasks' AND column_name='deleted_at'`
      )
      expect(columnCheck.column_name).toBe('deleted_at')
      expect(columnCheck.data_type).toMatch(/timestamp/)
      expect(columnCheck.is_nullable).toBe('YES') // Must be nullable for soft delete
      expect(columnCheck.column_default).toBeNull() // No default (unlike created_at)

      // THEN: Btree index is created for fast soft-delete queries
      const indexCheck = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tasks_deleted_at'`
      )
      expect(indexCheck.indexname).toBe('idx_tasks_deleted_at')
    }
  )

  test(
    'MIGRATION-ALTER-ADD-006: should preserve existing records as non-deleted (NULL)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'items' exists with data, no deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO items (name, status) VALUES
          ('Item 1', 'active'),
          ('Item 2', 'pending'),
          ('Item 3', 'completed')`,
      ])

      // WHEN: deleted_at field is added via schema migration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'items',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'deleted_at', type: 'deleted-at' },
            ],
          },
        ],
      })

      // THEN: All existing records remain active (deleted_at = NULL)
      const recordsCheck = await executeQuery(`SELECT id, name, deleted_at FROM items ORDER BY id`)
      expect(recordsCheck.rows).toHaveLength(3)
      expect(recordsCheck.rows[0].deleted_at).toBeNull()
      expect(recordsCheck.rows[1].deleted_at).toBeNull()
      expect(recordsCheck.rows[2].deleted_at).toBeNull()

      // THEN: New records can still use soft delete
      await executeQuery(
        `INSERT INTO items (name, status, deleted_at) VALUES ('Item 4', 'deleted', NOW())`
      )
      const newRecord = await executeQuery(`SELECT deleted_at FROM items WHERE name = 'Item 4'`)
      expect(newRecord.deleted_at).toBeTruthy()

      // THEN: Soft delete can be applied to existing records
      await executeQuery(`UPDATE items SET deleted_at = NOW() WHERE id = 2`)
      const softDeletedRecord = await executeQuery(`SELECT deleted_at FROM items WHERE id = 2`)
      expect(softDeletedRecord.deleted_at).toBeTruthy()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'MIGRATION-ALTER-ADD-007: user can complete full add-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Add optional field to table', async () => {
        // GIVEN: table 'data' exists with initial data
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 7,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
              ],
            },
          ],
        })
        await executeQuery([`INSERT INTO data (id, title) VALUES (1, 'Initial record')`])

        // WHEN: optional field 'description' is added via schema migration
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 7,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
                { id: 3, name: 'description', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Verify nullable column added and data preserved', async () => {
        // Verify nullable column added
        const columnCheck = await executeQuery(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='description'`
        )
        expect(columnCheck.is_nullable).toBe('YES')

        // Existing data preserved
        const dataCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM data WHERE title = 'Initial record'`
        )
        expect(dataCheck.count).toBe('1')
      })
    }
  )
})

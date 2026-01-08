/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Remove Field Migration
 *
 * Source: src/domain/models/app/table/index.ts (Effect Schema)
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Remove Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-ALTER-REMOVE-001: should remove phone column and preserve other columns when runtime migration generates ALTER TABLE DROP COLUMN',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'contacts' with email and phone fields, phone field is removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'phone', type: 'phone-number' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO contacts (id, email, phone) VALUES (1, 'user@example.com', '+1-555-0100')`,
      ])

      // WHEN: runtime migration generates ALTER TABLE DROP COLUMN
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            allowDestructive: true, // Allow column drop
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL removes phone column and preserves other columns

      // Column removed from table
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='contacts' AND column_name='phone'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe('0')

      // Other columns preserved
      const dataCheck = await executeQuery(
        `SELECT email FROM contacts WHERE email = 'user@example.com'`
      )
      // THEN: assertion
      expect(dataCheck.email).toBe('user@example.com')
    }
  )

  test(
    'MIGRATION-ALTER-REMOVE-002: should drop column and preserve column order for remaining fields when ALTER TABLE removes column from middle of schema',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with multiple fields, middle field is removed
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'description', type: 'long-text' },
              { id: 4, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO products (id, title, description, price) VALUES (1, 'Product A', 'Description A', 99.99)`,
      ])

      // WHEN: ALTER TABLE removes column from middle of schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            allowDestructive: true, // Allow column drop
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 4, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL drops column and preserves column order for remaining fields

      // Column removed
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='products' AND column_name='description'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe('0')

      // Remaining columns accessible
      const dataCheck = await executeQuery(`SELECT title, price FROM products WHERE id = 1`)
      // THEN: assertion
      expect(dataCheck.title).toBe('Product A')
      expect(parseFloat(dataCheck.price)).toBe(99.99) // NUMERIC returned as string by pg
    }
  )

  test(
    'MIGRATION-ALTER-REMOVE-003: should automatically drop associated index when ALTER TABLE drops column with index',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with indexed field, indexed field is removed
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text', indexed: true },
            ],
          },
        ],
      })
      await executeQuery([`INSERT INTO tasks (id, title, status) VALUES (1, 'Task 1', 'open')`])

      // WHEN: ALTER TABLE drops column with index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            allowDestructive: true, // Allow column drop
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL automatically drops associated index

      // Column dropped
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='tasks' AND column_name='status'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe('0')

      // Associated index automatically dropped
      const indexCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='tasks' AND indexname='idx_tasks_status'`
      )
      // THEN: assertion
      expect(indexCheck.count).toBe('0')
    }
  )

  test(
    'MIGRATION-ALTER-REMOVE-004: should remove column and CASCADE drop foreign key constraint when ALTER TABLE drops column with foreign key constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with foreign key field, relationship field is removed
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 5,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'total', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })
      await executeQuery([
        `INSERT INTO customers (id, name) VALUES (1, 'Customer A')`,
        `INSERT INTO orders (id, customer_id, total) VALUES (1, 1, 150.00)`,
      ])

      // WHEN: ALTER TABLE drops column with foreign key constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
          {
            id: 5,
            name: 'orders',
            allowDestructive: true, // Allow column drop
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 3, name: 'total', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // THEN: PostgreSQL removes column and CASCADE drops foreign key constraint

      // Foreign key column dropped
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_id'`
      )
      // THEN: assertion
      expect(columnCheck.count).toBe('0')

      // Foreign key constraint removed
      const fkCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='FOREIGN KEY'`
      )
      // THEN: assertion
      expect(fkCheck.count).toBe('0')

      // Data in remaining columns preserved
      const dataCheck = await executeQuery(`SELECT total FROM orders WHERE id = 1`)
      // THEN: assertion
      expect(parseFloat(dataCheck.total)).toBe(150) // NUMERIC returned as string by pg
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'MIGRATION-ALTER-REMOVE-REGRESSION: user can complete full remove-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create table with indexed field and data', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'description', type: 'single-line-text' },
                { id: 4, name: 'status', type: 'single-line-text', indexed: true },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO data (id, title, description, status) VALUES (1, 'Record 1', 'Desc 1', 'active')`,
        ])
      })

      await test.step('Remove indexed field from table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'description', type: 'single-line-text' },
              ],
              allowDestructive: true, // Allow column drop
            },
          ],
        })
      })

      await test.step('Verify field and index removed, data preserved', async () => {
        // Verify column removed
        const columnCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='data' AND column_name='status'`
        )
        expect(columnCheck.count).toBe('0')

        // Verify index removed
        const indexCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname='idx_data_status'`
        )
        expect(indexCheck.count).toBe('0')

        // Existing data preserved
        const dataCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM data WHERE title = 'Record 1'`
        )
        expect(dataCheck.count).toBe('1')
      })
    }
  )
})

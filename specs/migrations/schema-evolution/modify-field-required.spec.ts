/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Modify Field Required Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-required/modify-field-required.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Required Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-REQUIRED-001: should alter table alter column set not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with optional field 'phone' (TEXT NULL), no rows exist
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, phone TEXT)`,
      ])

      // WHEN: field marked as required in schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'phone', type: 'phone-number', required: true },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN SET NOT NULL

      // Column is now NOT NULL
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='phone'`
      )
      expect(columnCheck.is_nullable).toBe('NO')

      // Cannot insert NULL value
      await expect(async () => {
        await executeQuery(`INSERT INTO users (name, phone) VALUES ('Alice', NULL)`)
      }).rejects.toThrow(/null value|violates not-null/i)

      // Can insert with value
      const validInsert = await executeQuery(
        `INSERT INTO users (name, phone) VALUES ('Bob', '+1234567890') RETURNING phone`
      )
      expect(validInsert.phone).toBe('+1234567890')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-REQUIRED-002: should migration fails with error (cannot add not null without default when data exists)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with optional field 'category' (TEXT NULL), existing rows present
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category TEXT)`,
        `INSERT INTO products (name, category) VALUES ('Widget', 'Electronics'), ('Gadget', NULL)`,
      ])

      // WHEN: field marked as required without default value
      // THEN: Migration fails with error (cannot add NOT NULL without default when data exists)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'category', type: 'single-line-text', required: true }, // No default
              ],
            },
          ],
        })
      }).rejects.toThrow(/null value|violates not-null|contains null/i)

      // Original data unchanged (migration rolled back)
      const gadget = await executeQuery(`SELECT category FROM products WHERE name = 'Gadget'`)
      expect(gadget.category).toBeNull()
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-REQUIRED-003: should alter table set default, backfill null values, then set not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with optional field 'status', existing rows present
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL, status TEXT)`,
        `INSERT INTO orders (order_number, status) VALUES ('ORD-001', 'shipped'), ('ORD-002', NULL)`,
      ])

      // WHEN: field marked as required with default value 'pending'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 3,
                name: 'status',
                type: 'single-line-text',
                required: true,
                default: 'pending',
              },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE SET DEFAULT, backfill NULL values, then SET NOT NULL

      // Column is now NOT NULL
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='orders' AND column_name='status'`
      )
      expect(columnCheck.is_nullable).toBe('NO')

      // Previously NULL values backfilled with default
      const backfilled = await executeQuery(
        `SELECT status FROM orders WHERE order_number = 'ORD-002'`
      )
      expect(backfilled.status).toBe('pending')

      // Existing non-NULL values preserved
      const preserved = await executeQuery(
        `SELECT status FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(preserved.status).toBe('shipped')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-REQUIRED-004: should alter table alter column drop not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with required field 'priority' (TEXT NOT NULL)
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, priority TEXT NOT NULL)`,
        `INSERT INTO tasks (title, priority) VALUES ('Task 1', 'high'), ('Task 2', 'medium')`,
      ])

      // WHEN: field marked as optional in schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'priority', type: 'single-line-text' }, // Now optional
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN DROP NOT NULL

      // Column is now nullable
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority'`
      )
      expect(columnCheck.is_nullable).toBe('YES')

      // Can now insert NULL value
      await executeQuery(`INSERT INTO tasks (title, priority) VALUES ('Task 3', NULL)`)
      const newTask = await executeQuery(`SELECT priority FROM tasks WHERE title = 'Task 3'`)
      expect(newTask.priority).toBeNull()

      // Existing data preserved
      const existingTask = await executeQuery(`SELECT priority FROM tasks WHERE title = 'Task 1'`)
      expect(existingTask.priority).toBe('high')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-REQUIRED-005: user can complete full modify-field-required workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: create items table with optional description field', async () => {
        await executeQuery([
          `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT)`,
          `INSERT INTO items (name, description) VALUES ('Item 1', 'Has description'), ('Item 2', NULL)`,
        ])
      })

      await test.step('Make description required with default backfill', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                {
                  id: 3,
                  name: 'description',
                  type: 'long-text',
                  required: true,
                  default: 'No description',
                },
              ],
            },
          ],
        })
      })

      await test.step('Verify NULL values backfilled and column is NOT NULL', async () => {
        // Previously NULL backfilled
        const backfilled = await executeQuery(`SELECT description FROM items WHERE name = 'Item 2'`)
        expect(backfilled.description).toBe('No description')

        // Existing value preserved
        const preserved = await executeQuery(`SELECT description FROM items WHERE name = 'Item 1'`)
        expect(preserved.description).toBe('Has description')

        // Column is now NOT NULL
        const columnCheck = await executeQuery(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name='items' AND column_name='description'`
        )
        expect(columnCheck.is_nullable).toBe('NO')
      })
    }
  )
})

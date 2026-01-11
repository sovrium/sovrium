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

  test(
    'MIGRATION-MODIFY-REQUIRED-001: should alter table alter column set not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with optional field 'phone' (TEXT NULL), no rows exist
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'phone', type: 'phone-number' }, // nullable initially
            ],
          },
        ],
      })

      // WHEN: field marked as required in schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'phone', type: 'phone-number', required: true }, // now required
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

  test(
    'MIGRATION-MODIFY-REQUIRED-002: should migration fails with error (cannot add not null without default when data exists)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with optional field 'category' (TEXT NULL), existing rows present
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'category', type: 'single-line-text' }, // nullable initially
            ],
          },
        ],
      })
      await executeQuery([
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
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'category', type: 'single-line-text', required: true }, // now required, no default
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

  test(
    'MIGRATION-MODIFY-REQUIRED-003: should alter table set default, backfill null values, then set not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with optional field 'status', existing rows present
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
              },
              { id: 3, name: 'status', type: 'single-line-text' }, // nullable initially
            ],
          },
        ],
      })
      await executeQuery([
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
                required: true, // now required
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

  test(
    'MIGRATION-MODIFY-REQUIRED-004: should alter table alter column drop not null',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with required field 'priority' (TEXT NOT NULL)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'priority', type: 'single-line-text', required: true }, // required initially
            ],
          },
        ],
      })
      await executeQuery([
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
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'priority', type: 'single-line-text' }, // now optional
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
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 4 @spec tests - covers: SET NOT NULL, migration failure, backfill, DROP NOT NULL
  // ============================================================================

  test(
    'MIGRATION-MODIFY-REQUIRED-REGRESSION: user can complete full modify-field-required workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-MODIFY-REQUIRED-001: alters column to SET NOT NULL on empty table', async () => {
        // GIVEN: table 'users' with optional field 'phone', no rows exist
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'phone', type: 'phone-number' }, // nullable initially
              ],
            },
          ],
        })

        // WHEN: field marked as required in schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'phone', type: 'phone-number', required: true },
              ],
            },
          ],
        })

        // THEN: column is now NOT NULL
        const columnCheck = await executeQuery(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='phone'`
        )
        expect(columnCheck.is_nullable).toBe('NO')

        // Can insert with value
        const validInsert = await executeQuery(
          `INSERT INTO users (name, phone) VALUES ('Bob', '+1234567890') RETURNING phone`
        )
        expect(validInsert.phone).toBe('+1234567890')
      })

      await test.step('MIGRATION-MODIFY-REQUIRED-002: fails when NULL data exists without default', async () => {
        // GIVEN: table 'products' with optional field 'category', existing rows with NULL
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'category', type: 'single-line-text' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO products (name, category) VALUES ('Widget', 'Electronics'), ('Gadget', NULL)`,
        ])

        // WHEN: field marked as required without default value
        // THEN: Migration fails with error
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 2,
                name: 'products',
                fields: [
                  { id: 2, name: 'name', type: 'single-line-text', required: true },
                  { id: 3, name: 'category', type: 'single-line-text', required: true },
                ],
              },
            ],
          })
        }).rejects.toThrow(/null value|violates not-null|contains null/i)

        // Original data unchanged (migration rolled back)
        const gadget = await executeQuery(`SELECT category FROM products WHERE name = 'Gadget'`)
        expect(gadget.category).toBeNull()
      })

      await test.step('MIGRATION-MODIFY-REQUIRED-003: backfills NULL values then sets NOT NULL', async () => {
        // GIVEN: table 'orders' with optional field 'status', existing rows present
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'orders',
              fields: [
                { id: 2, name: 'order_number', type: 'single-line-text', required: true },
                { id: 3, name: 'status', type: 'single-line-text' },
              ],
            },
          ],
        })
        await executeQuery([
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
                { id: 2, name: 'order_number', type: 'single-line-text', required: true },
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

        // THEN: column is now NOT NULL
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
      })

      await test.step('MIGRATION-MODIFY-REQUIRED-004: drops NOT NULL to make column optional', async () => {
        // GIVEN: table 'tasks' with required field 'priority'
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'tasks',
              fields: [
                { id: 2, name: 'title', type: 'single-line-text', required: true },
                { id: 3, name: 'priority', type: 'single-line-text', required: true },
              ],
            },
          ],
        })
        await executeQuery([
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
                { id: 2, name: 'title', type: 'single-line-text', required: true },
                { id: 3, name: 'priority', type: 'single-line-text' },
              ],
            },
          ],
        })

        // THEN: column is now nullable
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
      })
    }
  )
})

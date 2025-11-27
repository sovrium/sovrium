/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Modify Field Default Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-default/modify-field-default.json
 * Domain: migrations
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Default Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    "MIG-MODIFY-DEFAULT-001: should alter table alter column set default 'medium'",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with priority field (TEXT), no default value
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, priority TEXT)`,
        `INSERT INTO tasks (title, priority) VALUES ('Task 1', 'high'), ('Task 2', 'low')`,
      ])

      // WHEN: default value 'medium' added to schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'priority', type: 'single-line-text', default: 'medium' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN SET DEFAULT 'medium'

      // Column has default value
      const defaultCheck = await executeQuery(
        `SELECT column_default FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority'`
      )
      expect(defaultCheck.column_default).toContain('medium')

      // New rows get default value
      await executeQuery(`INSERT INTO tasks (title) VALUES ('Task 3')`)
      const newTask = await executeQuery(`SELECT priority FROM tasks WHERE title = 'Task 3'`)
      expect(newTask.priority).toBe('medium')

      // Existing data unchanged
      const existingTask = await executeQuery(`SELECT priority FROM tasks WHERE title = 'Task 1'`)
      expect(existingTask.priority).toBe('high')
    }
  )

  test.fixme(
    "MIG-MODIFY-DEFAULT-002: should alter table alter column set default 'pending' (replaces old default)",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with status field, existing default 'draft'
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, status TEXT DEFAULT 'draft')`,
        `INSERT INTO products (name) VALUES ('Product A')`,
      ])

      // WHEN: default value changed from 'draft' to 'pending'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'status', type: 'single-line-text', default: 'pending' },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN SET DEFAULT 'pending' (replaces old default)

      // New default is 'pending'
      const defaultCheck = await executeQuery(
        `SELECT column_default FROM information_schema.columns WHERE table_name='products' AND column_name='status'`
      )
      expect(defaultCheck.column_default).toContain('pending')

      // New rows get new default
      await executeQuery(`INSERT INTO products (name) VALUES ('Product B')`)
      const newProduct = await executeQuery(`SELECT status FROM products WHERE name = 'Product B'`)
      expect(newProduct.status).toBe('pending')

      // Existing row keeps old value (was 'draft')
      const existingProduct = await executeQuery(
        `SELECT status FROM products WHERE name = 'Product A'`
      )
      expect(existingProduct.status).toBe('draft')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-DEFAULT-003: should alter table alter column drop default',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with created_at field, existing default NOW()
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`,
        `INSERT INTO orders (order_number) VALUES ('ORD-001')`,
      ])

      // WHEN: default value removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'order_number', type: 'single-line-text', required: true },
              { id: 3, name: 'created_at', type: 'datetime' }, // No default
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ALTER COLUMN DROP DEFAULT

      // Column no longer has default
      const defaultCheck = await executeQuery(
        `SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='created_at'`
      )
      expect(defaultCheck.column_default).toBeNull()

      // Inserting without value requires explicit value or fails
      await expect(async () => {
        await executeQuery(`INSERT INTO orders (order_number) VALUES ('ORD-002')`)
      }).rejects.toThrow(/null value|violates not-null/i)

      // Explicit value still works
      const explicitInsert = await executeQuery(
        `INSERT INTO orders (order_number, created_at) VALUES ('ORD-003', '2024-01-15T10:00:00Z') RETURNING created_at`
      )
      expect(explicitInsert.created_at).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-DEFAULT-004: user can complete full modify-field-default workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative modify-field-default scenarios
      await executeQuery([
        `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, status TEXT)`,
        `INSERT INTO items (name, status) VALUES ('Item 1', 'active')`,
      ])

      // WHEN: Add default value to status field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'status', type: 'single-line-text', default: 'draft' },
            ],
          },
        ],
      })

      // THEN: Default value applied to new rows

      // New row gets default
      await executeQuery(`INSERT INTO items (name) VALUES ('Item 2')`)
      const newItem = await executeQuery(`SELECT status FROM items WHERE name = 'Item 2'`)
      expect(newItem.status).toBe('draft')

      // Existing row unchanged
      const existingItem = await executeQuery(`SELECT status FROM items WHERE name = 'Item 1'`)
      expect(existingItem.status).toBe('active')
    }
  )
})

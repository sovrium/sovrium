/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Modify Field Options Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-options/modify-field-options.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Options Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-OPTIONS-001: should drop check constraint, add new check with additional value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with status field (enum: 'pending', 'in_progress', 'completed')
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')))`,
        `INSERT INTO tasks (title, status) VALUES ('Task 1', 'pending'), ('Task 2', 'completed')`,
      ])

      // WHEN: new option 'archived' added to enum
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'status',
                type: 'single-select',
                options: ['pending', 'in_progress', 'completed', 'archived'],
              },
            ],
          },
        ],
      })

      // THEN: DROP CHECK constraint, ADD new CHECK with additional value

      // New option 'archived' is now valid
      const newStatus = await executeQuery(
        `INSERT INTO tasks (title, status) VALUES ('Task 3', 'archived') RETURNING status`
      )
      expect(newStatus.status).toBe('archived')

      // Original options still valid
      const originalStatus = await executeQuery(
        `INSERT INTO tasks (title, status) VALUES ('Task 4', 'in_progress') RETURNING status`
      )
      expect(originalStatus.status).toBe('in_progress')

      // Invalid option still rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO tasks (title, status) VALUES ('Task 5', 'invalid')`)
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-OPTIONS-002: should drop check constraint, add new check without removed value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with category field (enum: 'electronics', 'clothing', 'books', 'furniture'), no rows use 'furniture'
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category TEXT CHECK (category IN ('electronics', 'clothing', 'books', 'furniture')))`,
        `INSERT INTO products (name, category) VALUES ('Laptop', 'electronics'), ('Shirt', 'clothing')`,
      ])

      // WHEN: option 'furniture' removed from enum
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'category',
                type: 'single-select',
                options: ['electronics', 'clothing', 'books'], // 'furniture' removed
              },
            ],
          },
        ],
      })

      // THEN: DROP CHECK constraint, ADD new CHECK without removed value

      // Removed option 'furniture' now rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO products (name, category) VALUES ('Chair', 'furniture')`)
      }).rejects.toThrow(/violates check constraint/i)

      // Remaining options still valid
      const validCategory = await executeQuery(
        `INSERT INTO products (name, category) VALUES ('Novel', 'books') RETURNING category`
      )
      expect(validCategory.category).toBe('books')

      // Existing data preserved
      const existingProduct = await executeQuery(
        `SELECT category FROM products WHERE name = 'Laptop'`
      )
      expect(existingProduct.category).toBe('electronics')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-OPTIONS-003: should migration fails with data validation error (existing data uses removed option)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with priority field (enum: 'low', 'medium', 'high'), existing rows use 'medium'
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL, priority TEXT CHECK (priority IN ('low', 'medium', 'high')))`,
        `INSERT INTO orders (order_number, priority) VALUES ('ORD-001', 'low'), ('ORD-002', 'medium')`,
      ])

      // WHEN: attempting to remove option 'medium' from enum
      // THEN: Migration fails with data validation error (existing data uses removed option)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'orders',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'order_number', type: 'single-line-text', required: true },
                {
                  id: 3,
                  name: 'priority',
                  type: 'single-select',
                  options: ['low', 'high'], // 'medium' removed but data exists
                },
              ],
            },
          ],
        })
      }).rejects.toThrow(/violates check constraint|data validation|existing data/i)

      // Original data unchanged (migration rolled back)
      const existingOrder = await executeQuery(
        `SELECT priority FROM orders WHERE order_number = 'ORD-002'`
      )
      expect(existingOrder.priority).toBe('medium')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-OPTIONS-004: should add check constraint with jsonb validation expression',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'preferences' with tags field (JSONB array)
      await executeQuery([
        `CREATE TABLE preferences (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, tags JSONB DEFAULT '[]')`,
        `INSERT INTO preferences (user_id, tags) VALUES (1, '["work", "personal"]')`,
      ])

      // WHEN: validation rule added requiring each tag to match pattern ^[a-z]+$
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'preferences',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'user_id', type: 'integer', required: true },
              {
                id: 3,
                name: 'tags',
                type: 'multi-select',
                options: ['work', 'personal', 'urgent', 'later'],
              },
            ],
          },
        ],
      })

      // THEN: ADD CHECK constraint with JSONB validation expression

      // Valid tags accepted
      const validTags = await executeQuery(
        `UPDATE preferences SET tags = '["work", "urgent"]' WHERE user_id = 1 RETURNING tags`
      )
      expect(validTags.tags).toEqual(['work', 'urgent'])

      // Invalid tag format rejected (uppercase, special chars)
      await expect(async () => {
        await executeQuery(
          `INSERT INTO preferences (user_id, tags) VALUES (2, '["Work", "URGENT"]')`
        )
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-OPTIONS-005: user can complete full modify-field-options workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative modify-field-options scenarios
      await executeQuery([
        `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, type TEXT CHECK (type IN ('type_a', 'type_b')))`,
        `INSERT INTO items (name, type) VALUES ('Item 1', 'type_a')`,
      ])

      // WHEN: Add new option 'type_c' to enum
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
                name: 'type',
                type: 'single-select',
                options: ['type_a', 'type_b', 'type_c'],
              },
            ],
          },
        ],
      })

      // THEN: New option is valid, existing data preserved

      // New option works
      const newOption = await executeQuery(
        `INSERT INTO items (name, type) VALUES ('Item 2', 'type_c') RETURNING type`
      )
      expect(newOption.type).toBe('type_c')

      // Existing data preserved
      const existingItem = await executeQuery(`SELECT type FROM items WHERE name = 'Item 1'`)
      expect(existingItem.type).toBe('type_a')
    }
  )
})

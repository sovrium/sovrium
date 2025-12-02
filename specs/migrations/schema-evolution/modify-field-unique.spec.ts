/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Modify Field Unique Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-unique/modify-field-unique.json
 * Domain: migrations
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Unique Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-FIELD-UNIQUE-001: should alter table add constraint unique_users_username unique (username)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with field 'username' (TEXT) containing unique values
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, username VARCHAR(100))`,
        `INSERT INTO users (name, username) VALUES ('Alice', 'alice123'), ('Bob', 'bob456')`,
      ])

      // WHEN: unique constraint added to schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'username', type: 'single-line-text', unique: true },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ADD CONSTRAINT unique_users_username UNIQUE (username)

      // Unique constraint exists
      const constraintCheck = await executeQuery(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
      )
      expect(constraintCheck.constraint_name).toMatch(/unique.*username/i)

      // Duplicate username rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO users (name, username) VALUES ('Charlie', 'alice123')`)
      }).rejects.toThrow(/duplicate key|unique constraint/i)

      // Unique username accepted
      const newUser = await executeQuery(
        `INSERT INTO users (name, username) VALUES ('Charlie', 'charlie789') RETURNING username`
      )
      expect(newUser.username).toBe('charlie789')
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-FIELD-UNIQUE-002: should migration fails with unique violation error, transaction rolled back',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with field 'sku' containing duplicate values
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sku VARCHAR(50))`,
        `INSERT INTO products (name, sku) VALUES ('Widget A', 'SKU-001'), ('Widget B', 'SKU-001')`, // Duplicate SKUs
      ])

      // WHEN: unique constraint added to 'sku'
      // THEN: Migration fails with unique violation error, transaction rolled back
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
                { id: 3, name: 'sku', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
      }).rejects.toThrow(/duplicate key|unique constraint|already exists/i)

      // Original data unchanged (migration rolled back)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM products WHERE sku = 'SKU-001'`
      )
      expect(duplicates.count).toBe(2)

      // No unique constraint added
      const constraintCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'`
      )
      expect(constraintCheck.count).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-FIELD-UNIQUE-003: should alter table drop constraint unique_orders_order_number',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with field 'order_number' having UNIQUE constraint
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL UNIQUE)`,
        `INSERT INTO orders (order_number) VALUES ('ORD-001'), ('ORD-002')`,
      ])

      // WHEN: unique constraint removed from schema
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
              }, // No unique
            ],
          },
        ],
      })

      // THEN: ALTER TABLE DROP CONSTRAINT unique_orders_order_number

      // Unique constraint removed
      const constraintCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='UNIQUE' AND constraint_name LIKE '%order_number%'`
      )
      expect(constraintCheck.count).toBe(0)

      // Duplicate values now allowed
      await executeQuery(`INSERT INTO orders (order_number) VALUES ('ORD-001')`)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(duplicates.count).toBe(2)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-FIELD-UNIQUE-004: user can complete full modify-field-unique workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: create items table without unique constraint', async () => {
        await executeQuery([
          `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50))`,
          `INSERT INTO items (name, code) VALUES ('Item A', 'CODE-001'), ('Item B', 'CODE-002')`,
        ])
      })

      await test.step('Add unique constraint to code field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'code', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
      })

      await test.step('Verify unique constraint enforced', async () => {
        // Unique value accepted
        const newItem = await executeQuery(
          `INSERT INTO items (name, code) VALUES ('Item C', 'CODE-003') RETURNING code`
        )
        expect(newItem.code).toBe('CODE-003')

        // Duplicate value rejected
        await expect(async () => {
          await executeQuery(`INSERT INTO items (name, code) VALUES ('Item D', 'CODE-001')`)
        }).rejects.toThrow(/duplicate key|unique constraint/i)
      })
    }
  )
})

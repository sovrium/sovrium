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

  test(
    'MIGRATION-MODIFY-FIELD-UNIQUE-001: should alter table add constraint unique_users_username unique (username)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with field 'username' (TEXT) containing unique values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'username', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
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
      expect(constraintCheck.constraint_name).toBe('users_username_key')

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

  test(
    'MIGRATION-MODIFY-FIELD-UNIQUE-002: should migration fails with unique violation error, transaction rolled back',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with field 'sku' containing duplicate values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 5, name: 'name', type: 'single-line-text', required: true },
              { id: 6, name: 'sku', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery([
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
                { id: 5, name: 'name', type: 'single-line-text', required: true },
                { id: 6, name: 'sku', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
      }).rejects.toThrow(/duplicate key|unique constraint|already exists/i)

      // Original data unchanged (migration rolled back)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM products WHERE sku = 'SKU-001'`
      )
      expect(duplicates.count).toBe('2')

      // No unique constraint added
      const constraintCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'`
      )
      expect(constraintCheck.count).toBe('0')
    }
  )

  test(
    'MIGRATION-MODIFY-FIELD-UNIQUE-003: should alter table drop constraint unique_orders_order_number',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with field 'order_number' having UNIQUE constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              {
                id: 8,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })
      await executeQuery([`INSERT INTO orders (order_number) VALUES ('ORD-001'), ('ORD-002')`])

      // WHEN: unique constraint removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'orders',
            fields: [
              {
                id: 8,
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
      expect(constraintCheck.count).toBe('0')

      // Duplicate values now allowed
      await executeQuery(`INSERT INTO orders (order_number) VALUES ('ORD-001')`)
      const duplicates = await executeQuery(
        `SELECT COUNT(*) as count FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(duplicates.count).toBe('2')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 3 @spec tests - covers: add unique constraint, failure with duplicates, drop unique constraint
  // ============================================================================

  test(
    'MIGRATION-MODIFY-FIELD-UNIQUE-REGRESSION: user can complete full modify-field-unique workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-MODIFY-FIELD-UNIQUE-001: adds unique constraint via ALTER TABLE', async () => {
        // Setup: table 'users' with field 'username' (TEXT) containing unique values
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'username', type: 'single-line-text' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO users (name, username) VALUES ('Alice', 'alice123'), ('Bob', 'bob456')`,
        ])

        // Add unique constraint to schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'username', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })

        // Unique constraint exists
        const constraintCheck = await executeQuery(
          `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
        )
        expect(constraintCheck.constraint_name).toBe('users_username_key')

        // Duplicate username rejected
        await expect(async () => {
          await executeQuery(`INSERT INTO users (name, username) VALUES ('Charlie', 'alice123')`)
        }).rejects.toThrow(/duplicate key|unique constraint/i)

        // Unique username accepted
        const newUser = await executeQuery(
          `INSERT INTO users (name, username) VALUES ('Charlie', 'charlie789') RETURNING username`
        )
        expect(newUser.username).toBe('charlie789')
      })

      await test.step('MIGRATION-MODIFY-FIELD-UNIQUE-002: migration fails with unique violation, rollback', async () => {
        // Setup: table 'products' with field 'sku' containing duplicate values
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 5, name: 'name', type: 'single-line-text', required: true },
                { id: 6, name: 'sku', type: 'single-line-text' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO products (name, sku) VALUES ('Widget A', 'SKU-001'), ('Widget B', 'SKU-001')`, // Duplicate SKUs
        ])

        // Migration fails with unique violation error
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 2,
                name: 'products',
                fields: [
                  { id: 5, name: 'name', type: 'single-line-text', required: true },
                  { id: 6, name: 'sku', type: 'single-line-text', unique: true },
                ],
              },
            ],
          })
        }).rejects.toThrow(/duplicate key|unique constraint|already exists/i)

        // Original data unchanged (migration rolled back)
        const duplicates = await executeQuery(
          `SELECT COUNT(*) as count FROM products WHERE sku = 'SKU-001'`
        )
        expect(duplicates.count).toBe('2')

        // No unique constraint added
        const constraintCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'`
        )
        expect(constraintCheck.count).toBe('0')
      })

      await test.step('MIGRATION-MODIFY-FIELD-UNIQUE-003: drops unique constraint via ALTER TABLE', async () => {
        // Setup: table 'orders' with field 'order_number' having UNIQUE constraint
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'orders',
              fields: [
                {
                  id: 8,
                  name: 'order_number',
                  type: 'single-line-text',
                  required: true,
                  unique: true,
                },
              ],
            },
          ],
        })
        await executeQuery([`INSERT INTO orders (order_number) VALUES ('ORD-001'), ('ORD-002')`])

        // Remove unique constraint from schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'orders',
              fields: [
                {
                  id: 8,
                  name: 'order_number',
                  type: 'single-line-text',
                  required: true,
                }, // No unique
              ],
            },
          ],
        })

        // Unique constraint removed
        const constraintCheck = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='UNIQUE' AND constraint_name LIKE '%order_number%'`
        )
        expect(constraintCheck.count).toBe('0')

        // Duplicate values now allowed
        await executeQuery(`INSERT INTO orders (order_number) VALUES ('ORD-001')`)
        const duplicates = await executeQuery(
          `SELECT COUNT(*) as count FROM orders WHERE order_number = 'ORD-001'`
        )
        expect(duplicates.count).toBe('2')
      })
    }
  )
})

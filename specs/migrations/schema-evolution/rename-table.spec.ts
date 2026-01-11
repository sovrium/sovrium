/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rename Table Migration
 *
 * Source: specs/migrations/schema-evolution/rename-table/rename-table.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rename Table Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-RENAME-TABLE-001: should alter table rename preserves data, indexes, and constraints',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: existing table 'users' with data and indexes
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', unique: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
        `INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')`,
      ])

      // WHEN: table name property changes to 'customers'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1, // SAME table ID - triggers RENAME
            name: 'customers', // Renamed from 'users'
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email', unique: true },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE RENAME preserves data, indexes, and constraints

      // Data preserved in renamed table
      const customers = await executeQuery(`SELECT COUNT(*) as count FROM customers`)
      expect(customers.count).toBe('2')

      // Data accessible by new name
      const alice = await executeQuery(
        `SELECT name, email FROM customers WHERE name = 'Alice' LIMIT 1`
      )
      expect(alice.email).toBe('alice@example.com')

      // Old table name no longer exists
      const oldTableExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'users'`
      )
      expect(oldTableExists.count).toBe('0')

      // Unique constraint still enforced
      await expect(async () => {
        await executeQuery(
          `INSERT INTO customers (name, email) VALUES ('Charlie', 'alice@example.com')`
        )
      }).rejects.toThrow(/duplicate key|unique constraint/i)
    }
  )

  test(
    'MIGRATION-RENAME-TABLE-002: should automatically updates foreign key references',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'posts' referenced by foreign key from 'comments'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [{ id: 2, name: 'title', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'comments',
            fields: [
              {
                id: 2,
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                relationType: 'many-to-one',
              },
              { id: 3, name: 'content', type: 'long-text', required: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO posts (title) VALUES ('First Post')`,
        `INSERT INTO comments (post_id, content) VALUES ((SELECT id FROM posts LIMIT 1), 'Great post!')`,
      ])

      // WHEN: table name changes to 'articles'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1, // SAME table ID - triggers RENAME
            name: 'articles', // Renamed from 'posts'
            fields: [{ id: 2, name: 'title', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'comments',
            fields: [
              {
                id: 2,
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'articles',
                relationType: 'many-to-one',
              }, // FK reference updates automatically
              { id: 3, name: 'content', type: 'long-text', required: true },
            ],
          },
        ],
      })

      // THEN: PostgreSQL automatically updates foreign key references

      // Foreign key constraint still enforced
      await expect(async () => {
        await executeQuery(`INSERT INTO comments (post_id, content) VALUES (999, 'Invalid FK')`)
      }).rejects.toThrow(/foreign key|violates foreign key/i)

      // Data accessible via join
      const comment = await executeQuery(
        `SELECT a.title, c.content FROM articles a JOIN comments c ON a.id = c.post_id LIMIT 1`
      )
      expect(comment.title).toBe('First Post')
      expect(comment.content).toBe('Great post!')
    }
  )

  test(
    'MIGRATION-RENAME-TABLE-003: should all indexes and constraints remain functional',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with multiple indexes and constraints
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'sku', type: 'single-line-text', unique: true },
              { id: 4, name: 'price', type: 'decimal', min: 0 },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO products (name, sku, price) VALUES ('Widget', 'SKU-001', 19.99)`,
        `INSERT INTO products (name, sku, price) VALUES ('Gadget', 'SKU-002', 29.99)`,
      ])

      // WHEN: table renamed to 'items'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1, // SAME table ID - triggers RENAME
            name: 'items', // Renamed from 'products'
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'sku', type: 'single-line-text', unique: true },
              { id: 4, name: 'price', type: 'decimal', min: 0 },
            ],
          },
        ],
      })

      // THEN: All indexes and constraints remain functional

      // Unique constraint on sku preserved
      await expect(async () => {
        await executeQuery(
          `INSERT INTO items (name, sku, price) VALUES ('New Item', 'SKU-001', 15.99)`
        )
      }).rejects.toThrow(/duplicate key|unique constraint/i)

      // Check constraint on price preserved
      await expect(async () => {
        await executeQuery(
          `INSERT INTO items (name, sku, price) VALUES ('Bad Item', 'SKU-003', -5.00)`
        )
      }).rejects.toThrow(/check constraint/i)

      // Data preserved
      const items = await executeQuery(`SELECT COUNT(*) as count FROM items`)
      expect(items.count).toBe('2')
    }
  )

  test(
    'MIGRATION-RENAME-TABLE-004: should migration fails with error and transaction rolls back',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table rename where new name conflicts with existing table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'name', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'customers',
            fields: [{ id: 2, name: 'company', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO users (name) VALUES ('Alice')`,
        `INSERT INTO customers (company) VALUES ('Acme Inc')`,
      ])

      // WHEN: attempting to rename 'users' to 'customers' but 'customers' exists
      // THEN: Migration fails with error and transaction rolls back
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1, // SAME table ID - attempts RENAME
              name: 'customers', // Conflict: 'customers' already exists
              fields: [{ id: 2, name: 'name', type: 'single-line-text', required: true }],
            },
            {
              id: 2,
              name: 'customers', // Same name - conflict
              fields: [{ id: 2, name: 'company', type: 'single-line-text', required: true }],
            },
          ],
        })
      }).rejects.toThrow(/Table names must be unique|already exists|duplicate|relation.*exists/i)

      // Original tables unchanged (migration rolled back)
      const usersExist = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'users'`
      )
      expect(usersExist.count).toBe('1')

      const customersExist = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'customers'`
      )
      expect(customersExist.count).toBe('1')

      // Original data preserved
      const alice = await executeQuery(`SELECT name FROM users WHERE name = 'Alice' LIMIT 1`)
      expect(alice.name).toBe('Alice')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 4 @spec tests - covers: data preservation, FK updates, constraints, rollback
  // ============================================================================

  test(
    'MIGRATION-RENAME-TABLE-REGRESSION: user can complete full rename-table workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Consolidated fields for main table (table id:1)
      // Contains all fields needed across all steps
      const mainTableFields = [
        { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        { id: 3, name: 'email', type: 'email' as const, unique: true },
        { id: 4, name: 'sku', type: 'single-line-text' as const, unique: true },
        { id: 5, name: 'price', type: 'decimal' as const, min: 0 },
        { id: 6, name: 'title', type: 'single-line-text' as const },
      ]

      // Related table for FK testing (table id:2)
      const relatedTableFields = [
        {
          id: 2,
          name: 'main_id',
          type: 'relationship' as const,
          relatedTable: 'main_table',
          relationType: 'many-to-one' as const,
        },
        { id: 3, name: 'content', type: 'long-text' as const, required: true },
      ]

      // Conflict target table (table id:3)
      const conflictTableFields = [
        { id: 2, name: 'data', type: 'single-line-text' as const, required: true },
      ]

      await test.step('Setup: Create base schema with all needed tables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'main_table', fields: mainTableFields },
            { id: 2, name: 'related_table', fields: relatedTableFields },
            { id: 3, name: 'conflict_target', fields: conflictTableFields },
          ],
        })

        // Insert test data
        await executeQuery([
          `INSERT INTO main_table (name, email, sku, price, title) VALUES ('Alice', 'alice@example.com', 'SKU-001', 19.99, 'First Post')`,
          `INSERT INTO main_table (name, email, sku, price, title) VALUES ('Bob', 'bob@example.com', 'SKU-002', 29.99, 'Second Post')`,
          `INSERT INTO related_table (main_id, content) VALUES ((SELECT id FROM main_table WHERE name = 'Alice'), 'Great content!')`,
          `INSERT INTO conflict_target (data) VALUES ('Existing Data')`,
        ])
      })

      await test.step('MIGRATION-RENAME-TABLE-001: alters table rename and preserves data, indexes, and constraints', async () => {
        // WHEN: table name property changes from 'main_table' to 'renamed_table'
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'renamed_table', fields: mainTableFields },
            {
              id: 2,
              name: 'related_table',
              fields: [
                {
                  id: 2,
                  name: 'main_id',
                  type: 'relationship' as const,
                  relatedTable: 'renamed_table',
                  relationType: 'many-to-one' as const,
                },
                { id: 3, name: 'content', type: 'long-text' as const, required: true },
              ],
            },
            { id: 3, name: 'conflict_target', fields: conflictTableFields },
          ],
        })

        // THEN: ALTER TABLE RENAME preserves data
        const renamed = await executeQuery(`SELECT COUNT(*) as count FROM renamed_table`)
        expect(renamed.count).toBe('2')

        const alice = await executeQuery(
          `SELECT name, email FROM renamed_table WHERE name = 'Alice' LIMIT 1`
        )
        expect(alice.email).toBe('alice@example.com')

        const oldTableExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'main_table'`
        )
        expect(oldTableExists.count).toBe('0')

        // THEN: Unique constraint preserved (email)
        await expect(async () => {
          await executeQuery(
            `INSERT INTO renamed_table (name, email, sku, price, title) VALUES ('Charlie', 'alice@example.com', 'SKU-003', 9.99, 'Test')`
          )
        }).rejects.toThrow(/duplicate key|unique constraint/i)
      })

      await test.step('MIGRATION-RENAME-TABLE-002: automatically updates foreign key references', async () => {
        // FK references should have been updated in previous step
        // THEN: FK constraint still enforced
        await expect(async () => {
          await executeQuery(
            `INSERT INTO related_table (main_id, content) VALUES (999, 'Invalid FK')`
          )
        }).rejects.toThrow(/foreign key|violates foreign key/i)

        // THEN: Join still works with renamed table
        const comment = await executeQuery(
          `SELECT r.title, rt.content FROM renamed_table r JOIN related_table rt ON r.id = rt.main_id LIMIT 1`
        )
        expect(comment.title).toBe('First Post')
        expect(comment.content).toBe('Great content!')
      })

      await test.step('MIGRATION-RENAME-TABLE-003: maintains all indexes and constraints as functional', async () => {
        // THEN: Unique constraint on sku still works
        await expect(async () => {
          await executeQuery(
            `INSERT INTO renamed_table (name, email, sku, price, title) VALUES ('New Item', 'new@test.com', 'SKU-001', 15.99, 'Test')`
          )
        }).rejects.toThrow(/duplicate key|unique constraint/i)

        // THEN: Check constraint on price (min: 0) still works
        await expect(async () => {
          await executeQuery(
            `INSERT INTO renamed_table (name, email, sku, price, title) VALUES ('Bad Item', 'bad@test.com', 'SKU-999', -5.00, 'Test')`
          )
        }).rejects.toThrow(/check constraint/i)

        const items = await executeQuery(`SELECT COUNT(*) as count FROM renamed_table`)
        expect(items.count).toBe('2')
      })

      await test.step('MIGRATION-RENAME-TABLE-004: fails migration with error and rolls back transaction', async () => {
        // WHEN: attempting to rename 'renamed_table' to 'conflict_target' but 'conflict_target' exists
        // THEN: Migration fails with error (duplicate table names in schema)
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              { id: 1, name: 'conflict_target', fields: mainTableFields },
              {
                id: 2,
                name: 'related_table',
                fields: [
                  {
                    id: 2,
                    name: 'main_id',
                    type: 'relationship' as const,
                    relatedTable: 'conflict_target',
                    relationType: 'many-to-one' as const,
                  },
                  { id: 3, name: 'content', type: 'long-text' as const, required: true },
                ],
              },
              { id: 3, name: 'conflict_target', fields: conflictTableFields },
            ],
          })
        }).rejects.toThrow(/Table names must be unique|already exists|duplicate|relation.*exists/i)

        // THEN: Original tables still exist after failed rename
        const renamedExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'renamed_table'`
        )
        expect(renamedExists.count).toBe('1')

        const conflictExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'conflict_target'`
        )
        expect(conflictExists.count).toBe('1')

        // THEN: Data preserved after rollback
        const alice = await executeQuery(
          `SELECT name FROM renamed_table WHERE name = 'Alice' LIMIT 1`
        )
        expect(alice.name).toBe('Alice')
      })
    }
  )
})

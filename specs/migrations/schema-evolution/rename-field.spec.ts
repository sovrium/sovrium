/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rename Field Migration
 *
 * Source: src/domain/models/app/table/index.ts (Effect Schema)
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rename Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-ALTER-RENAME-001: should generate RENAME COLUMN instead of DROP+ADD when runtime migration detects rename via field ID',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with field id=2 name='email', field name changed to 'email_address' (same id)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 1, name: 'email', type: 'email', unique: true }],
          },
        ],
      })
      await executeQuery([`INSERT INTO users (email) VALUES ('user@example.com')`])

      // WHEN: runtime migration detects rename via field ID
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'email_address',
                type: 'email',
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL generates RENAME COLUMN instead of DROP+ADD

      // Column renamed successfully
      const newColumn = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email_address'`
      )
      // THEN: assertion
      expect(newColumn.column_name).toBe('email_address')

      // Old column name no longer exists
      const oldColumn = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='email'`
      )
      // THEN: assertion
      expect(oldColumn.count).toBe('0')

      // Data preserved after rename
      const data = await executeQuery(`SELECT email_address FROM users LIMIT 1`)
      // THEN: assertion
      expect(data.email_address).toBe('user@example.com')

      // Constraints preserved (UNIQUE still enforced)
      const constraints = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
      )
      // THEN: assertion
      expect(Number(constraints.count)).toBeGreaterThanOrEqual(1)
    }
  )

  test(
    'MIGRATION-ALTER-RENAME-002: should rename column and automatically update index reference when RENAME COLUMN is executed on indexed field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with indexed field 'sku' (id=2) renamed to 'product_code' (same id)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'sku', type: 'single-line-text', unique: true },
            ],
          },
        ],
      })
      await executeQuery([
        `CREATE INDEX idx_products_sku ON products(sku)`,
        `INSERT INTO products (id, sku) VALUES (1, 'PROD-001')`,
      ])

      // WHEN: RENAME COLUMN is executed on indexed field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'product_code',
                type: 'single-line-text',
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column and automatically updates index reference

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='product_code'`
      )
      // THEN: assertion
      expect(column.column_name).toBe('product_code')

      // Index still exists and references renamed column
      const index = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE tablename='products' AND indexname='idx_products_sku'`
      )
      // THEN: assertion
      expect(index.indexdef).toContain('product_code')

      // Data preserved
      const data = await executeQuery(`SELECT product_code FROM products WHERE id = 1`)
      // THEN: assertion
      expect(data.product_code).toBe('PROD-001')
    }
  )

  test(
    'MIGRATION-ALTER-RENAME-003: should rename column and preserve foreign key constraint when RENAME COLUMN on foreign key field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with foreign key field 'customer_id' (id=2) renamed to 'client_id' (same id)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'customers',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 4,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'customer_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO customers (name) VALUES ('Customer A')`,
        `INSERT INTO orders (customer_id) VALUES (1)`,
      ])

      // WHEN: RENAME COLUMN on foreign key field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'customers',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 4,
            name: 'orders',
            fields: [
              {
                id: 1,
                name: 'client_id',
                type: 'relationship',
                relatedTable: 'customers',
                relationType: 'many-to-one',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column and preserves foreign key constraint

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='client_id'`
      )
      // THEN: assertion
      expect(column.column_name).toBe('client_id')

      // Foreign key constraint preserved
      const fk = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='FOREIGN KEY'`
      )
      // THEN: assertion
      expect(fk.count).toBe('1')

      // Foreign key still enforced after rename
      // THEN: assertion
      await expect(async () => {
        await executeQuery(`INSERT INTO orders (client_id) VALUES (999)`)
      }).rejects.toThrow(/violates foreign key constraint/i)

      // Data preserved
      const data = await executeQuery(`SELECT client_id FROM orders LIMIT 1`)
      // THEN: assertion
      expect(data.client_id).toBe(1)
    }
  )

  test(
    'MIGRATION-ALTER-RENAME-004: should rename column but CHECK constraint references old name when RENAME COLUMN on field with CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with field 'status' (id=2, CHECK constraint) renamed to 'state' (same id)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'status',
                type: 'single-select',
                options: ['open', 'in_progress', 'done'],
              },
            ],
          },
        ],
      })
      await executeQuery([`INSERT INTO tasks (status) VALUES ('open')`])

      // WHEN: RENAME COLUMN on field with CHECK constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'state',
                type: 'single-select',
                options: ['open', 'in_progress', 'done'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column but CHECK constraint references old name (constraint needs update)

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='state'`
      )
      // THEN: assertion
      expect(column.column_name).toBe('state')

      // CHECK constraint still enforced with new column name
      const validInsert = await executeQuery(
        `INSERT INTO tasks (state) VALUES ('done') RETURNING state`
      )
      // THEN: assertion
      expect(validInsert.state).toBe('done')

      // Invalid value still rejected
      // THEN: assertion
      await expect(async () => {
        await executeQuery(`INSERT INTO tasks (state) VALUES ('invalid')`)
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 4 @spec tests - covers: RENAME COLUMN detection, index update, FK preservation, CHECK constraint
  // ============================================================================

  test(
    'MIGRATION-ALTER-RENAME-REGRESSION: user can complete full rename-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-ALTER-RENAME-001: generates RENAME COLUMN via field ID detection', async () => {
        // Setup: table with email field
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 1, name: 'email', type: 'email', unique: true }],
            },
          ],
        })
        await executeQuery([`INSERT INTO users (email) VALUES ('user@example.com')`])

        // Rename field from 'email' to 'email_address' (same field id=1)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [{ id: 1, name: 'email_address', type: 'email', unique: true }],
            },
          ],
        })

        // Verify column renamed
        const newColumn = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email_address'`
        )
        expect(newColumn.column_name).toBe('email_address')

        // Verify old column removed
        const oldColumn = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='email'`
        )
        expect(oldColumn.count).toBe('0')

        // Verify data preserved
        const data = await executeQuery(`SELECT email_address FROM users LIMIT 1`)
        expect(data.email_address).toBe('user@example.com')

        // Verify UNIQUE constraint preserved
        const constraints = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
        )
        expect(Number(constraints.count)).toBeGreaterThanOrEqual(1)
      })

      await test.step('MIGRATION-ALTER-RENAME-002: renames column and updates index reference', async () => {
        // Setup: products table with indexed sku field
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'sku', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })
        await executeQuery([
          `CREATE INDEX idx_products_sku ON products(sku)`,
          `INSERT INTO products (id, sku) VALUES (1, 'PROD-001')`,
        ])

        // Rename field from 'sku' to 'product_code'
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'product_code', type: 'single-line-text', unique: true },
              ],
            },
          ],
        })

        // Verify column renamed
        const column = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='product_code'`
        )
        expect(column.column_name).toBe('product_code')

        // Verify index references renamed column
        const index = await executeQuery(
          `SELECT indexdef FROM pg_indexes WHERE tablename='products' AND indexname='idx_products_sku'`
        )
        expect(index.indexdef).toContain('product_code')

        // Verify data preserved
        const data = await executeQuery(`SELECT product_code FROM products WHERE id = 1`)
        expect(data.product_code).toBe('PROD-001')
      })

      await test.step('MIGRATION-ALTER-RENAME-003: renames column and preserves FK constraint', async () => {
        // Setup: customers and orders tables with FK relationship
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'customers',
              fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 4,
              name: 'orders',
              fields: [
                {
                  id: 1,
                  name: 'customer_id',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO customers (name) VALUES ('Customer A')`,
          `INSERT INTO orders (customer_id) VALUES (1)`,
        ])

        // Rename FK field from 'customer_id' to 'client_id'
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'customers',
              fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            },
            {
              id: 4,
              name: 'orders',
              fields: [
                {
                  id: 1,
                  name: 'client_id',
                  type: 'relationship',
                  relatedTable: 'customers',
                  relationType: 'many-to-one',
                },
              ],
            },
          ],
        })

        // Verify column renamed
        const column = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='client_id'`
        )
        expect(column.column_name).toBe('client_id')

        // Verify FK constraint preserved
        const fk = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='FOREIGN KEY'`
        )
        expect(fk.count).toBe('1')

        // Verify FK still enforced
        await expect(async () => {
          await executeQuery(`INSERT INTO orders (client_id) VALUES (999)`)
        }).rejects.toThrow(/violates foreign key constraint/i)

        // Verify data preserved
        const data = await executeQuery(`SELECT client_id FROM orders LIMIT 1`)
        expect(data.client_id).toBe(1)
      })

      await test.step('MIGRATION-ALTER-RENAME-004: renames column with CHECK constraint', async () => {
        // Setup: tasks table with single-select (CHECK constraint)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'tasks',
              fields: [
                {
                  id: 1,
                  name: 'status',
                  type: 'single-select',
                  options: ['open', 'in_progress', 'done'],
                },
              ],
            },
          ],
        })
        await executeQuery([`INSERT INTO tasks (status) VALUES ('open')`])

        // Rename field from 'status' to 'state'
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'tasks',
              fields: [
                {
                  id: 1,
                  name: 'state',
                  type: 'single-select',
                  options: ['open', 'in_progress', 'done'],
                },
              ],
            },
          ],
        })

        // Verify column renamed
        const column = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='state'`
        )
        expect(column.column_name).toBe('state')

        // Verify CHECK constraint enforced with valid value
        const validInsert = await executeQuery(
          `INSERT INTO tasks (state) VALUES ('done') RETURNING state`
        )
        expect(validInsert.state).toBe('done')

        // Verify invalid value rejected
        await expect(async () => {
          await executeQuery(`INSERT INTO tasks (state) VALUES ('invalid')`)
        }).rejects.toThrow(/violates check constraint/i)
      })
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'MIG-TRANSACTION-001: should rollback all changes when migration step fails',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: schema with 3 migration steps (add field, add index, add constraint)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [{ id: 'fld_email', name: 'email', type: 'email' }],
        },
      ],
    })

    const migrationSteps = [
      {
        type: 'add_field',
        field: { id: 'fld_username', name: 'username', type: 'single-line-text' },
      },
      { type: 'add_index', field: 'fld_username', indexType: 'btree' },
      { type: 'add_constraint', field: 'fld_username', constraint: 'INVALID_CONSTRAINT' },
    ]

    // WHEN: migration with failing step 3
    // THEN: entire migration rolled back
    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { id: 'fld_email', name: 'email', type: 'email' },
              {
                id: 'fld_username',
                name: 'username',
                type: 'single-line-text',
                unique: true,
                indexed: true,
                _migration: { steps: migrationSteps },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/migration failed/i)

    // Assertion 1: Username field NOT added (rollback)
    const columnExists = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='users' AND column_name='username'
    `)
    expect(columnExists).toBeUndefined()

    // Assertion 2: Index NOT created (rollback)
    const indexExists = await executeQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename='users' AND indexname LIKE '%username%'
    `)
    expect(indexExists).toBeUndefined()

    // Assertion 3: Original schema intact
    const columns = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='users'
    `)
    expect(columns.map((c) => c.column_name)).toEqual(['id', 'email'])
  }
)

test.fixme(
  'MIG-TRANSACTION-002: should restore to previous schema version after rollback',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: initial schema v1
    await startServerWithSchema({
      name: 'test-app',
      version: '1.0.0',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_price', name: 'price', type: 'decimal' },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO products (name, price) VALUES ('Product A', 10.00)`)

    // WHEN: failed migration to v2
    await expect(
      startServerWithSchema({
        name: 'test-app',
        version: '2.0.0',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { id: 'fld_name', name: 'name', type: 'single-line-text' },
              { id: 'fld_price', name: 'price', type: 'decimal' },
              {
                id: 'fld_invalid',
                name: 'invalid_field',
                type: 'non_existent_type',
              },
            ],
          },
        ],
      })
    ).rejects.toThrow()

    // THEN: schema restored to v1
    const schemaVersion = await executeQuery(`
      SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1
    `)
    expect(schemaVersion.version).toBe('1.0.0')

    const columns = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='products'
    `)
    expect(columns.map((c) => c.column_name).sort()).toEqual(['id', 'name', 'price'].sort())

    const product = await executeQuery(`SELECT name, price FROM products`)
    expect(product).toEqual({ name: 'Product A', price: '10.00' })
  }
)

test.fixme(
  'MIG-TRANSACTION-003: should rollback to savepoint when sub-step fails',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery }) => {
    // GIVEN: migration with nested transaction (savepoints)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_orders',
          name: 'orders',
          fields: [{ id: 'fld_total', name: 'total', type: 'decimal' }],
        },
      ],
    })

    // WHEN: migration with 3 steps, step 2 fails, step 3 should not execute
    const migrationWithSavepoints = async () => {
      await executeQuery('BEGIN')

      // Step 1: Add field (succeeds)
      await executeQuery(`ALTER TABLE orders ADD COLUMN status VARCHAR(50)`)
      await executeQuery('SAVEPOINT step1')

      // Step 2: Add invalid constraint (fails)
      try {
        await executeQuery(`ALTER TABLE orders ADD CONSTRAINT invalid_check CHECK (total > 'text')`)
      } catch (error) {
        await executeQuery('ROLLBACK TO SAVEPOINT step1')
        throw error
      }

      // Step 3: Add index (should not execute)
      await executeQuery('CREATE INDEX idx_orders_status ON orders(status)')

      await executeQuery('COMMIT')
    }

    // THEN: rollback to savepoint after step 1
    await expect(migrationWithSavepoints()).rejects.toThrow()

    // Assertion 1: Step 1 field added (before savepoint)
    const statusColumn = await executeQuery(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='orders' AND column_name='status'
    `)
    expect(statusColumn.column_name).toBe('status')

    // Assertion 2: Step 2 constraint NOT added
    const constraintExists = await executeQuery(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name='orders' AND constraint_name='invalid_check'
    `)
    expect(constraintExists).toBeUndefined()

    // Assertion 3: Step 3 index NOT created (migration stopped)
    const indexExists = await executeQuery(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename='orders' AND indexname='idx_orders_status'
    `)
    expect(indexExists).toBeUndefined()
  }
)

test.fixme(
  'MIG-TRANSACTION-REGRESSION: migration transactions work atomically',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery }) => {
    // Basic transaction rollback smoke test
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_test',
          name: 'test',
          fields: [{ id: 'fld_value', name: 'value', type: 'single-line-text' }],
        },
      ],
    })

    // Attempt to add invalid field - should rollback
    await expect(
      startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_test',
            name: 'test',
            fields: [
              { id: 'fld_value', name: 'value', type: 'single-line-text' },
              { id: 'fld_invalid', name: 'invalid', type: 'invalid_type' },
            ],
          },
        ],
      })
    ).rejects.toThrow()

    // Original schema should be intact
    const columns = await executeQuery(`
      SELECT column_name FROM information_schema.columns WHERE table_name='test'
    `)
    expect(columns.map((c) => c.column_name)).toEqual(['id', 'value'])
  }
)

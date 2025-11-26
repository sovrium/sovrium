/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@playwright/test'

test.fixme(
  'MIG-CONSTRAINT-001: should add UNIQUE constraint to existing field with unique values',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, applyMigration }) => {
    // GIVEN: table 'users' with email field (no constraint)
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_users',
          name: 'users',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_email', name: 'email', type: 'email' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO users (name, email) VALUES
      ('Alice', 'alice@example.com'),
      ('Bob', 'bob@example.com')
    `)

    // WHEN: applying migration to add UNIQUE constraint to email
    const migration = {
      type: 'add_constraint',
      tableId: 'tbl_users',
      fieldId: 'fld_email',
      constraint: {
        type: 'unique',
      },
    }

    await applyMigration(migration)

    // THEN: constraint is added successfully
    const insertDuplicate = executeQuery(
      `INSERT INTO users (name, email) VALUES ('Charlie', 'alice@example.com')`
    )

    await expect(insertDuplicate).rejects.toThrow(/unique constraint violation/i)
  }
)

test.fixme(
  'MIG-CONSTRAINT-002: should fail to add UNIQUE constraint when duplicates exist',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, applyMigration }) => {
    // GIVEN: table 'products' with SKU field containing duplicates
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_products',
          name: 'products',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_sku', name: 'sku', type: 'single-line-text' },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO products (name, sku) VALUES
      ('Product A', 'SKU-001'),
      ('Product B', 'SKU-001')
    `)

    // WHEN: attempting to add UNIQUE constraint to SKU
    const migration = {
      type: 'add_constraint',
      tableId: 'tbl_products',
      fieldId: 'fld_sku',
      constraint: {
        type: 'unique',
      },
    }

    // THEN: migration fails with validation error
    await expect(applyMigration(migration)).rejects.toThrow(/duplicate values found/i)

    // Verify data unchanged
    const count = await executeQuery(`SELECT COUNT(*) as total FROM products`)
    expect(count.total).toBe(2)
  }
)

test.fixme(
  'MIG-CONSTRAINT-003: should add NOT NULL constraint with default value',
  { tag: '@spec' },
  async ({ startServerWithSchema, executeQuery, applyMigration }) => {
    // GIVEN: table 'tasks' with optional status field
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_tasks',
          name: 'tasks',
          fields: [
            { id: 'fld_title', name: 'title', type: 'single-line-text' },
            {
              id: 'fld_status',
              name: 'status',
              type: 'single-select',
              config: {
                options: ['pending', 'in_progress', 'completed'],
              },
              required: false,
            },
          ],
        },
      ],
    })

    await executeQuery(`
      INSERT INTO tasks (title, status) VALUES
      ('Task 1', 'pending'),
      ('Task 2', NULL)
    `)

    // WHEN: applying migration to add NOT NULL with default value
    const migration = {
      type: 'add_constraint',
      tableId: 'tbl_tasks',
      fieldId: 'fld_status',
      constraint: {
        type: 'not_null',
        defaultValue: 'pending',
      },
    }

    await applyMigration(migration)

    // THEN: NULL values replaced with default, constraint enforced
    const tasks = await executeQuery(`SELECT status FROM tasks ORDER BY title`)
    expect(tasks).toHaveLength(2)
    expect(tasks[0].status).toBe('pending')
    expect(tasks[1].status).toBe('pending')

    // Verify NOT NULL enforced
    const insertNull = executeQuery(`INSERT INTO tasks (title, status) VALUES ('Task 3', NULL)`)
    await expect(insertNull).rejects.toThrow(/not null constraint violation/i)
  }
)

test.fixme(
  'MIG-CONSTRAINT-REGRESSION: constraint migrations work correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, executeQuery, applyMigration }) => {
    await startServerWithSchema({
      name: 'test-app',
      tables: [
        {
          id: 'tbl_test',
          name: 'test',
          fields: [
            { id: 'fld_name', name: 'name', type: 'single-line-text' },
            { id: 'fld_code', name: 'code', type: 'single-line-text' },
          ],
        },
      ],
    })

    await executeQuery(`INSERT INTO test (name, code) VALUES ('Test', 'CODE1')`)

    const migration = {
      type: 'add_constraint',
      tableId: 'tbl_test',
      fieldId: 'fld_code',
      constraint: { type: 'unique' },
    }

    await applyMigration(migration)

    const insertDuplicate = executeQuery(`INSERT INTO test (name, code) VALUES ('Test 2', 'CODE1')`)
    await expect(insertDuplicate).rejects.toThrow()
  }
)

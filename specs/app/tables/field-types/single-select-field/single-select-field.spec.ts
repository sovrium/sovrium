/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Single Select Field
 *
 * Source: specs/app/tables/field-types/single-select-field/single-select-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Single Select Field', () => {
  test.fixme(
    'APP-SINGLE-SELECT-FIELD-001: should create PostgreSQL VARCHAR column for single select storage',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'status',
                type: 'single-select',
                options: ['todo', 'in_progress', 'done'],
              },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='status'"
      )
      expect(columnInfo.data_type).toMatch(/character varying|text/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO tasks (status) VALUES ('todo') RETURNING status"
      )
      expect(validInsert.status).toBe('todo')
    }
  )

  test.fixme(
    'APP-SINGLE-SELECT-FIELD-002: should enforce CHECK constraint to allow only predefined options',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'category',
                type: 'single-select',
                options: ['electronics', 'clothing', 'food'],
              },
            ],
          },
        ],
      })

      const validInsert = await executeQuery(
        "INSERT INTO products (category) VALUES ('electronics') RETURNING category"
      )
      expect(validInsert.category).toBe('electronics')

      await expect(
        executeQuery("INSERT INTO products (category) VALUES ('invalid')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-SINGLE-SELECT-FIELD-003: should reject NULL value when single-select field is required',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
                required: true,
              },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='orders' AND column_name='priority'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      await expect(executeQuery('INSERT INTO orders (priority) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-SINGLE-SELECT-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tickets',
            name: 'tickets',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'status',
                type: 'single-select',
                options: ['open', 'closed'],
                default: 'open',
              },
            ],
          },
        ],
      })

      const defaultInsert = await executeQuery(
        'INSERT INTO tickets (id) VALUES (DEFAULT) RETURNING status'
      )
      expect(defaultInsert.status).toBe('open')
    }
  )

  test.fixme(
    'APP-SINGLE-SELECT-FIELD-005: should create btree index for fast queries when single-select field has indexed=true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_issues',
            name: 'issues',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'type',
                type: 'single-select',
                options: ['bug', 'feature', 'task'],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_issues_type'"
      )
      expect(indexExists.indexname).toBe('idx_issues_type')
    }
  )

  test.fixme(
    'user can complete full single-select-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'select_field',
                type: 'single-select',
                options: ['option1', 'option2', 'option3'],
                required: true,
                indexed: true,
                default: 'option1',
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (select_field) VALUES ('option2')")
      const stored = await executeQuery('SELECT select_field FROM data WHERE id = 1')
      expect(stored.select_field).toBe('option2')

      // Count by option
      await executeQuery("INSERT INTO data (select_field) VALUES ('option2'), ('option3')")
      const grouped = await executeQuery(
        'SELECT select_field, COUNT(*) as count FROM data GROUP BY select_field ORDER BY select_field'
      )
      expect(grouped).toContainEqual({ select_field: 'option2', count: 2 })
    }
  )
})

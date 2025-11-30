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
 * Source: src/domain/models/app/table/field-types/single-select-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Single Select Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-001: should create PostgreSQL VARCHAR column for single select storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'status',
                type: 'single-select',
                options: ['todo', 'in_progress', 'done'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='status'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/character varying|text/)
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('YES')

      // WHEN: executing query
      const validInsert = await executeQuery(
        "INSERT INTO tasks (status) VALUES ('todo') RETURNING status"
      )
      // THEN: assertion
      expect(validInsert.status).toBe('todo')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-002: should enforce CHECK constraint to allow only predefined options',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
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
                name: 'category',
                type: 'single-select',
                options: ['electronics', 'clothing', 'food'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const validInsert = await executeQuery(
        "INSERT INTO products (category) VALUES ('electronics') RETURNING category"
      )
      // THEN: assertion
      expect(validInsert.category).toBe('electronics')

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO products (category) VALUES ('invalid')")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-003: should reject NULL value when single-select field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
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
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='orders' AND column_name='priority'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // WHEN: executing query
      await expect(executeQuery('INSERT INTO orders (priority) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'status',
                type: 'single-select',
                options: ['open', 'closed'],
                default: 'open',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const defaultInsert = await executeQuery(
        'INSERT INTO tickets (id) VALUES (DEFAULT) RETURNING status'
      )
      // THEN: assertion
      expect(defaultInsert.status).toBe('open')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-005: should create btree index for fast queries when single-select field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'issues',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'type',
                type: 'single-select',
                options: ['bug', 'feature', 'task'],
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_issues_type'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_issues_type')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-SINGLE-SELECT-006: user can complete full single-select-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'select_field',
                type: 'single-select',
                options: ['option1', 'option2', 'option3'],
                required: true,
                indexed: true,
                default: 'option1',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery("INSERT INTO data (select_field) VALUES ('option2')")
      // WHEN: executing query
      const stored = await executeQuery('SELECT select_field FROM data WHERE id = 1')
      // THEN: assertion
      expect(stored.select_field).toBe('option2')

      // Count by option
      await executeQuery("INSERT INTO data (select_field) VALUES ('option2'), ('option3')")
      // WHEN: executing query
      const grouped = await executeQuery(
        'SELECT select_field, COUNT(*) as count FROM data GROUP BY select_field ORDER BY select_field'
      )
      // THEN: assertion
      expect(grouped).toContainEqual({ select_field: 'option2', count: 2 })
    }
  )
})

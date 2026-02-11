/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Progress Field
 *
 * Source: src/domain/models/app/table/field-types/progress-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (2 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Progress Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-001: should create PostgreSQL INTEGER column for progress percentage storage',
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
              { id: 2, name: 'progress', type: 'progress' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='progress'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toBe('integer')
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO tasks (progress) VALUES (75) RETURNING progress'
      )
      // THEN: assertion
      expect(validInsert.progress).toBe(75)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-002: should enforce 0-100 range constraint for progress values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'completion', type: 'progress' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const validInsert = await executeQuery(
        'INSERT INTO projects (completion) VALUES (50) RETURNING completion'
      )
      // THEN: assertion
      expect(validInsert.completion).toBe(50)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (completion) VALUES (-1)')).rejects.toThrow(
        /violates check constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (completion) VALUES (101)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-003: should support NOT NULL constraint with default 0',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with required progress field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'completion', type: 'progress', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: checking column constraints
      // THEN: Column is NOT NULL with default 0
      const columns = await executeQuery(
        `SELECT is_nullable, column_default FROM information_schema.columns
         WHERE table_name = 'tasks' AND column_name = 'completion'`
      )
      expect(columns.is_nullable).toBe('NO')
      expect(columns.column_default).toContain('0')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-004: should support DEFAULT value for progress field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with progress field defaulting to 50
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
                name: 'completion',
                type: 'progress',
                default: 50,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Insert record without setting progress
      await executeQuery(`INSERT INTO tasks DEFAULT VALUES`)

      // THEN: Progress defaults to 50
      const result = await executeQuery(`SELECT completion FROM tasks`)
      expect(result.completion).toBe(50)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-005: should return progress as percentage in API responses',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery, request, createAuthenticatedMember }) => {
      // GIVEN: table with progress field and a record at 75%
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'member',
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'completion', type: 'progress' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: { read: 'authenticated' },
          },
        ],
      })
      await executeQuery(`INSERT INTO tasks (title, completion) VALUES ('Task 1', 75)`)

      // WHEN: Authenticated user queries records
      await createAuthenticatedMember({ email: 'user@example.com' })
      const response = await request.get('/api/tables/1/records')

      // THEN: Progress returned as number 0-100
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records[0].fields.completion).toBe(75)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 2 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-PROGRESS-REGRESSION: user can complete full progress-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with progress fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'progress', type: 'progress' },
              { id: 3, name: 'completion', type: 'progress' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-PROGRESS-001: Creates PostgreSQL INTEGER column for progress percentage storage', async () => {
        // WHEN: querying column info for progress field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='progress'"
        )
        // THEN: INTEGER column is created
        expect(columnInfo.data_type).toBe('integer')
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting progress value
        const validInsert = await executeQuery(
          'INSERT INTO data (progress) VALUES (75) RETURNING progress'
        )
        // THEN: value is stored correctly
        expect(validInsert.progress).toBe(75)
      })

      await test.step('APP-TABLES-FIELD-TYPES-PROGRESS-002: Enforces 0-100 range constraint', async () => {
        // WHEN: inserting valid completion within range
        const validInsert = await executeQuery(
          'INSERT INTO data (completion) VALUES (50) RETURNING completion'
        )
        // THEN: value is stored correctly
        expect(validInsert.completion).toBe(50)

        // WHEN: attempting to insert completion below 0
        // THEN: CHECK constraint rejects insertion
        await expect(executeQuery('INSERT INTO data (completion) VALUES (-1)')).rejects.toThrow(
          /violates check constraint/
        )

        // WHEN: attempting to insert completion above 100
        // THEN: CHECK constraint rejects insertion
        await expect(executeQuery('INSERT INTO data (completion) VALUES (101)')).rejects.toThrow(
          /violates check constraint/
        )
      })
    }
  )
})

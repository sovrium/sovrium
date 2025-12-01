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
 * Spec Count: 2
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
    'APP-TABLES-FIELD-TYPES-PROGRESS-003: user can complete full progress-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'progress_field',
                type: 'progress',
                required: true,
                default: 0,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO data (progress_field) VALUES (25), (50), (100)')
      // WHEN: querying the database
      const results = await executeQuery('SELECT AVG(progress_field) as avg FROM data')
      // THEN: assertion
      expect(parseFloat(results.avg)).toBeCloseTo(58.33, 1)
    }
  )
})

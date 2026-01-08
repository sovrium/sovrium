/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Duration Field
 *
 * Source: src/domain/models/app/table/field-types/duration-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Duration Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-001: should create PostgreSQL INTERVAL column when table configuration has duration field',
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
              { id: 2, name: 'duration', type: 'duration' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='duration'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toBe('interval')
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO tasks (duration) VALUES ('2 hours 30 minutes') RETURNING duration"
      )
      // THEN: assertion
      expect(validInsert.duration).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-002: should store various duration formats (hours, days, etc)',
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
              { id: 2, name: 'estimated_time', type: 'duration' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery([
        "INSERT INTO projects (estimated_time) VALUES ('1 day'), ('3 hours'), ('45 minutes')",
      ])

      // WHEN: querying the database
      const results = await executeQuery('SELECT estimated_time FROM projects ORDER BY id')
      // THEN: assertion
      expect(results.rows.length).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-003: should reject NULL value when duration field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'meetings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'length', type: 'duration', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='meetings' AND column_name='length'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO meetings (length) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'sessions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'timeout', type: 'duration', default: 1800 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const defaultInsert = await executeQuery(
        'INSERT INTO sessions (id) VALUES (DEFAULT) RETURNING timeout'
      )
      // THEN: assertion
      expect(defaultInsert.timeout).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-005: should create btree index for fast queries when duration field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'videos',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'length',
                type: 'duration',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_videos_length'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_videos_length')
    }
  )

  // NOTE: Display formatting tests (h:mm, h:mm:ss, decimal formats, input parsing)
  // have been moved to:
  // specs/api/tables/{tableId}/records/format.spec.ts
  // These tests now validate API response formatting rather than UI display.

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-REGRESSION: user can complete full duration-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-FIELD-TYPES-DURATION-001: Create PostgreSQL INTERVAL column', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'duration', type: 'duration' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='duration'"
        )
        expect(columnInfo.data_type).toBe('interval')
        expect(columnInfo.is_nullable).toBe('YES')
        const validInsert = await executeQuery(
          "INSERT INTO tasks (duration) VALUES ('2 hours 30 minutes') RETURNING duration"
        )
        expect(validInsert.duration).toBeTruthy()
      })

      await test.step('APP-TABLES-FIELD-TYPES-DURATION-002: Store various duration formats', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'projects',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'estimated_time', type: 'duration' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        await executeQuery([
          "INSERT INTO projects (estimated_time) VALUES ('1 day'), ('3 hours'), ('45 minutes')",
        ])
        const results = await executeQuery('SELECT estimated_time FROM projects ORDER BY id')
        expect(results.rows.length).toBe(3)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DURATION-003: Reject NULL when required', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'meetings',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'length', type: 'duration', required: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='meetings' AND column_name='length'"
        )
        expect(notNullCheck.is_nullable).toBe('NO')
        await expect(executeQuery('INSERT INTO meetings (length) VALUES (NULL)')).rejects.toThrow(
          /violates not-null constraint/
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-DURATION-004: Apply DEFAULT value', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'sessions',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'timeout', type: 'duration', default: 1800 },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const defaultInsert = await executeQuery(
          'INSERT INTO sessions (id) VALUES (DEFAULT) RETURNING timeout'
        )
        expect(defaultInsert.timeout).toBeTruthy()
      })

      await test.step('APP-TABLES-FIELD-TYPES-DURATION-005: Create btree index when indexed=true', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'videos',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'length',
                  type: 'duration',
                  required: true,
                  indexed: true,
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_videos_length'"
        )
        expect(indexExists.indexname).toBe('idx_videos_length')
      })
    }
  )
})

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
 * Spec Count: 11
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DURATION-006: should display duration in h:mm format when displayFormat is h:mm',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with duration field configured with h:mm format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'time_spent',
                type: 'duration',
                displayFormat: 'h:mm',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views duration field in table
      await page.goto('/tables/tasks')

      // THEN: duration is displayed in h:mm format (1:30)
      await expect(page.getByText('1:30')).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DURATION-007: should display duration in h:mm:ss format when displayFormat is h:mm:ss',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with duration field configured with h:mm:ss format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'videos',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'length',
                type: 'duration',
                displayFormat: 'h:mm:ss',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views duration field in table
      await page.goto('/tables/videos')

      // THEN: duration is displayed in h:mm:ss format (1:30:45)
      await expect(page.getByText('1:30:45')).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DURATION-008: should display duration in decimal format when displayFormat is decimal',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with duration field configured with decimal format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'timesheets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'hours_worked',
                type: 'duration',
                displayFormat: 'decimal',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views duration field in table
      await page.goto('/tables/timesheets')

      // THEN: duration is displayed in decimal format (1.5)
      await expect(page.getByText('1.5')).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DURATION-009: should parse various input formats to duration',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with duration field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'activities',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'duration',
                type: 'duration',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user enters duration in various formats
      await page.goto('/tables/activities')
      await page.getByRole('button', { name: 'Add record' }).click()

      // Test various input formats
      const durationInput = page.getByLabel('Duration')

      // Input: "90" (minutes)
      await durationInput.fill('90')
      // THEN: should be parsed as 1.5 hours or 1:30

      // Input: "1:30" (h:mm)
      await durationInput.fill('1:30')
      // THEN: should be parsed correctly

      // Input: "1.5" (decimal hours)
      await durationInput.fill('1.5')
      // THEN: should be parsed correctly

      await expect(durationInput).toBeVisible() // Basic assertion for test structure
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DURATION-010: user can complete full duration-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with duration field', async () => {
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
                  name: 'duration_field',
                  type: 'duration',
                  required: true,
                  indexed: true,
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert and verify duration value', async () => {
        await executeQuery("INSERT INTO data (duration_field) VALUES ('2 hours 15 minutes')")
        const stored = await executeQuery('SELECT duration_field FROM data WHERE id = 1')
        expect(stored.duration_field).toBeTruthy()
      })
    }
  )
})

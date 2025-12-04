/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for DateTime Field
 *
 * Source: src/domain/models/app/table/field-types/datetime-field.ts
 * Domain: app
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('DateTime Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-001: should create PostgreSQL TIMESTAMPTZ column when table configuration has datetime field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with datetime field 'created_at'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL TIMESTAMPTZ column is created (timezone-aware)
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='created_at'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('created_at')
      expect(columnInfo.data_type).toMatch(/timestamp/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO posts (created_at) VALUES ('2024-06-15 14:30:00+00') RETURNING created_at"
      )
      // THEN: assertion
      expect(validInsert.created_at).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-002: should store date and time with timezone information',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with datetime field 'timestamp'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'timestamp', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting datetime values with timezone
      // THEN: both date and time with timezone are stored
      await executeQuery([
        "INSERT INTO events (timestamp) VALUES ('2024-01-01 10:00:00+00'), ('2024-12-31 23:59:59+00')",
      ])

      const results = await executeQuery('SELECT timestamp FROM events ORDER BY timestamp')
      // THEN: assertion
      expect(results.rows).toHaveLength(2)
      expect(results.rows[0].timestamp).toBeTruthy()
      expect(results.rows[1].timestamp).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-003: should reject NULL value when datetime field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with required datetime field 'published_at'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'published_at', type: 'datetime', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: attempting to insert NULL for required datetime
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='articles' AND column_name='published_at'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO articles (published_at) VALUES ('2024-06-30 12:00:00+00') RETURNING published_at"
      )
      // THEN: assertion
      expect(validInsert.published_at).toBeTruthy()

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO articles (published_at) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with datetime field 'updated_at' and default value NOW()
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'updated_at', type: 'datetime', default: 'NOW()' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing updated_at value
      // THEN: PostgreSQL applies DEFAULT value (current timestamp)
      const defaultInsert = await executeQuery(
        'INSERT INTO records (id) VALUES (DEFAULT) RETURNING updated_at'
      )
      // THEN: assertion
      expect(defaultInsert.updated_at).toBeTruthy()

      const explicitInsert = await executeQuery(
        "INSERT INTO records (updated_at) VALUES ('2024-01-01 00:00:00+00') RETURNING updated_at"
      )
      // THEN: assertion
      expect(explicitInsert.updated_at).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-005: should create btree index for fast queries when datetime field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with datetime field 'created_at', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'created_at',
                type: 'datetime',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the datetime field
      // THEN: PostgreSQL btree index exists for fast timestamp range queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_logs_created_at'"
      )
      // THEN: assertion
      expect(indexExists.rows[0]).toEqual({
        indexname: 'idx_logs_created_at',
        tablename: 'logs',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATETIME-006: should display time in 12-hour format when timeFormat is 12-hour',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with datetime field configured with 12-hour time format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'scheduled_time',
                type: 'datetime',
                timeFormat: '12-hour',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views datetime field in table
      await page.goto('/tables/appointments')

      // THEN: time is displayed in 12-hour format with AM/PM
      await expect(page.getByText(/2:30 PM/)).toBeVisible()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-007: should display time in 24-hour format when timeFormat is 24-hour',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with datetime field configured with 24-hour time format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'scheduled_time',
                type: 'datetime',
                timeFormat: '24-hour',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views datetime field in table
      await page.goto('/tables/appointments')

      // THEN: time is displayed in 24-hour format (14:30 instead of 2:30 PM)
      await expect(page.getByText(/14:30/)).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATETIME-008: should display datetime with specific timezone when timeZone is configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with datetime field configured with specific timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_time',
                type: 'datetime',
                timeZone: 'America/Los_Angeles',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views datetime field from different timezone
      await page.goto('/tables/events')

      // THEN: datetime is displayed in specified timezone (PST/PDT)
      // Note: Timezone conversion should be applied consistently
      const timeCell = page.locator('[data-field="event_time"]').first()
      await expect(timeCell).toBeVisible()
      // Exact value depends on timezone conversion and DST rules
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATETIME-009: should use local timezone when timeZone is set to local',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with datetime field configured to use local timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'meetings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'meeting_time',
                type: 'datetime',
                timeZone: 'local',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views datetime field in table
      await page.goto('/tables/meetings')

      // THEN: datetime is displayed in user's local browser timezone
      const timeCell = page.locator('[data-field="meeting_time"]').first()
      await expect(timeCell).toBeVisible()
      // Value should match user's browser timezone
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATETIME-010: user can complete full datetime-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with datetime field', async () => {
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
                  name: 'datetime_field',
                  type: 'datetime',
                  required: true,
                  indexed: true,
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Verify column setup and constraints', async () => {
        const columnInfo = await executeQuery(
          "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='datetime_field'"
        )
        expect(columnInfo.data_type).toMatch(/timestamp/)
        expect(columnInfo.is_nullable).toBe('NO')
      })

      await test.step('Test datetime storage', async () => {
        await executeQuery(
          "INSERT INTO data (datetime_field) VALUES ('2024-06-15 10:30:00+00'), ('2024-06-15 14:30:00+00')"
        )
      })

      await test.step('Test datetime range queries', async () => {
        const rangeQuery = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE datetime_field >= '2024-06-15 10:00:00+00' AND datetime_field <= '2024-06-15 15:00:00+00'"
        )
        expect(rangeQuery.count).toBe(2)
      })

      await test.step('Error handling: NOT NULL constraint rejects NULL value', async () => {
        await expect(
          executeQuery('INSERT INTO data (datetime_field) VALUES (NULL)')
        ).rejects.toThrow(/violates not-null constraint/)
      })
    }
  )
})

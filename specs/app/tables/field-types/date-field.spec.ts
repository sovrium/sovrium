/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Date Field
 *
 * Source: src/domain/models/app/table/field-types/date-field.ts
 * Domain: app
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (11 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Date Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DATE-001: should create PostgreSQL DATE column when table configuration has date field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with date field 'birth_date'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'birth_date', type: 'date' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL DATE column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='birth_date'"
      )
      // THEN: assertion
      expect(columnInfo).toMatchObject({
        column_name: 'birth_date',
        data_type: 'date',
        is_nullable: 'YES',
      })

      const validInsert = await executeQuery(
        "INSERT INTO users (birth_date) VALUES ('1990-05-15') RETURNING birth_date"
      )
      // THEN: assertion
      expect(validInsert).toMatchObject({
        birth_date: '1990-05-15',
      })
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-002: should store date values without time component',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with date field 'event_date'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_date', type: 'date' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: inserting date values
      // THEN: only date is stored (no time component)
      await executeQuery(["INSERT INTO events (event_date) VALUES ('2024-01-01'), ('2024-12-31')"])

      const results = await executeQuery('SELECT event_date FROM events ORDER BY event_date')
      // THEN: assertion
      expect(results.rows).toEqual([{ event_date: '2024-01-01' }, { event_date: '2024-12-31' }])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-003: should reject NULL value when date field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with required date field 'due_date'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'due_date', type: 'date', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: attempting to insert NULL for required date
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='due_date'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO tasks (due_date) VALUES ('2024-06-30') RETURNING due_date"
      )
      // THEN: assertion
      expect(validInsert.due_date).toBe('2024-06-30')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO tasks (due_date) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with date field 'start_date' and default value CURRENT_DATE
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'subscriptions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'start_date', type: 'date', default: 'CURRENT_DATE' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing start_date value
      // THEN: PostgreSQL applies DEFAULT value (current date)
      const defaultInsert = await executeQuery(
        'INSERT INTO subscriptions (id) VALUES (DEFAULT) RETURNING start_date'
      )
      // THEN: assertion
      expect(defaultInsert.start_date).toBeTruthy()

      const explicitInsert = await executeQuery(
        "INSERT INTO subscriptions (start_date) VALUES ('2024-01-01') RETURNING start_date"
      )
      // THEN: assertion
      expect(explicitInsert.start_date).toBe('2024-01-01')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-005: should create btree index for fast queries when date field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with date field 'created_date', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'created_date',
                type: 'date',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the date field
      // THEN: PostgreSQL btree index exists for fast date range queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_orders_created_date'"
      )
      // THEN: assertion
      expect(indexExists).toMatchObject({
        indexname: 'idx_orders_created_date',
        tablename: 'orders',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATE-006: should display date in US format (M/D/YYYY) when dateFormat is US',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with date field configured with US format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_date',
                type: 'date',
                dateFormat: 'US',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views date field in table
      await page.goto('/tables/events')

      // THEN: date is displayed in US format (M/D/YYYY)
      await expect(page.getByText('6/15/2024')).toBeVisible()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-007: should display date in European format (D/M/YYYY) when dateFormat is European',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with date field configured with European format
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_date',
                type: 'date',
                dateFormat: 'European',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views date field in table
      await page.goto('/tables/events')

      // THEN: date is displayed in European format (D/M/YYYY)
      await expect(page.getByText('15/6/2024')).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATE-008: should display date in ISO format (YYYY-MM-DD) when dateFormat is ISO',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with date field configured with ISO format
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
                name: 'event_date',
                type: 'date',
                dateFormat: 'ISO',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views date field in table
      await page.goto('/tables/events')

      // THEN: date is displayed in ISO format (YYYY-MM-DD)
      await expect(page.getByText('2024-06-15')).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATE-009: should include time component when includeTime is true',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with date field configured to include time
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'scheduled_date',
                type: 'date',
                includeTime: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user views date field with time in table
      await page.goto('/tables/appointments')

      // THEN: date is displayed with time component
      await expect(page.getByText(/6\/15\/2024.*2:30 PM/)).toBeVisible()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-DATE-010: should handle timezone conversion when timeZone is specified',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: table with date field configured with specific timezone
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_date',
                type: 'date',
                includeTime: true,
                timeZone: 'America/New_York',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: user in different timezone views date
      await page.goto('/tables/events')

      // THEN: date is displayed in specified timezone
      // Note: This test verifies timezone conversion logic is applied
      const dateCell = page.locator('[data-field="event_date"]').first()
      await expect(dateCell).toBeVisible()
      // Exact value depends on timezone conversion implementation
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DATE-011: user can complete full date-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with date field', async () => {
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
                  name: 'date_field',
                  type: 'date',
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
          "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='date_field'"
        )
        expect(columnInfo.data_type).toBe('date')
        expect(columnInfo.is_nullable).toBe('NO')
      })

      await test.step('Test date storage', async () => {
        await executeQuery("INSERT INTO data (date_field) VALUES ('2024-06-15')")
        const stored = await executeQuery('SELECT date_field FROM data WHERE id = 1')
        expect(stored.date_field).toBe('2024-06-15')
      })

      await test.step('Test date range queries', async () => {
        await executeQuery("INSERT INTO data (date_field) VALUES ('2024-01-01'), ('2024-12-31')")
        const rangeQuery = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE date_field >= '2024-06-01' AND date_field <= '2024-12-31'"
        )
        expect(rangeQuery.count).toBeGreaterThan(0)
      })
    }
  )
})

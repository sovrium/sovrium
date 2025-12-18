/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Timezone Handling
 *
 * Source: src/domain/models/app/table/field-types/datetime-field.ts
 * Domain: app
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL TIMESTAMP vs TIMESTAMPTZ behavior
 * - Session timezone conversion on retrieval
 * - DST (Daylight Saving Time) handling
 * - Effect.DateTime integration with PostgreSQL timestamps
 *
 * PostgreSQL Timestamp Types:
 * - TIMESTAMP WITHOUT TIME ZONE (default for created-at, updated-at)
 * - TIMESTAMP WITH TIME ZONE (for timezone-aware dates)
 * - Application must handle timezone conversions at boundaries
 */

test.describe('Timezone Handling', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-TIMEZONE-001: should store created-at as TIMESTAMP WITHOUT TIME ZONE by default',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with created-at field (default behavior)
      // WHEN: created-at field creates PostgreSQL column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      // THEN: Column type is TIMESTAMP WITHOUT TIME ZONE

      const columnType = await executeQuery(
        `SELECT column_name, data_type, datetime_precision
         FROM information_schema.columns
         WHERE table_name = 'events' AND column_name = 'created_at'`
      )
      // THEN: assertion
      expect(columnType.rows[0]).toMatchObject({
        column_name: 'created_at',
        data_type: 'timestamp without time zone',
      })

      // Insert with explicit timestamp
      await executeQuery(
        `INSERT INTO events (title, created_at) VALUES ('Event 1', '2024-01-15 10:30:00')`
      )

      // Stored value matches input (no timezone conversion)
      const storedValue = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)
      // THEN: assertion
      expect(storedValue.rows[0].created_at).toMatch(/2024-01-15.*10:30:00/)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-002: should use TIMESTAMP WITH TIME ZONE for timezone-aware datetime fields',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: datetime field configured as timezone-aware
      // WHEN: timezone-aware datetime field creates PostgreSQL column
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              {
                id: 2,
                name: 'scheduled_at',
                type: 'datetime',
                timezone: 'UTC', // Enable timezone awareness - stores with timezone info
              },
            ],
          },
        ],
      })

      // THEN: Column type is TIMESTAMP WITH TIME ZONE

      const columnType = await executeQuery(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = 'appointments' AND column_name = 'scheduled_at'`
      )
      // THEN: assertion
      expect(columnType.rows[0]).toMatchObject({
        data_type: 'timestamp with time zone',
      })

      // Insert with timezone offset
      await executeQuery(
        `INSERT INTO appointments (title, scheduled_at) VALUES ('Meeting', '2024-01-15 10:30:00-05:00')`
      )

      // PostgreSQL converts to server timezone (UTC by default)
      const storedValue = await executeQuery(`SELECT scheduled_at FROM appointments WHERE id = 1`)
      // THEN: assertion
      expect(storedValue.rows[0].scheduled_at).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-TIMEZONE-003: should preserve UTC offset when inserting TIMESTAMPTZ values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: timezone-aware datetime field
      // WHEN: inserting timestamps with different timezone offsets
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'logs',
            fields: [
              { id: 1, name: 'message', type: 'single-line-text' },
              { id: 2, name: 'occurred_at', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO logs (message, occurred_at) VALUES ('EST', '2024-01-15 10:00:00-05:00')`
      ) // EST
      await executeQuery(
        `INSERT INTO logs (message, occurred_at) VALUES ('PST', '2024-01-15 10:00:00-08:00')`
      ) // PST
      await executeQuery(
        `INSERT INTO logs (message, occurred_at) VALUES ('UTC', '2024-01-15 10:00:00+00:00')`
      ) // UTC

      // THEN: PostgreSQL normalizes all to same instant (UTC storage)

      await executeQuery(`SET TIME ZONE 'UTC'`)
      const results = await executeQuery(
        `SELECT message, occurred_at AT TIME ZONE 'UTC' as utc_time FROM logs ORDER BY id`
      )

      // All converted to UTC equivalent
      // THEN: assertion - 10:00 EST = 15:00 UTC
      expect(results.rows[0].utc_time).toMatch(/15:00:00/)
      // THEN: assertion - 10:00 PST = 18:00 UTC
      expect(results.rows[1].utc_time).toMatch(/18:00:00/)
      // THEN: assertion - 10:00 UTC = 10:00 UTC
      expect(results.rows[2].utc_time).toMatch(/10:00:00/)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-004: should NOT convert TIMESTAMP WITHOUT TIME ZONE on session timezone change',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with TIMESTAMP WITHOUT TIME ZONE field
      // WHEN: setting session timezone to different values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' }, // No timezone
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO events (title, created_at) VALUES ('Event', '2024-01-15 10:30:00')`
      )

      // THEN: Stored timestamp value doesn't change (no timezone conversion)

      await executeQuery(`SET TIME ZONE 'America/New_York'`)
      const estResult = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)

      await executeQuery(`SET TIME ZONE 'America/Los_Angeles'`)
      const pstResult = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)

      await executeQuery(`SET TIME ZONE 'UTC'`)
      const utcResult = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)

      // All return same value (no conversion - timestamp is "zoneless")
      // THEN: assertion
      expect(estResult.rows[0].created_at).toBe(pstResult.rows[0].created_at)
      expect(pstResult.rows[0].created_at).toBe(utcResult.rows[0].created_at)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-005: should convert TIMESTAMP WITH TIME ZONE to session timezone on retrieval',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with TIMESTAMP WITH TIME ZONE field
      // WHEN: retrieving with different session timezones
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'appointments',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'scheduled_at', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      // Insert 3pm UTC
      await executeQuery(
        `INSERT INTO appointments (title, scheduled_at) VALUES ('Meeting', '2024-01-15 15:00:00+00:00')`
      )

      // THEN: PostgreSQL converts to session timezone

      await executeQuery(`SET TIME ZONE 'UTC'`)
      const utcResult = await executeQuery(`SELECT scheduled_at FROM appointments WHERE id = 1`)
      // THEN: assertion - 15:00 UTC
      expect(utcResult.rows[0].scheduled_at).toMatch(/15:00:00/)

      await executeQuery(`SET TIME ZONE 'America/New_York'`) // EST (UTC-5)
      const estResult = await executeQuery(`SELECT scheduled_at FROM appointments WHERE id = 1`)
      // THEN: assertion - 15:00 UTC = 10:00 EST
      expect(estResult.rows[0].scheduled_at).toMatch(/10:00:00/)

      await executeQuery(`SET TIME ZONE 'Asia/Tokyo'`) // JST (UTC+9)
      const jstResult = await executeQuery(`SELECT scheduled_at FROM appointments WHERE id = 1`)
      // THEN: assertion - 15:00 UTC = 00:00 JST (next day)
      expect(jstResult.rows[0].scheduled_at).toMatch(/00:00:00/)
    }
  )

  test.fixme(
    'APP-TABLES-TIMEZONE-006: should handle daylight saving time transitions correctly',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: timezone-aware datetime spanning DST transition
      // WHEN: inserting timestamps before/during/after DST transition (US: March 10, 2024)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'dst_test',
            fields: [
              { id: 1, name: 'description', type: 'single-line-text' },
              { id: 2, name: 'event_time', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      // Before DST (EST = UTC-5)
      await executeQuery(
        `INSERT INTO dst_test (description, event_time) VALUES ('Before DST', '2024-03-09 10:00:00 America/New_York')`
      )
      // After DST (EDT = UTC-4)
      await executeQuery(
        `INSERT INTO dst_test (description, event_time) VALUES ('After DST', '2024-03-11 10:00:00 America/New_York')`
      )

      // THEN: PostgreSQL correctly handles DST offset changes

      await executeQuery(`SET TIME ZONE 'UTC'`)
      const results = await executeQuery(`SELECT description, event_time FROM dst_test ORDER BY id`)

      // Before DST: 10:00 EST = 15:00 UTC (EST = UTC-5)
      // THEN: assertion
      expect(results.rows[0].event_time).toMatch(/15:00:00/)

      // After DST: 10:00 EDT = 14:00 UTC (EDT = UTC-4)
      // THEN: assertion
      expect(results.rows[1].event_time).toMatch(/14:00:00/)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-007: should handle ambiguous timestamps during DST fall-back with explicit offset',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: timezone-aware datetime field
      // WHEN: inserting timestamp during DST fall-back (1:30 AM occurs twice on Nov 3, 2024)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'ambiguous_times',
            fields: [
              { id: 1, name: 'description', type: 'single-line-text' },
              { id: 2, name: 'event_time', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL requires explicit offset or uses default interpretation

      // Explicit offset (unambiguous)
      await executeQuery(
        `INSERT INTO ambiguous_times (description, event_time) VALUES ('EDT', '2024-11-03 01:30:00-04:00')`
      ) // EDT
      await executeQuery(
        `INSERT INTO ambiguous_times (description, event_time) VALUES ('EST', '2024-11-03 01:30:00-05:00')`
      ) // EST

      // Verify both stored (different UTC times)
      await executeQuery(`SET TIME ZONE 'UTC'`)
      const results = await executeQuery(
        `SELECT description, event_time FROM ambiguous_times ORDER BY id`
      )

      // THEN: assertion - 1:30 EDT = 5:30 UTC
      expect(results.rows[0].event_time).toMatch(/05:30:00/)
      // THEN: assertion - 1:30 EST = 6:30 UTC
      expect(results.rows[1].event_time).toMatch(/06:30:00/)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-008: should compare timestamps correctly across different timezones',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: timezone-aware timestamps from different zones
      // WHEN: comparing events from NYC, London, and Tokyo
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'global_events',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'location', type: 'single-line-text' },
              { id: 3, name: 'occurred_at', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      // All events at the same instant (15:00 UTC)
      await executeQuery(
        `INSERT INTO global_events (title, location, occurred_at) VALUES ('NYC Event', 'New York', '2024-01-15 10:00:00-05:00')`
      )
      await executeQuery(
        `INSERT INTO global_events (title, location, occurred_at) VALUES ('London Event', 'London', '2024-01-15 15:00:00+00:00')`
      )
      await executeQuery(
        `INSERT INTO global_events (title, location, occurred_at) VALUES ('Tokyo Event', 'Tokyo', '2024-01-16 00:00:00+09:00')`
      )

      // THEN: PostgreSQL compares timestamps in UTC (all equal)

      // All three events occurred at same instant
      const distinctTimes = await executeQuery(
        `SELECT COUNT(DISTINCT occurred_at) as count FROM global_events`
      )
      // THEN: assertion - all 3 events at same UTC instant
      expect(distinctTimes.rows[0]).toMatchObject({ count: 1 })

      // Ordering works correctly
      const ordered = await executeQuery(`SELECT title FROM global_events ORDER BY occurred_at, id`)
      // THEN: assertion
      expect(ordered.rows).toHaveLength(3)
    }
  )

  test(
    'APP-TABLES-TIMEZONE-009: should validate Effect.DateTime integration with PostgreSQL timestamps',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: application using Effect.DateTime for date handling
      // WHEN: Effect.DateTime values are stored in PostgreSQL
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'effect_dates',
            fields: [
              { id: 1, name: 'description', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'created-at' },
              { id: 3, name: 'scheduled_at', type: 'datetime', timezone: 'UTC' },
            ],
          },
        ],
      })

      // THEN: Timezone conversion and serialization work correctly

      // Application layer should:
      // 1. Convert Effect.DateTime to ISO 8601 string with timezone
      // 2. PostgreSQL stores in UTC
      // 3. Query returns timestamp
      // 4. Application converts back to Effect.DateTime

      const now = new Date('2024-01-15T10:30:00Z')
      await executeQuery(
        `INSERT INTO effect_dates (description, created_at, scheduled_at)
         VALUES ('Test', '${now.toISOString()}', '${now.toISOString()}')`
      )

      const result = await executeQuery(
        `SELECT created_at, scheduled_at FROM effect_dates WHERE id = 1`
      )
      // THEN: assertion
      expect(result.rows[0].created_at).toBeTruthy()
      expect(result.rows[0].scheduled_at).toBeTruthy()

      // ISO 8601 format preserved for Effect.DateTime parsing
      const isoCheck = await executeQuery(
        `SELECT to_char(scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as iso_format
         FROM effect_dates WHERE id = 1`
      )
      // THEN: assertion
      expect(isoCheck.rows[0].iso_format).toBe('2024-01-15T10:30:00Z')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration workflow
  // ============================================================================

  test.fixme(
    'APP-TABLES-TIMEZONE-010: user can complete full timezone-handling workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create tables with timezone-aware and zoneless timestamps', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'events',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text' },
                { id: 2, name: 'created_at', type: 'created-at' }, // Zoneless
                { id: 3, name: 'scheduled_at', type: 'datetime', timezone: 'UTC' }, // Timezone-aware
              ],
            },
          ],
        })
      })

      await test.step('Verify TIMESTAMP vs TIMESTAMPTZ column types', async () => {
        const columns = await executeQuery(
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_name = 'events' AND column_name IN ('created_at', 'scheduled_at')
           ORDER BY column_name`
        )
        expect(columns.rows[0]).toMatchObject({
          column_name: 'created_at',
          data_type: 'timestamp without time zone',
        })
        expect(columns.rows[1]).toMatchObject({
          column_name: 'scheduled_at',
          data_type: 'timestamp with time zone',
        })
      })

      await test.step('Verify timezone conversion behavior', async () => {
        await executeQuery(
          `INSERT INTO events (title, created_at, scheduled_at)
           VALUES ('Test', '2024-01-15 10:00:00', '2024-01-15 10:00:00-05:00')`
        )

        await executeQuery(`SET TIME ZONE 'UTC'`)
        const utc = await executeQuery(`SELECT scheduled_at FROM events WHERE id = 1`)
        // 10:00 EST = 15:00 UTC
        expect(utc.rows[0].scheduled_at).toMatch(/15:00:00/)

        await executeQuery(`SET TIME ZONE 'America/New_York'`)
        const est = await executeQuery(`SELECT scheduled_at FROM events WHERE id = 1`)
        // Returns original timezone
        expect(est.rows[0].scheduled_at).toMatch(/10:00:00/)
      })

      await test.step('Verify zoneless timestamp is not converted', async () => {
        await executeQuery(`SET TIME ZONE 'UTC'`)
        const utcCreated = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)

        await executeQuery(`SET TIME ZONE 'America/New_York'`)
        const estCreated = await executeQuery(`SELECT created_at FROM events WHERE id = 1`)

        // Same value regardless of session timezone
        expect(utcCreated.rows[0].created_at).toBe(estCreated.rows[0].created_at)
      })
    }
  )
})

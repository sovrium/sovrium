/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Time Field
 *
 * Source: src/domain/models/app/table/field-types/time-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Time Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-TIME-001: should create PostgreSQL TIME column when table configuration has time field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'schedules',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'start_time', type: 'time' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='schedules' AND column_name='start_time'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/time/)
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO schedules (start_time) VALUES ('14:30:00') RETURNING start_time"
      )
      // THEN: assertion
      expect(validInsert.start_time).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-TIME-002: should store time values without date component',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'appointments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'appointment_time', type: 'time' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery([
        "INSERT INTO appointments (appointment_time) VALUES ('09:00:00'), ('17:30:00')",
      ])

      // WHEN: querying the database
      const results = await executeQuery(
        'SELECT appointment_time FROM appointments ORDER BY appointment_time'
      )
      // THEN: assertion
      expect(results.rows.length).toBe(2)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-TIME-003: should reject NULL value when time field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'shifts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'shift_start', type: 'time', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_start'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO shifts (shift_start) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-TIME-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'config',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'default_time', type: 'time', default: '12:00:00' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const defaultInsert = await executeQuery(
        'INSERT INTO config (id) VALUES (DEFAULT) RETURNING default_time'
      )
      // THEN: assertion
      expect(defaultInsert.default_time).toBeTruthy()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-TIME-005: should create btree index for fast queries when time field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'event_time',
                type: 'time',
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
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_events_event_time'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_events_event_time')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-TIME-REGRESSION: user can complete full time-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with time fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'start_time', type: 'time' },
              { id: 3, name: 'shift_start', type: 'time', required: true },
              { id: 4, name: 'default_time', type: 'time', default: '12:00:00' },
              { id: 5, name: 'event_time', type: 'time', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-TIME-001: Creates PostgreSQL TIME column', async () => {
        // WHEN: querying column info for time field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='start_time'"
        )
        // THEN: TIME column is created
        expect(columnInfo.data_type).toMatch(/time/)
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting time value
        const validInsert = await executeQuery(
          "INSERT INTO data (start_time, shift_start) VALUES ('14:30:00', '09:00:00') RETURNING start_time"
        )
        // THEN: value is stored correctly
        expect(validInsert.start_time).toBeTruthy()
      })

      await test.step('APP-TABLES-FIELD-TYPES-TIME-002: Stores time values without date component', async () => {
        // WHEN: inserting multiple time values
        await executeQuery([
          "INSERT INTO data (start_time, shift_start) VALUES ('09:00:00', '08:00:00'), ('17:30:00', '16:00:00')",
        ])

        // WHEN: querying stored time values
        const results = await executeQuery(
          'SELECT start_time FROM data WHERE start_time IS NOT NULL ORDER BY start_time'
        )
        // THEN: time values are stored correctly
        expect(results.rows.length).toBeGreaterThanOrEqual(2)
      })

      await test.step('APP-TABLES-FIELD-TYPES-TIME-003: Rejects NULL when required', async () => {
        // WHEN: querying NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='shift_start'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: attempting to insert NULL for required time
        // THEN: NOT NULL constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (shift_start) VALUES (NULL)')
        ).rejects.toThrow(/violates not-null constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-TIME-004: Applies DEFAULT value', async () => {
        // WHEN: inserting row without providing default_time value
        const defaultInsert = await executeQuery(
          "INSERT INTO data (shift_start) VALUES ('10:00:00') RETURNING default_time"
        )
        // THEN: DEFAULT value is applied
        expect(defaultInsert.default_time).toBeTruthy()
      })

      await test.step('APP-TABLES-FIELD-TYPES-TIME-005: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed time field
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_data_event_time'"
        )
        // THEN: btree index exists
        expect(indexExists.indexname).toBe('idx_data_event_time')
      })
    }
  )
})

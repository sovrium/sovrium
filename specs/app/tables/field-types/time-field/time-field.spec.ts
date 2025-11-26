/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Time Field
 *
 * Source: specs/app/tables/field-types/time-field/time-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Time Field', () => {
  test.fixme(
    'APP-TIME-FIELD-001: should create PostgreSQL TIME column when table configuration has time field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_schedules',
            name: 'schedules',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'start_time', type: 'time' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='schedules' AND column_name='start_time'"
      )
      expect(columnInfo.data_type).toMatch(/time/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO schedules (start_time) VALUES ('14:30:00') RETURNING start_time"
      )
      expect(validInsert.start_time).toBeTruthy()
    }
  )

  test.fixme(
    'APP-TIME-FIELD-002: should store time values without date component',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_appointments',
            name: 'appointments',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'appointment_time', type: 'time' },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO appointments (appointment_time) VALUES ('09:00:00'), ('17:30:00')",
      ])

      const results = await executeQuery(
        'SELECT appointment_time FROM appointments ORDER BY appointment_time'
      )
      expect(results.length).toBe(2)
    }
  )

  test.fixme(
    'APP-TIME-FIELD-003: should reject NULL value when time field is required',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_shifts',
            name: 'shifts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'shift_start', type: 'time', required: true },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='shifts' AND column_name='shift_start'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      await expect(executeQuery('INSERT INTO shifts (shift_start) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-TIME-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_config',
            name: 'config',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'default_time', type: 'time', default: '12:00:00' },
            ],
          },
        ],
      })

      const defaultInsert = await executeQuery(
        'INSERT INTO config (id) VALUES (DEFAULT) RETURNING default_time'
      )
      expect(defaultInsert.default_time).toBeTruthy()
    }
  )

  test.fixme(
    'APP-TIME-FIELD-005: should create btree index for fast queries when time field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_events',
            name: 'events',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'event_time', type: 'time', required: true, indexed: true },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_events_event_time'"
      )
      expect(indexExists.indexname).toBe('idx_events_event_time')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TIME-REGRESSION-001: user can complete full time-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'time_field', type: 'time', required: true, indexed: true },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (time_field) VALUES ('10:30:00')")
      const stored = await executeQuery('SELECT time_field FROM data WHERE id = 1')
      expect(stored.time_field).toBeTruthy()
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Created At Field
 *
 * Source: specs/app/tables/field-types/created-at-field/created-at-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Created At Field', () => {
  test.fixme(
    'APP-CREATED-AT-FIELD-001: should create PostgreSQL TIMESTAMPTZ column with DEFAULT NOW()',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_records',
            name: 'records',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='created_at'"
      )
      expect(columnInfo.data_type).toMatch(/timestamp/)
      expect(columnInfo.column_default).toMatch(/now/)
    }
  )

  test.fixme(
    'APP-CREATED-AT-FIELD-002: should automatically set timestamp when row is created',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_posts',
            name: 'posts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      const insert = await executeQuery(
        'INSERT INTO posts (id) VALUES (DEFAULT) RETURNING created_at'
      )
      expect(insert.created_at).toBeTruthy()
    }
  )

  test.fixme(
    'APP-CREATED-AT-FIELD-003: should be immutable after creation (no updates allowed)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_logs',
            name: 'logs',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      await executeQuery(['INSERT INTO logs (id) VALUES (1)'])

      // Update should not modify created_at (or should be prevented)
      await executeQuery(["UPDATE logs SET created_at = '2020-01-01 00:00:00+00' WHERE id = 1"])

      const result = await executeQuery('SELECT created_at FROM logs WHERE id = 1')
      // created_at should still be recent (not 2020)
      const createdDate = new Date(result.created_at)
      expect(createdDate.getFullYear()).toBeGreaterThan(2020)
    }
  )

  test.fixme(
    'APP-CREATED-AT-FIELD-004: should reject NULL values (always required)',
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
              { name: 'created_at', type: 'created-at' },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='created_at'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test.fixme(
    'APP-CREATED-AT-FIELD-005: should create btree index for fast queries when indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_audit',
            name: 'audit',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'created_at', type: 'created-at', indexed: true },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_created_at'"
      )
      expect(indexExists.indexname).toBe('idx_audit_created_at')
    }
  )

  test.fixme(
    'user can complete full created-at-field workflow',
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
              { name: 'created_at', type: 'created-at', indexed: true },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO data (id) VALUES (1), (2), (3)')

      const results = await executeQuery('SELECT created_at FROM data ORDER BY created_at')
      expect(results.length).toBe(3)
      expect(results[0].created_at).toBeTruthy()
    }
  )
})

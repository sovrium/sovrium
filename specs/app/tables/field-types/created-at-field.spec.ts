/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Created At Field
 *
 * Source: src/domain/models/app/table/field-types/created-at-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Created At Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-001: should create PostgreSQL TIMESTAMPTZ column with DEFAULT NOW()',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='created_at'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/timestamp/)
      // THEN: assertion
      expect(columnInfo.column_default).toMatch(/now/)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-002: should automatically set timestamp when row is created',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const insert = await executeQuery(
        'INSERT INTO posts (id) VALUES (DEFAULT) RETURNING created_at'
      )
      // THEN: assertion
      expect(insert.created_at).toBeTruthy()
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-003: should be immutable after creation (no updates allowed)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO logs (id) VALUES (1)'])

      // Update should not modify created_at (or should be prevented)
      await executeQuery(["UPDATE logs SET created_at = '2020-01-01 00:00:00+00' WHERE id = 1"])

      // WHEN: executing query
      const result = await executeQuery('SELECT created_at FROM logs WHERE id = 1')
      // created_at should still be recent (not 2020)
      const createdDate = new Date(result.created_at)
      // THEN: assertion
      expect(createdDate.getFullYear()).toBeGreaterThan(2020)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-004: should reject NULL values (always required)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='created_at'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-005: should create btree index for fast queries when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'audit',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_created_at'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_audit_created_at')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-006: user can complete full created-at-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'created_at', type: 'created-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery('INSERT INTO data (id) VALUES (1), (2), (3)')

      // WHEN: querying the database
      const results = await executeQuery('SELECT created_at FROM data ORDER BY created_at')
      // THEN: assertion
      expect(results.length).toBe(3)
      // THEN: assertion
      expect(results[0].created_at).toBeTruthy()
    }
  )
})

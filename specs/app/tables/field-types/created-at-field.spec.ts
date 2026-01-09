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
  test(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-001: should create PostgreSQL TIMESTAMP column with DEFAULT CURRENT_TIMESTAMP',
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
      // THEN: assertion (CURRENT_TIMESTAMP is equivalent to now() in PostgreSQL)
      expect(columnInfo.column_default).toMatch(/now|CURRENT_TIMESTAMP/i)
    }
  )

  test(
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

  test(
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

  test(
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

  test(
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

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-CREATED-AT-REGRESSION: user can complete full created-at-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with created-at fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'created_at', type: 'created-at' },
              { id: 2, name: 'created_at_indexed', type: 'created-at', indexed: true },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-CREATED-AT-001: Creates PostgreSQL TIMESTAMP column with DEFAULT CURRENT_TIMESTAMP', async () => {
        // WHEN: querying column info for created-at field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='data' AND column_name='created_at'"
        )
        // THEN: TIMESTAMP column with DEFAULT CURRENT_TIMESTAMP is created
        expect(columnInfo.data_type).toMatch(/timestamp/)
        expect(columnInfo.column_default).toMatch(/now|CURRENT_TIMESTAMP/i)
      })

      await test.step('APP-TABLES-FIELD-TYPES-CREATED-AT-002: Automatically sets timestamp when row is created', async () => {
        // WHEN: inserting a new row
        const insert = await executeQuery(
          'INSERT INTO data DEFAULT VALUES RETURNING created_at'
        )
        // THEN: created_at is automatically populated
        expect(insert.created_at).toBeTruthy()
      })

      await test.step('APP-TABLES-FIELD-TYPES-CREATED-AT-003: Remains immutable after creation', async () => {
        // WHEN: inserting a row and then attempting to update created_at
        const inserted = await executeQuery(
          'INSERT INTO data DEFAULT VALUES RETURNING id, created_at'
        )
        await executeQuery(
          `UPDATE data SET created_at = '2020-01-01 00:00:00+00' WHERE id = ${inserted.id}`
        )
        const result = await executeQuery(`SELECT created_at FROM data WHERE id = ${inserted.id}`)
        const createdDate = new Date(result.created_at)
        // THEN: created_at remains unchanged (year is still recent, not 2020)
        expect(createdDate.getFullYear()).toBeGreaterThan(2020)
      })

      await test.step('APP-TABLES-FIELD-TYPES-CREATED-AT-004: Rejects NULL values (always required)', async () => {
        // WHEN: checking NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='created_at'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')
      })

      await test.step('APP-TABLES-FIELD-TYPES-CREATED-AT-005: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed created-at field
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_data_created_at_indexed'"
        )
        // THEN: btree index exists
        expect(indexExists.indexname).toBe('idx_data_created_at_indexed')
      })
    }
  )
})

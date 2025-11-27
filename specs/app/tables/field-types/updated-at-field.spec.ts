/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Updated At Field
 *
 * Source: src/domain/models/app/table/field-types/updated-at-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Updated At Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-001: should create PostgreSQL TIMESTAMPTZ column with DEFAULT NOW()',
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
              { id: 2, name: 'updated_at', type: 'updated-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='updated_at'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/timestamp/)
      // THEN: assertion
      expect(columnInfo.column_default).toMatch(/now/)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-002: should automatically update timestamp when row is modified',
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
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'updated_at', type: 'updated-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const insert = await executeQuery(
        "INSERT INTO posts (title) VALUES ('Initial') RETURNING id, updated_at"
      )
      const initialTimestamp = insert.updated_at

      // Wait a moment and update
      await new Promise((resolve) => setTimeout(resolve, 100))
      await executeQuery(`UPDATE posts SET title = 'Updated' WHERE id = ${insert.id}`)

      const updated = await executeQuery(`SELECT updated_at FROM posts WHERE id = ${insert.id}`)
      // THEN: assertion
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(initialTimestamp).getTime()
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-003: should set initial timestamp on creation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'updated_at', type: 'updated-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const insert = await executeQuery(
        'INSERT INTO items (id) VALUES (DEFAULT) RETURNING updated_at'
      )
      // THEN: assertion
      expect(insert.updated_at).toBeTruthy()

      const created = new Date(insert.updated_at)
      // THEN: assertion
      expect(created.getFullYear()).toBeGreaterThan(2020)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-004: should reject NULL values (always required)',
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
              { id: 2, name: 'updated_at', type: 'updated-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='updated_at'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-005: should create btree index for fast queries when indexed=true',
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
              { id: 2, name: 'updated_at', type: 'updated-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_updated_at'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_audit_updated_at')
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-UPDATED-AT-006: user can complete full updated-at-field workflow',
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
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'updated_at', type: 'updated-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const insert = await executeQuery(
        "INSERT INTO data (value) VALUES ('v1') RETURNING id, updated_at"
      )
      const initial = insert.updated_at

      await new Promise((resolve) => setTimeout(resolve, 100))
      await executeQuery(`UPDATE data SET value = 'v2' WHERE id = ${insert.id}`)

      const final = await executeQuery(`SELECT updated_at FROM data WHERE id = ${insert.id}`)
      // THEN: assertion
      expect(new Date(final.updated_at).getTime()).toBeGreaterThan(new Date(initial).getTime())
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Updated At Field
 *
 * Source: specs/app/tables/field-types/updated-at-field/updated-at-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Updated At Field', () => {
  test.fixme(
    'APP-UPDATED-AT-FIELD-001: should create PostgreSQL TIMESTAMPTZ column with DEFAULT NOW()',
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
              { name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='updated_at'"
      )
      expect(columnInfo.data_type).toMatch(/timestamp/)
      expect(columnInfo.column_default).toMatch(/now/)
    }
  )

  test.fixme(
    'APP-UPDATED-AT-FIELD-002: should automatically update timestamp when row is modified',
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
              { name: 'title', type: 'text' },
              { name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })

      const insert = await executeQuery(
        "INSERT INTO posts (title) VALUES ('Initial') RETURNING id, updated_at"
      )
      const initialTimestamp = insert.updated_at

      // Wait a moment and update
      await new Promise((resolve) => setTimeout(resolve, 100))
      await executeQuery(`UPDATE posts SET title = 'Updated' WHERE id = ${insert.id}`)

      const updated = await executeQuery(`SELECT updated_at FROM posts WHERE id = ${insert.id}`)
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
        new Date(initialTimestamp).getTime()
      )
    }
  )

  test.fixme(
    'APP-UPDATED-AT-FIELD-003: should set initial timestamp on creation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })

      const insert = await executeQuery(
        'INSERT INTO items (id) VALUES (DEFAULT) RETURNING updated_at'
      )
      expect(insert.updated_at).toBeTruthy()

      const created = new Date(insert.updated_at)
      expect(created.getFullYear()).toBeGreaterThan(2020)
    }
  )

  test.fixme(
    'APP-UPDATED-AT-FIELD-004: should reject NULL values (always required)',
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
              { name: 'updated_at', type: 'updated-at' },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='updated_at'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')
    }
  )

  test.fixme(
    'APP-UPDATED-AT-FIELD-005: should create btree index for fast queries when indexed=true',
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
              { name: 'updated_at', type: 'updated-at', indexed: true },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_updated_at'"
      )
      expect(indexExists.indexname).toBe('idx_audit_updated_at')
    }
  )

  test.fixme(
    'user can complete full updated-at-field workflow',
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
              { name: 'value', type: 'text' },
              { name: 'updated_at', type: 'updated-at', indexed: true },
            ],
          },
        ],
      })

      const insert = await executeQuery(
        "INSERT INTO data (value) VALUES ('v1') RETURNING id, updated_at"
      )
      const initial = insert.updated_at

      await new Promise((resolve) => setTimeout(resolve, 100))
      await executeQuery(`UPDATE data SET value = 'v2' WHERE id = ${insert.id}`)

      const final = await executeQuery(`SELECT updated_at FROM data WHERE id = ${insert.id}`)
      expect(new Date(final.updated_at).getTime()).toBeGreaterThan(new Date(initial).getTime())
    }
  )
})

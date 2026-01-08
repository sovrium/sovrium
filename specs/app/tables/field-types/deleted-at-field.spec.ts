/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Deleted At Field
 *
 * Source: src/domain/models/app/table/field-types/deleted-at-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Deleted At Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-001: should create PostgreSQL TIMESTAMP column with NULL default',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'records',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database column info
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='deleted_at'"
      )

      // THEN: column should be TIMESTAMP type
      expect(columnInfo.data_type).toMatch(/timestamp/)
      // THEN: column default should be NULL (no default set, unlike created_at)
      expect(columnInfo.column_default).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-002: should allow NULL values (nullable by design)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the column nullable info
      const nullableCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='deleted_at'"
      )

      // THEN: column should be nullable (YES) - NULL means record is active
      expect(nullableCheck.is_nullable).toBe('YES')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-003: should allow setting timestamp for soft delete',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: a record exists without deleted_at
      await executeQuery('INSERT INTO tasks (id) VALUES (1)')

      // WHEN: soft deleting the record by setting deleted_at
      await executeQuery('UPDATE tasks SET deleted_at = NOW() WHERE id = 1')

      // THEN: deleted_at should be set to current timestamp
      const result = await executeQuery('SELECT deleted_at FROM tasks WHERE id = 1')
      expect(result.deleted_at).toBeTruthy()
      const deletedDate = new Date(result.deleted_at)
      expect(deletedDate.getFullYear()).toBeGreaterThanOrEqual(2025)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-004: should allow clearing timestamp for restore',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: a soft-deleted record exists
      await executeQuery('INSERT INTO items (id, deleted_at) VALUES (1, NOW())')

      // Verify record is soft-deleted
      const beforeRestore = await executeQuery('SELECT deleted_at FROM items WHERE id = 1')
      expect(beforeRestore.deleted_at).toBeTruthy()

      // WHEN: restoring the record by clearing deleted_at
      await executeQuery('UPDATE items SET deleted_at = NULL WHERE id = 1')

      // THEN: deleted_at should be NULL (record is active again)
      const afterRestore = await executeQuery('SELECT deleted_at FROM items WHERE id = 1')
      expect(afterRestore.deleted_at).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-005: should create btree index for fast queries when indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with indexed deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'audit',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying for the index
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_deleted_at'"
      )

      // THEN: btree index should exist for fast soft-delete filtering
      expect(indexExists.indexname).toBe('idx_audit_deleted_at')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-DELETED-AT-REGRESSION: user can complete full deleted-at-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-FIELD-TYPES-DELETED-AT-001: Create PostgreSQL TIMESTAMP column with NULL default', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'records',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'deleted_at', type: 'deleted-at' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='records' AND column_name='deleted_at'"
        )
        expect(columnInfo.data_type).toMatch(/timestamp/)
        expect(columnInfo.column_default).toBeNull()
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-AT-002: Allow NULL values (nullable by design)', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'posts',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'deleted_at', type: 'deleted-at' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const nullableCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='deleted_at'"
        )
        expect(nullableCheck.is_nullable).toBe('YES')
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-AT-003: Allow setting timestamp for soft delete', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'deleted_at', type: 'deleted-at' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        await executeQuery('INSERT INTO tasks (id) VALUES (1)')
        await executeQuery('UPDATE tasks SET deleted_at = NOW() WHERE id = 1')
        const result = await executeQuery('SELECT deleted_at FROM tasks WHERE id = 1')
        expect(result.deleted_at).toBeTruthy()
        const deletedDate = new Date(result.deleted_at)
        expect(deletedDate.getFullYear()).toBeGreaterThanOrEqual(2025)
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-AT-004: Allow clearing timestamp for restore', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'deleted_at', type: 'deleted-at' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        await executeQuery('INSERT INTO items (id, deleted_at) VALUES (1, NOW())')
        const beforeRestore = await executeQuery('SELECT deleted_at FROM items WHERE id = 1')
        expect(beforeRestore.deleted_at).toBeTruthy()
        await executeQuery('UPDATE items SET deleted_at = NULL WHERE id = 1')
        const afterRestore = await executeQuery('SELECT deleted_at FROM items WHERE id = 1')
        expect(afterRestore.deleted_at).toBeNull()
      })

      await test.step('APP-TABLES-FIELD-TYPES-DELETED-AT-005: Create btree index when indexed=true', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'audit',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_audit_deleted_at'"
        )
        expect(indexExists.indexname).toBe('idx_audit_deleted_at')
      })
    }
  )
})

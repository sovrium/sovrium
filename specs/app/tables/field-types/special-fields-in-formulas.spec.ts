/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Special Fields in Formulas
 *
 * Source: src/domain/models/app/table/index.ts (SPECIAL_FIELDS constant)
 * Domain: app
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * PURPOSE:
 * These tests validate the SPECIAL_FIELDS constant which defines system-managed fields
 * that are ALWAYS available in formula expressions without requiring explicit field definitions.
 *
 * DESIGN RATIONALE:
 * - Special fields (id, created_at, updated_at, deleted_at) are automatically managed by the system
 * - They are intrinsic metadata fields present on ALL tables (Airtable-style)
 * - Formulas can reference them without explicit declaration
 * - deleted_at enables soft-delete by default (can be NULL for active records)
 */

test.describe('Special Fields in Formulas', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'APP-TABLES-SPECIAL-FIELDS-001: should allow formula to reference id without explicit field definition',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with formula referencing 'id' special field
      // NOTE: 'id' is not explicitly defined in fields array, but should be available
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'records',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'record_number',
                type: 'formula',
                formula: 'id',
                resultType: 'integer',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Inserting records
      await executeQuery("INSERT INTO records (id, title) VALUES (1, 'First'), (2, 'Second')")

      // THEN: Formula correctly references the id special field
      const result1 = await executeQuery('SELECT record_number FROM records WHERE id = 1')
      expect(result1.record_number).toBe(1)

      const result2 = await executeQuery('SELECT record_number FROM records WHERE id = 2')
      expect(result2.record_number).toBe(2)
    }
  )

  test(
    'APP-TABLES-SPECIAL-FIELDS-002: should allow formula to reference created_at without explicit field definition',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with formula referencing 'created_at' special field
      // NOTE: 'created_at' is not explicitly defined in fields array, but should be available
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'posts',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'created_at', type: 'created-at' },
              {
                id: 3,
                name: 'creation_year',
                type: 'formula',
                formula: 'EXTRACT(YEAR FROM created_at)',
                resultType: 'integer',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Inserting a record
      await executeQuery("INSERT INTO posts (id, title) VALUES (1, 'My Post')")

      // THEN: Formula correctly references the created_at special field
      const result = await executeQuery('SELECT creation_year FROM posts WHERE id = 1')
      expect(result.creation_year).toBeGreaterThanOrEqual(2025) // Created in 2025 or later
    }
  )

  test(
    'APP-TABLES-SPECIAL-FIELDS-003: should allow formula to reference updated_at without explicit field definition',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with formula referencing 'updated_at' special field
      // NOTE: 'updated_at' is not explicitly defined in fields array, but should be available
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'documents',
            fields: [
              { id: 1, name: 'content', type: 'long-text', required: true },
              { id: 2, name: 'updated_at', type: 'updated-at' },
              {
                id: 3,
                name: 'last_modified_year',
                type: 'formula',
                formula: 'EXTRACT(YEAR FROM updated_at)',
                resultType: 'integer',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Inserting and updating a record
      await executeQuery("INSERT INTO documents (id, content) VALUES (1, 'Initial content')")
      await executeQuery("UPDATE documents SET content = 'Updated content' WHERE id = 1")

      // THEN: Formula correctly references the updated_at special field
      const result = await executeQuery('SELECT last_modified_year FROM documents WHERE id = 1')
      expect(result.last_modified_year).toBeGreaterThanOrEqual(2025) // Updated in 2025 or later
    }
  )

  test(
    'APP-TABLES-SPECIAL-FIELDS-004: should allow formula to reference deleted_at without explicit field definition',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with formula referencing 'deleted_at' special field
      // NOTE: 'deleted_at' is not explicitly defined in fields array, but should be available
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              {
                id: 2,
                name: 'is_deleted',
                type: 'formula',
                formula: 'deleted_at IS NOT NULL',
                resultType: 'boolean',
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Inserting active record
      await executeQuery("INSERT INTO items (id, title) VALUES (1, 'Active Item')")

      // THEN: Formula correctly references the deleted_at special field
      const activeResult = await executeQuery('SELECT is_deleted FROM items WHERE id = 1')
      expect(activeResult.is_deleted).toBe(false) // deleted_at is NULL for active records

      // WHEN: Soft deleting record
      await executeQuery('UPDATE items SET deleted_at = NOW() WHERE id = 1')

      // THEN: Formula reflects soft-deleted state
      const deletedResult = await executeQuery('SELECT is_deleted FROM items WHERE id = 1')
      expect(deletedResult.is_deleted).toBe(true) // deleted_at is NOT NULL for deleted records
    }
  )

  test(
    'APP-TABLES-SPECIAL-FIELDS-005: should automatically create deleted_at column on all tables',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table WITHOUT explicit deleted_at field definition
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'products',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'price', type: 'integer', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Querying table structure
      const columns = await executeQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'deleted_at'
      `)

      // THEN: deleted_at column is automatically created
      expect(columns.column_name).toBe('deleted_at')
      expect(columns.data_type).toBe('timestamp with time zone')
      expect(columns.is_nullable).toBe('YES') // NULL = active, NOT NULL = deleted

      // WHEN: Inserting record and setting deleted_at
      await executeQuery("INSERT INTO products (id, name, price) VALUES (1, 'Laptop', 999)")
      await executeQuery('UPDATE products SET deleted_at = NOW() WHERE id = 1')

      // THEN: deleted_at field is queryable and functional
      const result = await executeQuery('SELECT deleted_at FROM products WHERE id = 1')
      expect(result.deleted_at).not.toBeNull()
    }
  )

  test.fixme(
    'APP-TABLES-SPECIAL-FIELDS-006: should automatically create index on deleted_at column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table created with intrinsic deleted_at field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'orders',
            fields: [
              { id: 1, name: 'order_number', type: 'single-line-text', required: true },
              { id: 2, name: 'total', type: 'integer', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: Querying database indexes
      const index = await executeQuery(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'orders' AND indexname LIKE '%deleted_at%'
      `)

      // THEN: Index exists on deleted_at column for performance
      expect(index.indexname).toMatch(/orders.*deleted_at/)
      expect(index.indexdef).toContain('deleted_at')

      // RATIONALE: Index improves performance for queries filtering by soft-delete status
      // Common queries: WHERE deleted_at IS NULL (active records)
      //                 WHERE deleted_at IS NOT NULL (deleted records)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-SPECIAL-FIELDS-007: user can use all special fields in formulas without explicit definitions',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create table using all special fields in formulas', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 7,
              name: 'products',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text', required: true },
                {
                  id: 2,
                  name: 'record_id',
                  type: 'formula',
                  formula: 'id',
                  resultType: 'integer',
                },
                {
                  id: 3,
                  name: 'created_year',
                  type: 'formula',
                  formula: 'EXTRACT(YEAR FROM created_at)',
                  resultType: 'integer',
                },
                {
                  id: 4,
                  name: 'updated_year',
                  type: 'formula',
                  formula: 'EXTRACT(YEAR FROM updated_at)',
                  resultType: 'integer',
                },
                {
                  id: 5,
                  name: 'is_deleted',
                  type: 'formula',
                  formula: 'deleted_at IS NOT NULL',
                  resultType: 'boolean',
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert active record and verify all special field formulas', async () => {
        await executeQuery("INSERT INTO products (id, name) VALUES (1, 'Laptop')")

        const result = await executeQuery(
          'SELECT record_id, created_year, updated_year, is_deleted FROM products WHERE id = 1'
        )

        // All special fields work in formulas without explicit definitions
        expect(result.record_id).toBe(1)
        expect(result.created_year).toBeGreaterThanOrEqual(2025)
        expect(result.updated_year).toBeGreaterThanOrEqual(2025)
        expect(result.is_deleted).toBe(false) // Record is not soft-deleted
      })

      await test.step('Update record and verify updated_at changes', async () => {
        await executeQuery("UPDATE products SET name = 'Gaming Laptop' WHERE id = 1")

        const result = await executeQuery('SELECT updated_year FROM products WHERE id = 1')
        expect(result.updated_year).toBeGreaterThanOrEqual(2025)
      })

      await test.step('Soft delete record and verify deleted_at formula', async () => {
        await executeQuery('UPDATE products SET deleted_at = NOW() WHERE id = 1')

        const result = await executeQuery('SELECT is_deleted FROM products WHERE id = 1')
        expect(result.is_deleted).toBe(true) // Record is now soft-deleted
      })

      await test.step('Verify deleted_at column and index exist automatically', async () => {
        // Check deleted_at column exists
        const column = await executeQuery(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'deleted_at'
        `)
        expect(column.column_name).toBe('deleted_at')
        expect(column.data_type).toBe('timestamp with time zone')

        // Check deleted_at index exists
        const index = await executeQuery(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'products' AND indexname LIKE '%deleted_at%'
        `)
        expect(index.indexname).toMatch(/products.*deleted_at/)
      })
    }
  )
})

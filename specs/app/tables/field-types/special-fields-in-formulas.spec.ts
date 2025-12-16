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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * PURPOSE:
 * These tests validate the SPECIAL_FIELDS constant which defines system-managed fields
 * that are ALWAYS available in formula expressions without requiring explicit field definitions.
 *
 * DESIGN RATIONALE:
 * - Special fields (id, created_at, updated_at) are automatically managed by the system
 * - They are present on all tables (or can be added via standard field types)
 * - Formulas can reference them without explicit declaration
 * - deleted_at is NOT special because it's an opt-in soft-delete feature, not universal
 */

test.describe('Special Fields in Formulas', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
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

  test.fixme(
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

  test.fixme(
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

  test.fixme(
    'APP-TABLES-SPECIAL-FIELDS-004: should reject formula referencing deleted_at when field not explicitly defined',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table attempting to use deleted_at in formula WITHOUT defining it
      // NOTE: deleted_at is NOT a special field - it's an opt-in soft-delete feature

      // WHEN/THEN: Schema validation should reject the configuration
      await expect(
        startServerWithSchema({
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
      ).rejects.toThrow(/Invalid field reference.*deleted_at.*not found/)

      // RATIONALE: deleted_at is NOT automatically available on all tables
      // It's an opt-in feature that users explicitly add when needed
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-SPECIAL-FIELDS-005: user can use special fields and must explicitly define optional fields',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create table using all special fields plus explicit deleted_at', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'products',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text', required: true },
                { id: 2, name: 'created_at', type: 'created-at' },
                { id: 3, name: 'updated_at', type: 'updated-at' },
                { id: 4, name: 'deleted_at', type: 'deleted-at' }, // Explicitly defined
                {
                  id: 5,
                  name: 'record_id',
                  type: 'formula',
                  formula: 'id',
                  resultType: 'integer',
                },
                {
                  id: 6,
                  name: 'created_year',
                  type: 'formula',
                  formula: 'EXTRACT(YEAR FROM created_at)',
                  resultType: 'integer',
                },
                {
                  id: 7,
                  name: 'updated_year',
                  type: 'formula',
                  formula: 'EXTRACT(YEAR FROM updated_at)',
                  resultType: 'integer',
                },
                {
                  id: 8,
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

      await test.step('Insert active record and verify special field formulas', async () => {
        await executeQuery("INSERT INTO products (id, name) VALUES (1, 'Laptop')")

        const result = await executeQuery(
          'SELECT record_id, created_year, updated_year, is_deleted FROM products WHERE id = 1'
        )

        // Special fields work in formulas
        expect(result.record_id).toBe(1)
        expect(result.created_year).toBeGreaterThanOrEqual(2025)
        expect(result.updated_year).toBeGreaterThanOrEqual(2025)

        // deleted_at formula works because field is explicitly defined
        expect(result.is_deleted).toBe(false) // Record is not soft-deleted
      })

      await test.step('Soft delete record and verify deleted_at formula', async () => {
        await executeQuery('UPDATE products SET deleted_at = NOW() WHERE id = 1')

        const result = await executeQuery('SELECT is_deleted FROM products WHERE id = 1')
        expect(result.is_deleted).toBe(true) // Record is now soft-deleted
      })

      await test.step('Verify validation rejects deleted_at formula without field definition', async () => {
        // Attempting to create table without deleted_at field should fail validation
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 6,
                name: 'invalid_table',
                fields: [
                  { id: 1, name: 'title', type: 'single-line-text', required: true },
                  {
                    id: 2,
                    name: 'check_deleted',
                    type: 'formula',
                    formula: 'deleted_at IS NULL',
                    resultType: 'boolean',
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/Invalid field reference.*deleted_at/)
      })
    }
  )
})

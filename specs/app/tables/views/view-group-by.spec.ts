/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for View Group By
 *
 * Source: src/domain/models/app/table/views/index.ts
 * Domain: app
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Group By', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-GROUP-BY-001: should organize records into groups by status values when a view is grouped by status field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view grouped by status field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'by_status',
                name: 'By Status',
                groupBy: {
                  field: 'status',
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (title, status) VALUES ('Task 1', 'active'), ('Task 2', 'completed'), ('Task 3', 'active')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records should be ordered by the groupBy field (status)

      // View exists in database
      const viewExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'by_status'"
      )
      expect(viewExists.count).toBe(1)

      // Records are ordered by groupBy field (grouping puts same values together)
      const viewRecords = await executeQuery('SELECT title, status FROM by_status')
      // Records with same status should be adjacent (grouped)
      expect(viewRecords.rows).toHaveLength(3)

      // Count records per status group
      const activeCount = await executeQuery(
        "SELECT COUNT(*) as count FROM by_status WHERE status = 'active'"
      )
      expect(activeCount.count).toBe(2)

      const completedCount = await executeQuery(
        "SELECT COUNT(*) as count FROM by_status WHERE status = 'completed'"
      )
      expect(completedCount.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-VIEW-GROUP-BY-002: should order groups alphabetically/numerically from lowest to highest when a view is grouped by field with ascending direction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view grouped by field with ascending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'priority', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'by_priority_asc',
                name: 'By Priority (Asc)',
                groupBy: {
                  field: 'priority',
                  direction: 'asc',
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO items (name, priority) VALUES ('Item 1', 3), ('Item 2', 1), ('Item 3', 2)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records should be ordered by groupBy field ascending (1, 2, 3)

      // View returns records ordered by priority ascending
      const viewRecords = await executeQuery('SELECT name, priority FROM by_priority_asc')
      expect(viewRecords.rows).toEqual([
        { name: 'Item 2', priority: 1 },
        { name: 'Item 3', priority: 2 },
        { name: 'Item 1', priority: 3 },
      ])
    }
  )

  test(
    'APP-TABLES-VIEW-GROUP-BY-003: should order groups from highest to lowest when a view is grouped by field with descending direction',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view grouped by field with descending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'rating', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'by_rating_desc',
                name: 'By Rating (Desc)',
                groupBy: {
                  field: 'rating',
                  direction: 'desc',
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, rating) VALUES ('Product 1', 3), ('Product 2', 5), ('Product 3', 4)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records should be ordered by groupBy field descending (5, 4, 3)

      // View returns records ordered by rating descending
      const viewRecords = await executeQuery('SELECT name, rating FROM by_rating_desc')
      expect(viewRecords.rows).toEqual([
        { name: 'Product 2', rating: 5 },
        { name: 'Product 3', rating: 4 },
        { name: 'Product 1', rating: 3 },
      ])
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (004)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-GROUP-BY-004: should reject groupBy referencing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: View groupBy referencing non-existent field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
              ],
              views: [
                {
                  id: 'grouped_view',
                  name: 'Grouped View',
                  groupBy: {
                    field: 'category', // 'category' doesn't exist!
                    direction: 'asc',
                  },
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/field.*category.*not found|groupBy.*references.*non-existent.*field/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-GROUP-BY-005: user can complete full view-group-by workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with grouped view', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'category', type: 'single-line-text' },
                { id: 3, name: 'value', type: 'integer' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'grouped_view',
                  name: 'Grouped View',
                  groupBy: {
                    field: 'category',
                    direction: 'asc',
                  },
                },
              ],
            },
          ],
        })
      })

      await test.step('Insert test data', async () => {
        await executeQuery([
          "INSERT INTO data (category, value) VALUES ('A', 1), ('B', 2), ('A', 3)",
        ])
      })

      await test.step('Verify view exists in database', async () => {
        const viewExists = await executeQuery(
          "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'grouped_view'"
        )
        expect(viewExists.count).toBe(1)
      })

      await test.step('Verify view returns records ordered by category', async () => {
        const viewRecords = await executeQuery('SELECT category, value FROM grouped_view')
        expect(viewRecords.rows).toEqual([
          { category: 'A', value: 1 },
          { category: 'A', value: 3 },
          { category: 'B', value: 2 },
        ])
      })

      await test.step('Verify category grouping (A has 2 records, B has 1)', async () => {
        const categoryACounts = await executeQuery(
          "SELECT COUNT(*) as count FROM grouped_view WHERE category = 'A'"
        )
        expect(categoryACounts.count).toBe(2)

        const categoryBCounts = await executeQuery(
          "SELECT COUNT(*) as count FROM grouped_view WHERE category = 'B'"
        )
        expect(categoryBCounts.count).toBe(1)
      })

      await test.step('Error handling: groupBy references non-existent field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
                views: [
                  {
                    id: 'bad_view',
                    name: 'Bad View',
                    groupBy: { field: 'category', direction: 'asc' },
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/field.*category.*not found|groupBy.*references.*non-existent.*field/i)
      })
    }
  )
})

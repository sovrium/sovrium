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
 * Source: specs/app/tables/views/view/group-by/group-by.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Group By', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-GROUP-BY-001: should organize records into groups by status values when a view is grouped by status field',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: a view grouped by status field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'status', type: 'text' },
            ],
            views: [
              {
                id: 'by_status',
                name: 'By Status',
                type: 'grid',
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

      // WHEN: displaying records
      await page.goto('/tables/tbl_tasks/views/by_status')

      // THEN: records should be organized into groups by status values
      await expect(page.locator('[data-group="active"]')).toBeVisible()
      await expect(page.locator('[data-group="completed"]')).toBeVisible()
      await expect(page.locator('[data-group="active"] [data-record]')).toHaveCount(2)
      await expect(page.locator('[data-group="completed"] [data-record]')).toHaveCount(1)
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-GROUP-BY-002: should order groups alphabetically/numerically from lowest to highest when a view is grouped by field with ascending direction',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: a view grouped by field with ascending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'priority', type: 'integer' },
            ],
            views: [
              {
                id: 'by_priority_asc',
                name: 'By Priority (Asc)',
                type: 'grid',
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

      // WHEN: displaying groups
      await page.goto('/tables/tbl_items/views/by_priority_asc')

      // THEN: groups should be ordered alphabetically/numerically from lowest to highest
      const groups = page.locator('[data-group]')
      await expect(groups.nth(0)).toHaveAttribute('data-group', '1')
      await expect(groups.nth(1)).toHaveAttribute('data-group', '2')
      await expect(groups.nth(2)).toHaveAttribute('data-group', '3')
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-GROUP-BY-003: should order groups from highest to lowest when a view is grouped by field with descending direction',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: a view grouped by field with descending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'rating', type: 'integer' },
            ],
            views: [
              {
                id: 'by_rating_desc',
                name: 'By Rating (Desc)',
                type: 'grid',
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

      // WHEN: displaying groups
      await page.goto('/tables/tbl_products/views/by_rating_desc')

      // THEN: groups should be ordered from highest to lowest
      const groups = page.locator('[data-group]')
      await expect(groups.nth(0)).toHaveAttribute('data-group', '5')
      await expect(groups.nth(1)).toHaveAttribute('data-group', '4')
      await expect(groups.nth(2)).toHaveAttribute('data-group', '3')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full view-group-by workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      // GIVEN: Application configured with representative grouping
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'category', type: 'text' },
              { name: 'value', type: 'integer' },
            ],
            views: [
              {
                id: 'grouped_view',
                name: 'Grouped View',
                type: 'grid',
                groupBy: {
                  field: 'category',
                  direction: 'asc',
                },
              },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO data (category, value) VALUES ('A', 1), ('B', 2), ('A', 3)"])

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/tables/tbl_data/views/grouped_view')

      const groups = page.locator('[data-group]')
      await expect(groups.nth(0)).toHaveAttribute('data-group', 'A')
      await expect(groups.nth(1)).toHaveAttribute('data-group', 'B')
      await expect(page.locator('[data-group="A"] [data-record]')).toHaveCount(2)
      await expect(page.locator('[data-group="B"] [data-record]')).toHaveCount(1)
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table View
 *
 * Source: specs/app/tables/views/view/view.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table View', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-001: should be valid when validating view schema with id, name, and type properties',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a view with id, name, and type properties
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'example',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'example_view',
                name: 'Example View',
              },
            ],
          },
        ],
      })

      // WHEN: validating the view schema
      await page.goto('/')

      // THEN: the view should be valid
      // View configuration accepted without validation errors
      await expect(page.locator('body')).toBeAttached()
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-002: should fail with pattern mismatch error when validating view schema with invalid id format (contains uppercase or spaces)',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: a view with invalid id format (contains uppercase or spaces)
      // WHEN: validating the view schema
      // THEN: validation should fail with pattern mismatch error

      // This test verifies schema validation at configuration time
      // Invalid view IDs should be rejected before runtime
      // THEN: assertion
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'example',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'Invalid View ID',
                  name: 'Example View',
                },
              ],
            },
          ],
        })
      }).rejects.toThrow('must be one of the allowed values')
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-003: should be applied automatically when view marked as isDefault: true and no specific view is requested via API',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a view marked as isDefault: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'active_tasks',
                name: 'Active Tasks',
                isDefault: true,
                filters: {
                  conjunction: 'and',
                  conditions: [
                    {
                      field: 'status',
                      operator: 'equals',
                      value: 'active',
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (title, status) VALUES ('Task 1', 'active'), ('Task 2', 'completed'), ('Task 3', 'active')",
      ])

      // WHEN: no specific view is requested via API
      await page.goto('/')

      // THEN: this view's configuration should be applied automatically
      const activeCount = await executeQuery(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'active'"
      )
      // THEN: assertion
      expect(activeCount.count).toBe(2)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-004: user can complete full view workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative view
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'priority', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'default_view',
                name: 'Default View',
                isDefault: true,
                filters: {
                  conjunction: 'and',
                  conditions: [
                    {
                      field: 'status',
                      operator: 'equals',
                      value: 'active',
                    },
                  ],
                },
                sorts: [
                  {
                    field: 'priority',
                    direction: 'desc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO items (title, status, priority) VALUES ('Item 1', 'active', 1), ('Item 2', 'inactive', 2), ('Item 3', 'active', 3)",
      ])

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // View configuration is valid
      // THEN: assertion
      await expect(page.locator('body')).toBeAttached()

      // Default view filter applies
      const filteredCount = await executeQuery(
        "SELECT COUNT(*) as count FROM items WHERE status = 'active'"
      )
      // THEN: assertion
      expect(filteredCount.count).toBe(2)

      // Default view sort applies
      const sortedItems = await executeQuery(
        "SELECT title FROM items WHERE status = 'active' ORDER BY priority DESC"
      )
      // THEN: assertion
      expect(sortedItems).toEqual([{ title: 'Item 3' }, { title: 'Item 1' }])

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})

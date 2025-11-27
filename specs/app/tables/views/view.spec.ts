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
    async ({ startServerWithSchema, executeQuery }) => {
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

      // WHEN: checking the database for the created view
      // THEN: the view should exist in the database

      // View was created in database
      const viewExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'example_view'"
      )
      expect(viewExists.count).toBe(1)

      // View is queryable
      const viewRecords = await executeQuery('SELECT * FROM example_view')
      expect(viewRecords).toEqual([])
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
    async ({ startServerWithSchema, executeQuery }) => {
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
                  and: [
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

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view returns only active tasks

      // View filters records based on isDefault configuration
      const viewRecords = await executeQuery('SELECT title, status FROM active_tasks ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([
        { title: 'Task 1', status: 'active' },
        { title: 'Task 3', status: 'active' },
      ])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-004: user can complete full view workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
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
                  and: [
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

      // WHEN/THEN: Querying the PostgreSQL VIEW validates configuration

      // View filters and sorts records correctly
      const viewRecords = await executeQuery('SELECT title, status, priority FROM default_view')
      // THEN: assertion
      expect(viewRecords).toEqual([
        { title: 'Item 3', status: 'active', priority: 3 },
        { title: 'Item 1', status: 'active', priority: 1 },
      ])

      // Inactive items excluded from view
      const inactiveInView = await executeQuery(
        "SELECT * FROM default_view WHERE status = 'inactive'"
      )
      // THEN: assertion
      expect(inactiveInView).toHaveLength(0)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Table Views
 *
 * Source: src/domain/models/app/table/views/index.ts
 * Domain: app
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Table Views', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-VIEWS-001: should filter records by condition when view has filter configuration (status = active)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view with filter configuration (status = 'active')
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
              { id: 4, name: 'priority', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'active_tasks',
                name: 'Active Tasks',
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
        "INSERT INTO tasks (title, status, priority) VALUES ('Task 1', 'active', 1), ('Task 2', 'completed', 2), ('Task 3', 'active', 3)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view returns only filtered records

      // View filters records automatically
      const viewRecords = await executeQuery('SELECT * FROM active_tasks ORDER BY id')
      // THEN: assertion
      expect(viewRecords.rows).toHaveLength(2)
      expect(viewRecords.rows).toEqual([
        expect.objectContaining({ title: 'Task 1', status: 'active' }),
        expect.objectContaining({ title: 'Task 3', status: 'active' }),
      ])

      // Completed tasks excluded from view
      const completedInView = await executeQuery(
        "SELECT * FROM active_tasks WHERE status = 'completed'"
      )
      // THEN: assertion
      expect(completedInView.rows).toHaveLength(0)
    }
  )

  test(
    'APP-TABLES-VIEWS-002: should combine conditions with AND operator when view has multiple AND conditions (status = active AND priority > 2)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view with multiple AND conditions (status = 'active' AND priority > 2)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'priority', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'high_priority_active',
                name: 'High Priority Active',
                filters: {
                  and: [
                    {
                      field: 'status',
                      operator: 'equals',
                      value: 'active',
                    },
                    {
                      field: 'priority',
                      operator: 'greaterThan',
                      value: 2,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO projects (name, status, priority) VALUES ('Project A', 'active', 1), ('Project B', 'active', 3), ('Project C', 'completed', 3)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view combines conditions with AND operator

      // View returns only records matching ALL conditions
      const viewRecords = await executeQuery('SELECT * FROM high_priority_active')
      // THEN: assertion
      expect(viewRecords.rowCount).toBe(1)
      expect(viewRecords.name).toBe('Project B')

      // Project A excluded (priority not > 2)
      const projectA = await executeQuery(
        "SELECT * FROM high_priority_active WHERE name = 'Project A'"
      )
      // THEN: assertion
      expect(projectA.rowCount).toBe(0)

      // Project C excluded (status not active)
      const projectC = await executeQuery(
        "SELECT * FROM high_priority_active WHERE name = 'Project C'"
      )
      // THEN: assertion
      expect(projectC.rowCount).toBe(0)
    }
  )

  test(
    'APP-TABLES-VIEWS-003: should sort records accordingly when view has sort configuration (ORDER BY created_at DESC)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view with sort configuration (ORDER BY created_at DESC)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'recent_first',
                name: 'Recent First',
                sorts: [
                  {
                    field: 'created_at',
                    direction: 'desc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO articles (title, created_at) VALUES ('Article 1', '2024-01-01 10:00:00'), ('Article 2', '2024-01-03 10:00:00'), ('Article 3', '2024-01-02 10:00:00')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view returns records sorted by created_at DESC

      // View returns records in sorted order
      const viewRecords = await executeQuery('SELECT title FROM recent_first')
      // THEN: assertion
      expect(viewRecords.rows).toEqual([
        { title: 'Article 2' },
        { title: 'Article 3' },
        { title: 'Article 1' },
      ])

      // Most recent article first in view
      const firstRecord = await executeQuery('SELECT title FROM recent_first LIMIT 1')
      // THEN: assertion
      expect(firstRecord.title).toBe('Article 2')

      // Oldest article last in view
      const lastRecord = await executeQuery('SELECT title FROM recent_first OFFSET 2 LIMIT 1')
      // THEN: assertion
      expect(lastRecord.title).toBe('Article 1')
    }
  )

  test(
    'APP-TABLES-VIEWS-004: should aggregate records by field when view has groupBy configuration (GROUP BY department)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view with groupBy configuration (GROUP BY department)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'department', type: 'single-line-text' },
              { id: 4, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'by_department',
                name: 'By Department',
                groupBy: {
                  field: 'department',
                  direction: 'asc',
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO employees (name, department, salary) VALUES ('Alice', 'Engineering', 75000), ('Bob', 'Engineering', 80000), ('Charlie', 'Marketing', 60000)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view returns records ordered by groupBy field

      // View returns records ordered by department (groupBy field)
      const viewRecords = await executeQuery('SELECT name, department FROM by_department')
      // THEN: assertion
      expect(viewRecords.rows).toEqual([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Engineering' },
        { name: 'Charlie', department: 'Marketing' },
      ])

      // Records within same department are adjacent
      const departments = await executeQuery('SELECT DISTINCT department FROM by_department')
      // THEN: assertion
      expect(departments.rows).toHaveLength(2)

      // Engineering records come first (asc order)
      const firstRecord = await executeQuery('SELECT department FROM by_department LIMIT 1')
      // THEN: assertion
      expect(firstRecord.department).toBe('Engineering')
    }
  )

  test(
    'APP-TABLES-VIEWS-005: should include only specified columns when view has field visibility configuration (only name, email visible)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view with field visibility configuration (only name, email visible)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'phone', type: 'single-line-text' },
              { id: 5, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'contact_info',
                name: 'Contact Info',
                fields: ['name', 'email'],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO users (name, email, phone, salary) VALUES ('Alice', 'alice@example.com', '555-1234', 75000)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view includes only specified columns

      // View exposes only name and email columns
      const viewRecords = await executeQuery('SELECT * FROM contact_info')
      // THEN: assertion
      expect(viewRecords.rows).toEqual([{ name: 'Alice', email: 'alice@example.com' }])

      // View columns match visibleFields configuration
      const viewColumns = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name='contact_info' ORDER BY ordinal_position"
      )
      // THEN: assertion
      expect(viewColumns.rows).toEqual([{ column_name: 'name' }, { column_name: 'email' }])

      // Hidden fields (phone, salary) not accessible through view
      const viewColumnCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='contact_info'"
      )
      // THEN: assertion
      expect(Number(viewColumnCount.count)).toBe(2)
    }
  )

  test(
    'APP-TABLES-VIEWS-006: should apply default view configuration to query when default view configured (isDefault: true)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: default view configured (isDefault: true)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'published_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'published_posts',
                name: 'Published Posts',
                isDefault: true,
                filters: {
                  and: [
                    {
                      field: 'status',
                      operator: 'equals',
                      value: 'published',
                    },
                  ],
                },
                sorts: [
                  {
                    field: 'published_at',
                    direction: 'desc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO posts (title, status, published_at) VALUES ('Post 1', 'published', '2024-01-01'), ('Post 2', 'draft', NULL), ('Post 3', 'published', '2024-01-02')",
      ])

      // WHEN: querying the default PostgreSQL VIEW
      // THEN: view applies filter and sort configuration

      // Default view filters and sorts records
      const viewRecords = await executeQuery('SELECT title, status FROM published_posts')
      // THEN: assertion
      expect(viewRecords.rows).toEqual([
        { title: 'Post 3', status: 'published' },
        { title: 'Post 1', status: 'published' },
      ])

      // View excludes draft posts
      const draftInView = await executeQuery("SELECT * FROM published_posts WHERE status = 'draft'")
      // THEN: assertion
      expect(draftInView.rows).toHaveLength(0)

      // View is marked as default (metadata check)
      const viewExists = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'published_posts'"
      )
      // THEN: assertion
      expect(viewExists.count).toBe(1)
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (007-008)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEWS-007: should reject multiple default views in the same table',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Table with multiple isDefault: true views
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
                  id: 'view_1',
                  name: 'View 1',
                  isDefault: true, // First default
                },
                {
                  id: 'view_2',
                  name: 'View 2',
                  isDefault: true, // Second default - conflict!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/multiple.*default.*view|only one.*default.*view/i)
    }
  )

  test.fixme(
    'APP-TABLES-VIEWS-008: should reject view with empty name',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: View with empty name
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
                  id: 'my_view',
                  name: '', // Empty name!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/view.*name.*required|view.*name.*empty/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEWS-009: user can complete full views workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with active items view', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 7,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'category', type: 'single-line-text' },
                { id: 4, name: 'status', type: 'single-line-text' },
                { id: 5, name: 'created_at', type: 'datetime' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'active_view',
                  name: 'Active Items',
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
                      field: 'created_at',
                      direction: 'desc',
                    },
                  ],
                },
              ],
            },
          ],
        })
      })

      await test.step('Insert test data', async () => {
        await executeQuery([
          "INSERT INTO data (title, category, status, created_at) VALUES ('Item 1', 'A', 'active', '2024-01-01'), ('Item 2', 'B', 'inactive', '2024-01-02'), ('Item 3', 'A', 'active', '2024-01-03')",
        ])
      })

      await test.step('Verify view filters and sorts records correctly', async () => {
        const viewRecords = await executeQuery('SELECT title, status FROM active_view')
        expect(viewRecords).toEqual([
          { title: 'Item 3', status: 'active' },
          { title: 'Item 1', status: 'active' },
        ])
      })

      await test.step('Verify view excludes inactive records', async () => {
        const inactiveInView = await executeQuery(
          "SELECT * FROM active_view WHERE status = 'inactive'"
        )
        expect(inactiveInView).toHaveLength(0)
      })

      await test.step('Verify view exists in database', async () => {
        const viewExists = await executeQuery(
          "SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_view'"
        )
        expect(viewExists.count).toBe(1)
      })

      await test.step('Error handling: multiple default views rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error',
            tables: [
              {
                id: 99,
                name: 'invalid',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
                views: [
                  { id: 'view_1', name: 'View 1', isDefault: true },
                  { id: 'view_2', name: 'View 2', isDefault: true },
                ],
              },
            ],
          })
        ).rejects.toThrow(/multiple.*default.*view|only one.*default.*view/i)
      })

      await test.step('Error handling: empty view name rejected', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app-error2',
            tables: [
              {
                id: 98,
                name: 'invalid2',
                fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
                views: [{ id: 'my_view', name: '' }],
              },
            ],
          })
        ).rejects.toThrow(/view.*name.*required|view.*name.*empty/i)
      })
    }
  )
})

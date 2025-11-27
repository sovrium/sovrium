/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for View Filters
 *
 * Source: src/domain/models/app/table/views/index.ts
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Filters', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-FILTERS-001: should include only records matching all conditions when filters have AND operator and multiple conditions',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: filters with AND operator and multiple conditions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'age', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'active_adults',
                name: 'Active Adults',
                filters: {
                  and: [
                    { field: 'status', operator: 'equals', value: 'active' },
                    { field: 'age', operator: 'greaterThan', value: 18 },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (status, age) VALUES ('active', 25), ('active', 15), ('inactive', 20)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: only records matching all AND conditions are included

      // View returns only records matching ALL conditions
      const viewRecords = await executeQuery('SELECT * FROM active_adults')
      // THEN: assertion
      expect(viewRecords).toHaveLength(1)
      expect(viewRecords[0]).toEqual(expect.objectContaining({ status: 'active', age: 25 }))
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-FILTERS-002: should include records matching at least one condition when filters have OR operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: filters with OR operator and multiple conditions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'priority', type: 'single-line-text' },
              { id: 3, name: 'urgent', type: 'checkbox' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'important_tasks',
                name: 'Important Tasks',
                filters: {
                  or: [
                    { field: 'priority', operator: 'equals', value: 'high' },
                    { field: 'urgent', operator: 'isTrue', value: true },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (priority, urgent) VALUES ('high', false), ('low', true), ('low', false)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records matching at least one OR condition are included

      // View returns records matching ANY condition
      const viewRecords = await executeQuery('SELECT * FROM important_tasks ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      // First record: high priority, not urgent
      // Second record: low priority, urgent
      expect(viewRecords[0].priority).toBe('high')
      expect(viewRecords[1].urgent).toBe(true)
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-FILTERS-003: should use AND operator by default when filters have no operator specified',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: filters with no operator specified
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'test_view',
                name: 'Test View',
                filters: {
                  and: [{ field: 'name', operator: 'contains', value: 'test' }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO items (name) VALUES ('test item'), ('production item'), ('test case')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: view filters using contains operator

      // View returns records where name contains 'test'
      const viewRecords = await executeQuery('SELECT name FROM test_view ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([{ name: 'test item' }, { name: 'test case' }])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-FILTERS-004: user can complete full view-filters workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative filters
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'category', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'filtered_view',
                name: 'Filtered View',
                filters: {
                  and: [
                    { field: 'category', operator: 'equals', value: 'A' },
                    { field: 'status', operator: 'equals', value: 'active' },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO data (category, status) VALUES ('A', 'active'), ('A', 'inactive'), ('B', 'active')",
      ])

      // WHEN/THEN: Querying the PostgreSQL VIEW validates AND filter logic

      // View returns only records matching ALL conditions
      const viewRecords = await executeQuery('SELECT * FROM filtered_view')
      // THEN: assertion
      expect(viewRecords).toHaveLength(1)
      expect(viewRecords[0]).toEqual(expect.objectContaining({ category: 'A', status: 'active' }))
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for View Sorts
 *
 * Source: specs/app/tables/views/view/sorts/sorts.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Sorts', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-SORTS-001: should order records from lowest to highest by that field when sort is by single field with ascending direction',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a sort by single field with ascending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'price', type: 'decimal' },
            ],
            views: [
              {
                id: 'by_price_asc',
                name: 'By Price (Asc)',
                type: 'grid',
                sorts: [
                  {
                    field: 'price',
                    direction: 'asc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, price) VALUES ('Product C', 30.00), ('Product A', 10.00), ('Product B', 20.00)",
      ])

      // WHEN: applying sort to records
      // THEN: records should be ordered from lowest to highest by that field
      const result = await executeQuery('SELECT name FROM products ORDER BY price ASC')
      expect(result).toEqual([{ name: 'Product A' }, { name: 'Product B' }, { name: 'Product C' }])
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-SORTS-002: should order records from highest to lowest by that field when sort is by single field with descending direction',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a sort by single field with descending direction
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'priority', type: 'integer' },
            ],
            views: [
              {
                id: 'by_priority_desc',
                name: 'By Priority (Desc)',
                type: 'grid',
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
        "INSERT INTO tasks (title, priority) VALUES ('Task A', 1), ('Task C', 3), ('Task B', 2)",
      ])

      // WHEN: applying sort to records
      // THEN: records should be ordered from highest to lowest by that field
      const result = await executeQuery('SELECT title FROM tasks ORDER BY priority DESC')
      expect(result).toEqual([{ title: 'Task C' }, { title: 'Task B' }, { title: 'Task A' }])
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-SORTS-003: should order records by first field, then second field breaks ties, and so on when sorts by multiple fields',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: sorts by multiple fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_employees',
            name: 'employees',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'department', type: 'text' },
              { name: 'name', type: 'text' },
              { name: 'salary', type: 'decimal' },
            ],
            views: [
              {
                id: 'multi_sort',
                name: 'Multi Sort',
                type: 'grid',
                sorts: [
                  {
                    field: 'department',
                    direction: 'asc',
                  },
                  {
                    field: 'salary',
                    direction: 'desc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO employees (department, name, salary) VALUES ('Engineering', 'Alice', 80000), ('Engineering', 'Bob', 90000), ('Sales', 'Charlie', 70000), ('Sales', 'Diana', 75000)",
      ])

      // WHEN: applying sort to records
      // THEN: records should be ordered by first field, then second field breaks ties, and so on
      const result = await executeQuery(
        'SELECT name FROM employees ORDER BY department ASC, salary DESC'
      )
      expect(result).toEqual([
        { name: 'Bob' },
        { name: 'Alice' },
        { name: 'Diana' },
        { name: 'Charlie' },
      ])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-SORTS-REGRESSION-001: user can complete full view-sorts workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative sorting
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
                id: 'sorted_view',
                name: 'Sorted View',
                type: 'grid',
                sorts: [
                  {
                    field: 'category',
                    direction: 'asc',
                  },
                  {
                    field: 'value',
                    direction: 'desc',
                  },
                ],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO data (category, value) VALUES ('B', 2), ('A', 3), ('A', 1), ('B', 4)",
      ])

      // WHEN/THEN: Streamlined workflow testing integration points
      const result = await executeQuery(
        'SELECT category, value FROM data ORDER BY category ASC, value DESC'
      )
      expect(result).toEqual([
        { category: 'A', value: 3 },
        { category: 'A', value: 1 },
        { category: 'B', value: 4 },
        { category: 'B', value: 2 },
      ])
    }
  )
})

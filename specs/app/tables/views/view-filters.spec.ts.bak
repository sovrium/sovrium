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
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Filters', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
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
      expect(viewRecords.rows).toHaveLength(1)
      expect(viewRecords.rows[0]).toEqual(expect.objectContaining({ status: 'active', age: 25 }))
    }
  )

  test(
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
      expect(viewRecords.rows).toHaveLength(2)
      // First record: high priority, not urgent
      // Second record: low priority, urgent
      expect(viewRecords.rows[0].priority).toBe('high')
      expect(viewRecords.rows[1].urgent).toBe(true)
    }
  )

  test(
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
      expect(viewRecords.rows).toHaveLength(2)
      expect(viewRecords.rows).toEqual([{ name: 'test item' }, { name: 'test case' }])
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (004-005)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-FILTERS-004: should reject filter referencing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: View filter referencing non-existent field
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
                  id: 'filtered_view',
                  name: 'Filtered View',
                  filters: {
                    and: [
                      { field: 'status', operator: 'equals', value: 'active' }, // 'status' doesn't exist!
                    ],
                  },
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/field.*status.*not found|filter.*references.*non-existent.*field/i)
    }
  )

  test(
    'APP-TABLES-VIEW-FILTERS-005: should reject filter with invalid operator for field type',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: View filter with operator incompatible with field type
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
                { id: 2, name: 'is_active', type: 'checkbox' },
              ],
              views: [
                {
                  id: 'filtered_view',
                  name: 'Filtered View',
                  filters: {
                    and: [
                      { field: 'is_active', operator: 'contains', value: 'test' }, // 'contains' invalid for checkbox!
                    ],
                  },
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/operator.*contains.*invalid.*checkbox|incompatible.*operator/i)
    }
  )

  test(
    'APP-TABLES-VIEW-FILTERS-006: should filter deleted records when view explicitly filters by deleted_at',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with view that explicitly includes deleted records (Trash view)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'status', type: 'single-line-text', required: true },
              { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'trash_view',
                name: 'Trash',
                filters: {
                  and: [{ field: 'deleted_at', operator: 'isNotNull', value: null }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO contacts (id, name, status) VALUES
        (1, 'Alice', 'active'),
        (2, 'Bob', 'active')
      `)
      await executeQuery('UPDATE contacts SET deleted_at = NOW() WHERE id = 2')

      // WHEN: Database view is queried (Trash view)
      const viewRecords = await executeQuery('SELECT id, name FROM trash_view')

      // THEN: View returns only deleted records
      expect(viewRecords.id).toBe(2)
      expect(viewRecords.name).toBe('Bob')

      // THEN: Active records are excluded from trash view
      const allViewRecords = await executeQuery('SELECT COUNT(*) as count FROM trash_view')
      expect(allViewRecords.count).toBe('1')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-FILTERS-REGRESSION: user can complete full view-filters workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-VIEW-FILTERS-001: Include only records matching all AND conditions', async () => {
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
        const viewRecords = await executeQuery('SELECT * FROM active_adults')
        expect(viewRecords.rows).toHaveLength(1)
        expect(viewRecords.rows[0]).toEqual(expect.objectContaining({ status: 'active', age: 25 }))
      })

      await test.step('APP-TABLES-VIEW-FILTERS-002: Include records matching at least one OR condition', async () => {
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
        const viewRecords = await executeQuery('SELECT * FROM important_tasks ORDER BY id')
        expect(viewRecords.rows).toHaveLength(2)
        expect(viewRecords.rows[0].priority).toBe('high')
        expect(viewRecords.rows[1].urgent).toBe(true)
      })

      await test.step('APP-TABLES-VIEW-FILTERS-003: Use AND operator by default', async () => {
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
        const viewRecords = await executeQuery('SELECT name FROM test_view ORDER BY id')
        expect(viewRecords.rows).toHaveLength(2)
        expect(viewRecords.rows).toEqual([{ name: 'test item' }, { name: 'test case' }])
      })

      await test.step('APP-TABLES-VIEW-FILTERS-004: Reject filter referencing non-existent field', async () => {
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
                    id: 'filtered_view',
                    name: 'Filtered View',
                    filters: {
                      and: [{ field: 'status', operator: 'equals', value: 'active' }],
                    },
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/field.*status.*not found|filter.*references.*non-existent.*field/i)
      })

      await test.step('APP-TABLES-VIEW-FILTERS-005: Reject filter with invalid operator for field type', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'tasks',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'is_active', type: 'checkbox' },
                ],
                views: [
                  {
                    id: 'filtered_view',
                    name: 'Filtered View',
                    filters: {
                      and: [{ field: 'is_active', operator: 'contains', value: 'test' }],
                    },
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/operator.*contains.*invalid.*checkbox|incompatible.*operator/i)
      })

      await test.step('APP-TABLES-VIEW-FILTERS-006: Filter deleted records when view filters by deleted_at', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'contacts',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'status', type: 'single-line-text', required: true },
                { id: 4, name: 'deleted_at', type: 'deleted-at', indexed: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'trash_view',
                  name: 'Trash',
                  filters: {
                    and: [{ field: 'deleted_at', operator: 'isNotNull', value: null }],
                  },
                },
              ],
            },
          ],
        })
        await executeQuery(`
          INSERT INTO contacts (id, name, status) VALUES
          (1, 'Alice', 'active'),
          (2, 'Bob', 'active')
        `)
        await executeQuery('UPDATE contacts SET deleted_at = NOW() WHERE id = 2')
        const viewRecords = await executeQuery('SELECT id, name FROM trash_view')
        expect(viewRecords.id).toBe(2)
        expect(viewRecords.name).toBe('Bob')
        const allViewRecords = await executeQuery('SELECT COUNT(*) as count FROM trash_view')
        expect(allViewRecords.count).toBe('1')
      })
    }
  )
})

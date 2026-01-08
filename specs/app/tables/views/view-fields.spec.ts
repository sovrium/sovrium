/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for View Fields
 *
 * Source: src/domain/models/app/table/views/index.ts
 * Domain: app
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Fields', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-FIELDS-001: should show only configured fields when a view has specific fields configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with specific fields configured (fields not in array are hidden)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
              { id: 4, name: 'internal_notes', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'public_view',
                name: 'Public View',
                fields: ['id', 'name', 'price'],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, price, internal_notes) VALUES ('Widget', 19.99, 'Internal note here')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: only configured fields should be included (internal_notes excluded)

      // View has only the specified columns
      const viewColumns = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'public_view' ORDER BY ordinal_position"
      )
      expect(viewColumns.rows).toEqual([
        { column_name: 'id' },
        { column_name: 'name' },
        { column_name: 'price' },
      ])

      // View returns only visible fields
      const viewRecords = await executeQuery('SELECT * FROM public_view')
      expect(viewRecords).toHaveProperty('id')
      expect(viewRecords).toHaveProperty('name')
      expect(viewRecords).toHaveProperty('price')
      expect(viewRecords).not.toHaveProperty('internal_notes')
    }
  )

  test(
    'APP-TABLES-VIEW-FIELDS-002: should display fields in the specified order when a view has fields configured with custom order',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with fields configured with custom order
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'priority', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'ordered_view',
                name: 'Ordered View',
                fields: ['priority', 'status', 'title', 'id'],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO tasks (title, status, priority) VALUES ('Task 1', 'active', 'high')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: columns should appear in the specified order

      // View columns are in the specified order
      const viewColumns = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'ordered_view' ORDER BY ordinal_position"
      )
      expect(viewColumns.rows).toEqual([
        { column_name: 'priority' },
        { column_name: 'status' },
        { column_name: 'title' },
        { column_name: 'id' },
      ])
    }
  )

  test(
    'APP-TABLES-VIEW-FIELDS-003: should not show field when it is not included in the view fields array',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with a field excluded from the fields array
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'username', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'password', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'safe_view',
                name: 'Safe View',
                fields: ['id', 'username', 'email'],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO users (username, email, password) VALUES ('john_doe', 'john@example.com', 'secret_hash')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: excluded field (password) should not be accessible

      // View does not include password column
      const viewColumns = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'safe_view' ORDER BY ordinal_position"
      )
      expect(viewColumns.rows).toEqual([
        { column_name: 'id' },
        { column_name: 'username' },
        { column_name: 'email' },
      ])

      // View record does not have password field
      const viewRecords = await executeQuery('SELECT * FROM safe_view')
      expect(viewRecords).not.toHaveProperty('password')
    }
  )

  // ============================================================================
  // Phase: Error Configuration Validation Tests (004)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-FIELDS-004: should reject fields array containing non-existent field',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: View fields array containing non-existent field
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
              ],
              views: [
                {
                  id: 'custom_view',
                  name: 'Custom View',
                  fields: ['id', 'name', 'description'], // 'description' doesn't exist!
                },
              ],
            },
          ],
        })
      ).rejects.toThrow(/field.*description.*not found|view.*fields.*non-existent/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-VIEW-FIELDS-REGRESSION: user can complete full view-fields workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-VIEW-FIELDS-001: Show only configured fields', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'price', type: 'decimal' },
                { id: 4, name: 'internal_notes', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'public_view',
                  name: 'Public View',
                  fields: ['id', 'name', 'price'],
                },
              ],
            },
          ],
        })
        await executeQuery([
          "INSERT INTO products (name, price, internal_notes) VALUES ('Widget', 19.99, 'Internal note here')",
        ])
        const viewColumns = await executeQuery(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'public_view' ORDER BY ordinal_position"
        )
        expect(viewColumns.rows).toEqual([
          { column_name: 'id' },
          { column_name: 'name' },
          { column_name: 'price' },
        ])
        const viewRecords = await executeQuery('SELECT * FROM public_view')
        expect(viewRecords).toHaveProperty('id')
        expect(viewRecords).toHaveProperty('name')
        expect(viewRecords).toHaveProperty('price')
        expect(viewRecords).not.toHaveProperty('internal_notes')
      })

      await test.step('APP-TABLES-VIEW-FIELDS-002: Display fields in specified order', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'status', type: 'single-line-text' },
                { id: 4, name: 'priority', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'ordered_view',
                  name: 'Ordered View',
                  fields: ['priority', 'status', 'title', 'id'],
                },
              ],
            },
          ],
        })
        await executeQuery([
          "INSERT INTO tasks (title, status, priority) VALUES ('Task 1', 'active', 'high')",
        ])
        const viewColumns = await executeQuery(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'ordered_view' ORDER BY ordinal_position"
        )
        expect(viewColumns.rows).toEqual([
          { column_name: 'priority' },
          { column_name: 'status' },
          { column_name: 'title' },
          { column_name: 'id' },
        ])
      })

      await test.step('APP-TABLES-VIEW-FIELDS-003: Not show field when excluded from fields array', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'users',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'username', type: 'single-line-text' },
                { id: 3, name: 'email', type: 'single-line-text' },
                { id: 4, name: 'password', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              views: [
                {
                  id: 'safe_view',
                  name: 'Safe View',
                  fields: ['id', 'username', 'email'],
                },
              ],
            },
          ],
        })
        await executeQuery([
          "INSERT INTO users (username, email, password) VALUES ('john_doe', 'john@example.com', 'secret_hash')",
        ])
        const viewColumns = await executeQuery(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'safe_view' ORDER BY ordinal_position"
        )
        expect(viewColumns.rows).toEqual([
          { column_name: 'id' },
          { column_name: 'username' },
          { column_name: 'email' },
        ])
        const viewRecords = await executeQuery('SELECT * FROM safe_view')
        expect(viewRecords).not.toHaveProperty('password')
      })

      await test.step('APP-TABLES-VIEW-FIELDS-004: Reject fields array containing non-existent field', async () => {
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'products',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                ],
                views: [
                  {
                    id: 'custom_view',
                    name: 'Custom View',
                    fields: ['id', 'name', 'description'],
                  },
                ],
              },
            ],
          })
        ).rejects.toThrow(/field.*description.*not found|view.*fields.*non-existent/i)
      })
    }
  )
})

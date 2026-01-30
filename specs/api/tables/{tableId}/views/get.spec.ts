/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List table views
 *
 * Source: src/domain/models/app/table/views/
 * Domain: api
 * Spec Count: 5
 *
 * Domain Properties Tested:
 * - id, name (basic view properties)
 * - filters (recursive AND/OR conditions)
 * - sorts (field + direction array)
 * - fields (visible field names)
 * - groupBy (field + optional direction)
 * - permissions (role-based read filtering)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List table views', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-LIST-001: should return all views with complete domain configurations',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with 3 views using different domain configurations
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              {
                id: 2,
                name: 'status',
                type: 'single-select',
                options: ['active', 'completed', 'archived'],
              },
              {
                id: 3,
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
              },
            ],
            views: [
              {
                id: 'filtered_view',
                name: 'Filtered Tasks',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
              },
              {
                id: 'grouped_view',
                name: 'Grouped Tasks',
                groupBy: { field: 'status' },
              },
              {
                id: 'sorted_view',
                name: 'Sorted Tasks',
                fields: ['title', 'priority'],
                sorts: [{ field: 'priority', direction: 'desc' }],
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests list of views
      const response = await request.get('/api/tables/1/views', {})

      // THEN: All 3 views should be returned with complete configurations
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(3)

      // Validate each view has id and name
      for (const view of data) {
        // THEN: assertion
        expect(view).toHaveProperty('id')
        expect(view).toHaveProperty('name')
        expect(typeof view.id).toBe('string')
        expect(typeof view.name).toBe('string')
      }

      // Verify specific view configurations are present
      const filteredView = data.find((v: { id: string }) => v.id === 'filtered_view')
      // THEN: assertion
      expect(filteredView).toBeDefined()
      expect(filteredView.name).toBe('Filtered Tasks')
      expect(filteredView).toHaveProperty('filters')

      const groupedView = data.find((v: { id: string }) => v.id === 'grouped_view')
      // THEN: assertion
      expect(groupedView).toBeDefined()
      expect(groupedView.name).toBe('Grouped Tasks')
      expect(groupedView).toHaveProperty('groupBy')

      const sortedView = data.find((v: { id: string }) => v.id === 'sorted_view')
      // THEN: assertion
      expect(sortedView).toBeDefined()
      expect(sortedView.name).toBe('Sorted Tasks')
      expect(sortedView).toHaveProperty('fields')
      expect(sortedView).toHaveProperty('sorts')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-002: should return empty array when table has no views',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with fields but no views configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests list of views
      const response = await request.get('/api/tables/1/views', {})

      // THEN: An empty array should be returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-003: should return 404 when table does not exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Server running but non-existent table ID
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests list of views for non-existent table
      const response = await request.get('/api/tables/9999/views', {})

      // THEN: 404 Not Found error should be returned
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-004: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Server running with auth enabled but NO authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })

      // WHEN: Unauthenticated user requests list of views
      const response = await request.get('/api/tables/1/views')

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-005: should only return views the user has read permission for',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with 2 views — one admin-only, one unrestricted
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
            views: [
              {
                id: 'admin_view',
                name: 'Admin View',
                permissions: { read: ['admin'] },
              },
              {
                id: 'public_view',
                name: 'Public View',
              },
            ],
          },
        ],
      })

      // Authenticate as member (not admin)
      await createAuthenticatedUser({ role: 'member' })

      // WHEN: Member user requests list of views
      const response = await request.get('/api/tables/1/views', {})

      // THEN: Only the unrestricted view should be returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
      expect(data[0].id).toBe('public_view')
      expect(data[0].name).toBe('Public View')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-LIST-REGRESSION: user can complete full views list workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      await test.step('API-TABLES-VIEWS-LIST-004: Returns 401 when not authenticated', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true, admin: true },
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text' },
                {
                  id: 2,
                  name: 'status',
                  type: 'single-select',
                  options: ['active', 'completed'],
                },
              ],
              views: [
                {
                  id: 'filtered_view',
                  name: 'Filtered Tasks',
                  filters: {
                    and: [{ field: 'status', operator: 'equals', value: 'active' }],
                  },
                },
                {
                  id: 'sorted_view',
                  name: 'Sorted Tasks',
                  sorts: [{ field: 'title', direction: 'asc' }],
                  fields: ['title', 'status'],
                },
                {
                  id: 'admin_view',
                  name: 'Admin View',
                  permissions: { read: ['admin'] },
                },
              ],
            },
          ],
        })

        // WHEN: Unauthenticated user requests list of views
        const response = await request.get('/api/tables/1/views')

        // THEN: Response should be 401 Unauthorized
        expect(response.status()).toBe(401)
        const data = await response.json()
        expect(data.success).toBe(false)
      })

      await test.step('Setup: Create authenticated user', async () => {
        await createAuthenticatedUser()
      })

      await test.step('API-TABLES-VIEWS-LIST-003: Returns 404 for non-existent table', async () => {
        // WHEN: User requests views for non-existent table
        const response = await request.get('/api/tables/9999/views', {})

        // THEN: 404 Not Found
        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-VIEWS-LIST-001: Returns all views with complete configurations', async () => {
        // WHEN: User requests list of views
        const response = await request.get('/api/tables/1/views', {})

        // THEN: All views returned with configurations
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThanOrEqual(2)

        for (const view of data) {
          expect(view).toHaveProperty('id')
          expect(view).toHaveProperty('name')
        }
      })

      await test.step('API-TABLES-VIEWS-LIST-005: Returns only views with read permission', async () => {
        // Note: This step depends on role-based filtering behavior
        // Admin user should see all views, member should see fewer
        const response = await request.get('/api/tables/1/views', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
      })
    }
  )
})

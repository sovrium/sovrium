/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get view details
 *
 * Source: src/domain/models/app/table/views/
 * Domain: api
 * Spec Count: 8
 *
 * Domain Properties Tested:
 * - id, name (basic view properties)
 * - filters (recursive AND/OR conditions)
 * - sorts (field + direction array)
 * - fields (visible field names)
 * - groupBy (field + optional direction)
 * - isDefault (default view flag)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get view details', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-VIEWS-GET-001: should return view with basic properties',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with a basic view
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'basic_view',
                name: 'Basic View',
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests specific view details
      const response = await request.get('/api/tables/1/views/basic_view', {})

      // THEN: View should be returned with id and name
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data.id).toBe('basic_view')
      expect(data.name).toBe('Basic View')
    }
  )

  test(
    'API-TABLES-VIEWS-GET-002: should return view with filters configuration',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with a view that has nested AND filters
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
                name: 'High Priority Active',
                filters: {
                  and: [
                    { field: 'status', operator: 'equals', value: 'active' },
                    { field: 'priority', operator: 'equals', value: 'high' },
                  ],
                },
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests view with filters
      const response = await request.get('/api/tables/1/views/filtered_view', {})

      // THEN: View should include filters configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('filters')
      expect(data.id).toBe('filtered_view')
      expect(data.name).toBe('High Priority Active')
      expect(data.filters).toHaveProperty('and')
      expect(Array.isArray(data.filters.and)).toBe(true)
      expect(data.filters.and).toHaveLength(2)
      expect(data.filters.and[0]).toEqual({
        field: 'status',
        operator: 'equals',
        value: 'active',
      })
      expect(data.filters.and[1]).toEqual({
        field: 'priority',
        operator: 'equals',
        value: 'high',
      })
    }
  )

  test(
    'API-TABLES-VIEWS-GET-003: should return view with sorts configuration',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with a view that has multi-field sorts
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text' },
              { id: 2, name: 'created_at', type: 'single-line-text' },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'sorted_view',
                name: 'Sorted View',
                sorts: [
                  { field: 'created_at', direction: 'desc' },
                  { field: 'name', direction: 'asc' },
                ],
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests view with sorts
      const response = await request.get('/api/tables/1/views/sorted_view', {})

      // THEN: View should include sorts configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('sorts')
      expect(data.id).toBe('sorted_view')
      expect(Array.isArray(data.sorts)).toBe(true)
      expect(data.sorts).toHaveLength(2)
      expect(data.sorts[0]).toEqual({ field: 'created_at', direction: 'desc' })
      expect(data.sorts[1]).toEqual({ field: 'name', direction: 'asc' })
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-004: should return view with fields and groupBy',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with a view that has fields array and groupBy configuration
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
              { id: 3, name: 'assignee', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'grouped_view',
                name: 'Grouped View',
                fields: ['title', 'status', 'assignee'],
                groupBy: { field: 'status' },
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests view with fields and groupBy
      const response = await request.get('/api/tables/1/views/grouped_view', {})

      // THEN: View should include fields array and groupBy configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('fields')
      expect(data).toHaveProperty('groupBy')
      expect(data.id).toBe('grouped_view')
      expect(Array.isArray(data.fields)).toBe(true)
      expect(data.fields).toHaveLength(3)
      expect(data.fields).toEqual(['title', 'status', 'assignee'])
      expect(data.groupBy).toEqual({ field: 'status' })
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-005: should return view with isDefault flag',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with a default view and a non-default view
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
                id: 'default_view',
                name: 'Default View',
                isDefault: true,
              },
              {
                id: 'secondary_view',
                name: 'Secondary View',
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests the default view
      const defaultResponse = await request.get('/api/tables/1/views/default_view', {})

      // THEN: isDefault should be true
      expect(defaultResponse.status()).toBe(200)

      const defaultData = await defaultResponse.json()
      // THEN: assertion
      expect(defaultData).toHaveProperty('id')
      expect(defaultData.id).toBe('default_view')
      expect(defaultData).toHaveProperty('isDefault')
      expect(defaultData.isDefault).toBe(true)

      // WHEN: User requests the non-default view
      const secondaryResponse = await request.get('/api/tables/1/views/secondary_view', {})

      // THEN: isDefault should be false or omitted
      expect(secondaryResponse.status()).toBe(200)

      const secondaryData = await secondaryResponse.json()
      // THEN: assertion
      expect(secondaryData).toHaveProperty('id')
      expect(secondaryData.id).toBe('secondary_view')
      // isDefault should be false or not present
      if (secondaryData.isDefault !== undefined) {
        expect(secondaryData.isDefault).toBe(false)
      }
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-006: should return 404 when view does not exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table that exists but does not have the requested view
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
                id: 'existing_view',
                name: 'Existing View',
              },
            ],
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User requests a non-existent view
      const response = await request.get('/api/tables/1/views/non_existent', {})

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
    'API-TABLES-VIEWS-GET-007: should return 404 when table does not exist',
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

      // WHEN: User requests view for non-existent table
      const response = await request.get('/api/tables/9999/views/some_view', {})

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
    'API-TABLES-VIEWS-GET-008: should return 401 when not authenticated',
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
            views: [
              {
                id: 'basic_view',
                name: 'Basic View',
              },
            ],
          },
        ],
      })

      // WHEN: Unauthenticated user requests view details
      const response = await request.get('/api/tables/1/views/basic_view')

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-GET-REGRESSION: user can complete full view details workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // Setup: Start server with tasks table and multiple views
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
              {
                id: 3,
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
              },
              { id: 4, name: 'assignee', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'basic_view',
                name: 'Basic View',
              },
              {
                id: 'filtered_view',
                name: 'Filtered View',
                filters: {
                  and: [
                    { field: 'status', operator: 'equals', value: 'active' },
                    { field: 'priority', operator: 'equals', value: 'high' },
                  ],
                },
              },
              {
                id: 'sorted_view',
                name: 'Sorted View',
                sorts: [
                  { field: 'title', direction: 'desc' },
                  { field: 'status', direction: 'asc' },
                ],
              },
              {
                id: 'grouped_view',
                name: 'Grouped View',
                fields: ['title', 'status', 'assignee'],
                groupBy: { field: 'status' },
              },
              {
                id: 'default_view',
                name: 'Default View',
                isDefault: true,
              },
            ],
          },
        ],
      })

      // --- Step 008: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-VIEWS-GET-008: Return 401 when not authenticated', async () => {
        const response = await request.get('/api/tables/1/views/basic_view')
        expect(response.status()).toBe(401)
        const data = await response.json()
        expect(data.success).toBe(false)
      })

      // --- Authenticate ---
      await createAuthenticatedUser()

      await test.step('API-TABLES-VIEWS-GET-007: Returns 404 when table does not exist', async () => {
        // WHEN: User requests view for non-existent table
        const response = await request.get('/api/tables/9999/views/basic_view', {})

        // THEN: 404 Not Found
        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-VIEWS-GET-006: Returns 404 when view does not exist', async () => {
        // WHEN: User requests non-existent view
        const response = await request.get('/api/tables/1/views/non_existent', {})

        // THEN: 404 Not Found
        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-VIEWS-GET-001: Returns view with basic properties', async () => {
        // WHEN: User requests specific view details
        const response = await request.get('/api/tables/1/views/basic_view', {})

        // THEN: View should be returned with id and name
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data.id).toBe('basic_view')
        expect(data.name).toBe('Basic View')
      })

      await test.step('API-TABLES-VIEWS-GET-002: Returns view with filters configuration', async () => {
        // WHEN: User requests view with filters
        const response = await request.get('/api/tables/1/views/filtered_view', {})

        // THEN: Filters should be present and accurate
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('filters')
        expect(data.filters).toHaveProperty('and')
        expect(data.filters.and).toHaveLength(2)
      })

      await test.step('API-TABLES-VIEWS-GET-003: Return view with sorts configuration', async () => {
        const response = await request.get('/api/tables/1/views/sorted_view', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('sorts')
        expect(Array.isArray(data.sorts)).toBe(true)
        expect(data.sorts).toHaveLength(2)
      })

      await test.step('API-TABLES-VIEWS-GET-004: Return view with fields and groupBy configuration', async () => {
        const response = await request.get('/api/tables/1/views/grouped_view', {})
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('fields')
        expect(data).toHaveProperty('groupBy')
        expect(data.fields).toEqual(['title', 'status', 'assignee'])
        expect(data.groupBy).toEqual({ field: 'status' })
      })

      await test.step('API-TABLES-VIEWS-GET-005: Returns view with isDefault flag', async () => {
        // WHEN: User requests the default view
        const response = await request.get('/api/tables/1/views/default_view', {})

        // THEN: isDefault should be true
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data).toHaveProperty('isDefault')
        expect(data.isDefault).toBe(true)
      })
    }
  )
})

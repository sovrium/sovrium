/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for View Records API
 *
 * Source: src/domain/models/app/table/views/
 * Domain: api
 * Spec Count: 7
 *
 * View Records Behavior:
 * - Returns records filtered by view filters configuration
 * - Applies view-level sorting via sorts configuration
 * - Restricts returned fields based on view fields configuration
 * - Applies combined filters, sorts, and fields together
 * - Respects view-level permissions (role-based read filtering)
 *
 * Domain Properties Tested:
 * - filters (AND/OR conditions applied to record retrieval)
 * - sorts (field + direction applied to record ordering)
 * - fields (visible field names restricting returned data)
 * - permissions (role-based read access control)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Records API', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-TABLES-VIEW-RECORDS-001: should return records filtered by view filters',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A table with a view that filters by status='active'
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
                id: 'active_tasks',
                name: 'Active Tasks',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO tasks (title, status, priority) VALUES
        ('Task 1', 'active', 'high'),
        ('Task 2', 'completed', 'medium'),
        ('Task 3', 'active', 'low'),
        ('Task 4', 'archived', 'high')
      `)

      await createAuthenticatedUser()

      // WHEN: User requests records through the filtered view
      const response = await request.get('/api/tables/1/views/active_tasks/records', {})

      // THEN: Only active tasks should be returned
      expect(response.status()).toBe(200)

      const body = await response.json()
      // THEN: assertion
      expect(body.records).toHaveLength(2)
      expect(
        body.records.every((r: { fields: { status: string } }) => r.fields.status === 'active')
      ).toBe(true)

      const titles = body.records.map((r: { fields: { title: string } }) => r.fields.title).sort()
      // THEN: assertion
      expect(titles).toEqual(['Task 1', 'Task 3'])
    }
  )

  test(
    'API-TABLES-VIEW-RECORDS-002: should return records sorted by view sorts',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A table with a view sorted by price descending
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
            views: [
              {
                id: 'by_price',
                name: 'By Price',
                sorts: [{ field: 'price', direction: 'desc' }],
              },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO products (name, price) VALUES
        ('Product A', 10.00),
        ('Product B', 50.00),
        ('Product C', 25.00)
      `)

      await createAuthenticatedUser()

      // WHEN: User requests records through the sorted view
      const response = await request.get('/api/tables/1/views/by_price/records', {})

      // THEN: Records should be sorted by price descending
      expect(response.status()).toBe(200)

      const body = await response.json()
      // THEN: assertion
      expect(body.records).toHaveLength(3)

      const prices = body.records.map((r: { fields: { price: string } }) => r.fields.price)
      // THEN: assertion
      expect(prices).toEqual(['50.00', '25.00', '10.00'])
    }
  )

  test(
    'API-TABLES-VIEW-RECORDS-003: should return only visible fields from view',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A table with a view that only shows name and email (hiding phone)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'phone', type: 'phone-number' },
            ],
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

      await executeQuery(`
        INSERT INTO contacts (name, email, phone) VALUES
        ('John Doe', 'john@example.com', '+1234567890')
      `)

      await createAuthenticatedUser()

      // WHEN: User requests records through the field-limited view
      const response = await request.get('/api/tables/1/views/contact_info/records', {})

      // THEN: Only name and email should be returned (phone excluded)
      expect(response.status()).toBe(200)

      const body = await response.json()
      // THEN: assertion
      expect(body.records).toHaveLength(1)

      const record = body.records[0]
      // THEN: assertion
      expect(record.fields).toHaveProperty('name')
      expect(record.fields).toHaveProperty('email')
      expect(record.fields).not.toHaveProperty('phone')
    }
  )

  test(
    'API-TABLES-VIEW-RECORDS-004: should apply combined filters, sorts, and fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A table with a view combining filters + sorts + fields
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
                id: 'combined_view',
                name: 'Combined View',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
                sorts: [{ field: 'priority', direction: 'desc' }],
                fields: ['title', 'priority'],
              },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO tasks (title, status, priority) VALUES
        ('Task A', 'active', 'low'),
        ('Task B', 'completed', 'high'),
        ('Task C', 'active', 'high'),
        ('Task D', 'active', 'medium')
      `)

      await createAuthenticatedUser()

      // WHEN: User requests records through the combined view
      const response = await request.get('/api/tables/1/views/combined_view/records', {})

      // THEN: Only active records, sorted by priority desc, with only title+priority fields
      expect(response.status()).toBe(200)

      const body = await response.json()
      // THEN: assertion — only active records (3 of 4)
      expect(body.records).toHaveLength(3)

      // THEN: assertion — sorted by priority descending (high, medium, low)
      const priorities = body.records.map(
        (r: { fields: { priority: string } }) => r.fields.priority
      )
      expect(priorities).toEqual(['high', 'medium', 'low'])

      // THEN: assertion — only title and priority fields visible
      for (const record of body.records) {
        expect(record.fields).toHaveProperty('title')
        expect(record.fields).toHaveProperty('priority')
        expect(record.fields).not.toHaveProperty('status')
      }

      // THEN: assertion — verify correct titles in order
      const titles = body.records.map((r: { fields: { title: string } }) => r.fields.title)
      expect(titles).toEqual(['Task C', 'Task D', 'Task A'])
    }
  )

  test(
    'API-TABLES-VIEW-RECORDS-005: should return 403 when user lacks view read permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A table with a view restricted to admin role
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'sensitive_data',
            fields: [{ id: 1, name: 'data', type: 'single-line-text' }],
            views: [
              {
                id: 'admin_view',
                name: 'Admin View',
                permissions: {
                  read: ['admin'],
                },
              },
            ],
          },
        ],
      })

      // Create a viewer user (non-admin)
      await createAuthenticatedViewer()

      // WHEN: Viewer user attempts to access admin-restricted view records
      const response = await request.get('/api/tables/1/views/admin_view/records', {})

      // THEN: 403 Forbidden
      expect(response.status()).toBe(403)

      const body = await response.json()
      // THEN: assertion
      expect(body.success).toBe(false)
      expect(body).toHaveProperty('message')
    }
  )

  test(
    'API-TABLES-VIEW-RECORDS-006: should return 404 when view does not exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table that exists but the view does not
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

      // WHEN: User requests records for non-existent view
      const response = await request.get('/api/tables/1/views/non_existent/records', {})

      // THEN: 404 Not Found
      expect(response.status()).toBe(404)

      const body = await response.json()
      // THEN: assertion
      expect(body.success).toBe(false)
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('code')
      expect(body.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-VIEW-RECORDS-007: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated user requests view records
      const response = await request.get('/api/tables/1/views/basic_view/records')

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)

      const body = await response.json()
      // THEN: assertion
      expect(body.success).toBe(false)
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('code')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEW-RECORDS-REGRESSION: view records API endpoints work correctly',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Start server with comprehensive schema
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
                id: 'active_tasks',
                name: 'Active Tasks',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
              },
              {
                id: 'sorted_tasks',
                name: 'Sorted Tasks',
                sorts: [{ field: 'priority', direction: 'desc' }],
              },
              {
                id: 'limited_fields',
                name: 'Limited Fields',
                fields: ['title', 'priority'],
              },
              {
                id: 'combined_view',
                name: 'Combined View',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
                sorts: [{ field: 'priority', direction: 'desc' }],
                fields: ['title', 'priority'],
              },
              {
                id: 'admin_view',
                name: 'Admin View',
                permissions: {
                  read: ['admin'],
                },
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery(`
        INSERT INTO tasks (title, status, priority) VALUES
        ('Task A', 'active', 'low'),
        ('Task B', 'completed', 'high'),
        ('Task C', 'active', 'high'),
        ('Task D', 'active', 'medium')
      `)

      // --- Step 007: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-VIEW-RECORDS-007: Return 401 when not authenticated', async () => {
        const response = await request.get('/api/tables/1/views/active_tasks/records')
        expect(response.status()).toBe(401)
        const body = await response.json()
        expect(body.success).toBe(false)
      })

      // --- Authenticate as user for all subsequent test steps ---
      await createAuthenticatedUser()

      await test.step('API-TABLES-VIEW-RECORDS-006: Returns 404 when view does not exist', async () => {
        // WHEN: User requests records for non-existent view
        const response = await request.get('/api/tables/1/views/non_existent/records', {})

        // THEN: 404 Not Found
        expect(response.status()).toBe(404)
        const body = await response.json()
        expect(body.success).toBe(false)
        expect(body.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-VIEW-RECORDS-001: Returns records filtered by view filters', async () => {
        // WHEN: User requests records through filtered view
        const response = await request.get('/api/tables/1/views/active_tasks/records', {})

        // THEN: Only active tasks returned
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.records).toHaveLength(3)
        expect(
          body.records.every((r: { fields: { status: string } }) => r.fields.status === 'active')
        ).toBe(true)
      })

      await test.step('API-TABLES-VIEW-RECORDS-002: Returns records sorted by view sorts', async () => {
        // WHEN: User requests records through sorted view
        const response = await request.get('/api/tables/1/views/sorted_tasks/records', {})

        // THEN: Records sorted by priority descending
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.records).toHaveLength(4)

        const priorities = body.records.map(
          (r: { fields: { priority: string } }) => r.fields.priority
        )
        expect(priorities[0]).toBe('high')
      })

      await test.step('API-TABLES-VIEW-RECORDS-003: Returns only visible fields from view', async () => {
        // WHEN: User requests records through field-limited view
        const response = await request.get('/api/tables/1/views/limited_fields/records', {})

        // THEN: Only title and priority fields returned
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body.records.length).toBeGreaterThan(0)

        for (const record of body.records) {
          expect(record.fields).toHaveProperty('title')
          expect(record.fields).toHaveProperty('priority')
          expect(record.fields).not.toHaveProperty('status')
        }
      })

      await test.step('API-TABLES-VIEW-RECORDS-004: Applies combined filters, sorts, and fields', async () => {
        // WHEN: User requests records through combined view
        const response = await request.get('/api/tables/1/views/combined_view/records', {})

        // THEN: Only active records, sorted by priority desc, with limited fields
        expect(response.status()).toBe(200)
        const body = await response.json()

        // Only active records
        expect(body.records).toHaveLength(3)

        // Only title and priority fields
        for (const record of body.records) {
          expect(record.fields).toHaveProperty('title')
          expect(record.fields).toHaveProperty('priority')
          expect(record.fields).not.toHaveProperty('status')
        }

        // Sorted by priority descending
        const priorities = body.records.map(
          (r: { fields: { priority: string } }) => r.fields.priority
        )
        expect(priorities).toEqual(['high', 'medium', 'low'])
      })

      // --- Step 005 skipped: requires viewer auth context ---
      // API-TABLES-VIEW-RECORDS-005 tests 403 for viewer role lacking read permission.
      // This needs createAuthenticatedViewer which would invalidate the current session.
      // Covered by @spec test API-TABLES-VIEW-RECORDS-005.
    }
  )
})

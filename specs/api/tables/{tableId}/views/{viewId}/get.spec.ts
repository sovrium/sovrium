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
 * Source: specs/api/paths/tables/{tableId}/views/{viewId}/get.json
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get view details', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-GET-001: should return view configuration with all properties',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A table with a specific view configured
      // TODO: Setup table with active_projects view

      // WHEN: User requests view details by viewId
      const response = await request.get('/api/tables/1/views/active_projects', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: View configuration should be returned with all properties
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('type')
      expect(data.id).toBe('active_projects')
      expect(data.name).toBe('Active Projects')
      expect(data.type).toBe('grid')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-002: should return 404 with View not found message',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A table without the requested view
      // TODO: Setup table with no views

      // WHEN: User requests non-existent view
      const response = await request.get('/api/tables/1/views/non_existent', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: 404 Not Found error should be returned with 'View not found' message
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code')
      expect(data.error).toBe('View not found')
      expect(data.code).toBe('VIEW_NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-003: should return 404 with Table not found message',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A non-existent table ID
      // No setup needed

      // WHEN: User requests view details
      const response = await request.get('/api/tables/9999/views/active_projects', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: 404 Not Found error should be returned with 'Table not found' message
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code')
      expect(data.error).toBe('Table not found')
      expect(data.code).toBe('TABLE_NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-004: should include filters, sorts, and groupBy in response',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A view with filters, sorts, and groupBy configured
      // TODO: Setup kanban view with groupBy and filters

      // WHEN: User requests view details
      const response = await request.get('/api/tables/1/views/status_board', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: All view properties including filters, sorts, and groupBy should be included in response
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('type')
      expect(data).toHaveProperty('groupBy')
      expect(data).toHaveProperty('filters')
      expect(data.type).toBe('kanban')
      expect(data.groupBy.field).toBe('status')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-GET-005: should include fields array with visibility and order',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A calendar view with field configurations
      // TODO: Setup calendar view with fields array

      // WHEN: User requests view details
      const response = await request.get('/api/tables/1/views/project_timeline', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })

      // THEN: Fields array with visibility and order should be included in response
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('type')
      expect(data).toHaveProperty('fields')
      expect(data.type).toBe('calendar')
      expect(Array.isArray(data.fields)).toBe(true)
      expect(data.fields).toHaveLength(3)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'user can complete full view details workflow',
    { tag: '@regression' },
    async ({ request }) => {
      // GIVEN: Application with representative views
      // TODO: Setup table with multiple view types

      // WHEN/THEN: Streamlined workflow testing integration points
      // Test successful retrieval
      const successResponse = await request.get('/api/tables/1/views/active_projects', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })
      expect(successResponse.status()).toBe(200)
      const view = await successResponse.json()
      expect(view).toHaveProperty('id')
      expect(view).toHaveProperty('name')
      expect(view).toHaveProperty('type')

      // Test view not found
      const viewNotFoundResponse = await request.get('/api/tables/1/views/non_existent', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })
      expect(viewNotFoundResponse.status()).toBe(404)

      // Test table not found
      const tableNotFoundResponse = await request.get('/api/tables/9999/views/active_projects', {
        headers: {
          Authorization: 'Bearer test_token',
        },
      })
      expect(tableNotFoundResponse.status()).toBe(404)
    }
  )
})

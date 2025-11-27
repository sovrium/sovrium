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
 * Source: specs/api/paths/tables/{tableId}/views/get.json
 * Domain: api
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List table views', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-LIST-001: should return all views with complete configurations',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A table with configured views
      // Application configured for permission/view testing
      // Database and auth configured by test fixtures

      // WHEN: User requests list of views
      const response = await request.get('/api/tables/1/views', {})

      // THEN: All views should be returned with complete configurations
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(3)

      // Validate view schema
      for (const view of data) {
        // THEN: assertion
        expect(view).toHaveProperty('id')
        expect(view).toHaveProperty('name')
        expect(view).toHaveProperty('type')
        expect(typeof view.id).toBe('string')
        expect(typeof view.name).toBe('string')
        expect(typeof view.type).toBe('string')
      }
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-002: should return empty array',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A table with no views configured
      // Schema managed by application

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
    'API-TABLES-VIEWS-LIST-003: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A non-existent table ID
      // No setup needed

      // WHEN: User requests list of views
      const response = await request.get('/api/tables/9999/views', {})

      // THEN: 404 Not Found error should be returned
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-VIEWS-LIST-004: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A table with configured views
      // Schema managed by application

      // WHEN: Unauthenticated user requests list of views
      const response = await request.get('/api/tables/1/views')

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-VIEWS-LIST-005: user can complete full views list workflow',
    { tag: '@regression' },
    async ({ request }) => {
      // GIVEN: Application with representative views configuration
      // Application configured for permission/view testing
      // Database and auth configured by test fixturesntative views

      // WHEN/THEN: Streamlined workflow testing integration points
      // Test successful retrieval
      const successResponse = await request.get('/api/tables/1/views', {})
      // THEN: assertion
      expect(successResponse.status()).toBe(200)
      const views = await successResponse.json()
      // THEN: assertion
      expect(Array.isArray(views)).toBe(true)

      // Test not found error
      const notFoundResponse = await request.get('/api/tables/9999/views', {})
      // THEN: assertion
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})

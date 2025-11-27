/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable drizzle/enforce-delete-with-where */

/**
 * E2E Tests for Disabled Tables Endpoints
 *
 * Domain: api/tables
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Disabled Tables Scenarios:
 * - No tables config means no tables API endpoints available
 * - All tables routes return 404 when tables are not configured
 */

test.describe('Disabled Tables Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'API-TABLES-DISABLED-001: should return 404 for list tables endpoint when no tables configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        // No tables config - tables endpoints should be disabled
      })

      // WHEN: User attempts to list tables
      const response = await page.request.get('/api/tables')

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-DISABLED-002: should return 404 for get table endpoint when no tables configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        // No tables config - tables endpoints should be disabled
      })

      // WHEN: User attempts to get a specific table
      const response = await page.request.get('/api/tables/1')

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-DISABLED-003: should return 404 for records endpoints when no tables configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        // No tables config - tables endpoints should be disabled
      })

      // WHEN: User attempts to access records endpoint
      const response = await page.request.get('/api/tables/1/records')

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test.fixme(
    'API-TABLES-DISABLED-004: should return 404 for create record endpoint when no tables configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        // No tables config - tables endpoints should be disabled
      })

      // WHEN: User attempts to create a record
      const response = await page.request.post('/api/tables/1/records', {
        data: {
          name: 'Test Record',
        },
      })

      // THEN: Returns 404 Not Found (endpoint does not exist)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-TABLES-DISABLED-005: all tables endpoints should be disabled when no tables config',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        // No tables config - all tables endpoints should be disabled
      })

      // WHEN: User attempts to access various tables endpoints
      const tablesEndpoints = [
        { method: 'GET', path: '/api/tables' },
        { method: 'GET', path: '/api/tables/1' },
        { method: 'GET', path: '/api/tables/1/records' },
        { method: 'POST', path: '/api/tables/1/records' },
        { method: 'GET', path: '/api/tables/1/records/1' },
        { method: 'PATCH', path: '/api/tables/1/records/1' },
        { method: 'DELETE', path: '/api/tables/1/records/1' },
        { method: 'POST', path: '/api/tables/1/records/batch' },
        { method: 'PATCH', path: '/api/tables/1/records/batch' },
        { method: 'DELETE', path: '/api/tables/1/records/batch' },
      ]

      // THEN: All endpoints return 404 Not Found
      for (const endpoint of tablesEndpoints) {
        let response
        switch (endpoint.method) {
          case 'GET':
            response = await page.request.get(endpoint.path)
            break
          case 'POST':
            response = await page.request.post(endpoint.path, { data: {} })
            break
          case 'PATCH':
            response = await page.request.patch(endpoint.path, { data: {} })
            break
          case 'DELETE':
            response = await page.request.delete(endpoint.path)
            break
        }

        expect(response?.status()).toBe(404)
      }
    }
  )
})

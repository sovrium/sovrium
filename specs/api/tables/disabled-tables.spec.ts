/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Tables Endpoints When No Tables Configured
 *
 * Domain: api/tables
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * No Tables Configured Scenarios:
 * - API requires authentication (returns 401 without auth)
 * - List tables returns 200 with empty array when no tables configured
 * - Specific table endpoints return 404 (table not found) when no tables configured
 */

test.describe('Disabled Tables Endpoints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'API-TABLES-DISABLED-001: should return 200 with empty array for list tables endpoint when no tables configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Server with auth enabled but no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        // No tables config - tables list returns empty array
      })

      // Create authenticated user (required for API access)
      await createAuthenticatedUser()

      // WHEN: Authenticated user requests list of tables
      const response = await request.get('/api/tables')

      // THEN: Returns 200 OK with empty array (no tables configured)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  test(
    'API-TABLES-DISABLED-002: should return 404 for get table endpoint when no tables configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Server with auth enabled but no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        // No tables config - specific table returns 404
      })

      // Create authenticated user (required for API access)
      await createAuthenticatedUser()

      // WHEN: Authenticated user attempts to get a specific table
      const response = await request.get('/api/tables/1')

      // THEN: Returns 404 Not Found (table does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-TABLES-DISABLED-003: should return 404 for records endpoints when no tables configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Server with auth enabled but no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        // No tables config - records endpoint returns 404 (table not found)
      })

      // Create authenticated user (required for API access)
      await createAuthenticatedUser()

      // WHEN: Authenticated user attempts to access records endpoint
      const response = await request.get('/api/tables/1/records')

      // THEN: Returns 404 Not Found (table does not exist)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-TABLES-DISABLED-004: should return 404 for create record endpoint when no tables configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Server with auth enabled but no tables configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        // No tables config - create record returns 404 (table not found)
      })

      // Create authenticated user (required for API access)
      await createAuthenticatedUser()

      // WHEN: Authenticated user attempts to create a record
      const response = await request.post('/api/tables/1/records', {
        data: {
          name: 'Test Record',
        },
      })

      // THEN: Returns 404 Not Found (table does not exist)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-TABLES-DISABLED-REGRESSION: all tables endpoints should be disabled when no tables config',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // Setup: Start server with auth enabled but no tables config
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        // No tables config - tables list returns empty array, specific tables return 404
      })

      // Create authenticated user (required for API access)
      await createAuthenticatedUser()

      await test.step('API-TABLES-DISABLED-001: Returns 200 with empty array for list tables endpoint when no tables configured', async () => {
        // WHEN: Authenticated user requests list of tables
        const response = await request.get('/api/tables')

        // THEN: Returns 200 OK with empty array (no tables configured)
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBe(0)
      })

      await test.step('API-TABLES-DISABLED-002: Returns 404 for get table endpoint when no tables configured', async () => {
        // WHEN: Authenticated user attempts to get a specific table
        const response = await request.get('/api/tables/1')

        // THEN: Returns 404 Not Found (table does not exist)
        expect(response.status()).toBe(404)
      })

      await test.step('API-TABLES-DISABLED-003: Returns 404 for records endpoints when no tables configured', async () => {
        // WHEN: Authenticated user attempts to access records endpoint
        const response = await request.get('/api/tables/1/records')

        // THEN: Returns 404 Not Found (table does not exist)
        expect(response.status()).toBe(404)
      })

      await test.step('API-TABLES-DISABLED-004: Returns 404 for create record endpoint when no tables configured', async () => {
        // WHEN: Authenticated user attempts to create a record
        const response = await request.post('/api/tables/1/records', {
          data: {
            name: 'Test Record',
          },
        })

        // THEN: Returns 404 Not Found (table does not exist)
        expect(response.status()).toBe(404)
      })
    }
  )
})

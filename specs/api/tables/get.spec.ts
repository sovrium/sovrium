/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List all tables
 *
 * Source: specs/api/paths/tables/get.json
 * Domain: api
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List all tables', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-LIST-001: should return 200 OK with array of tables',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with tables configured
      // Database tables will be created by the application layer
      // Tests verify API responses match database state

      // WHEN: User requests list of all tables
      const response = await request.get('/api/tables', {})

      // THEN: Response should be 200 OK with array of tables
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(2)

      // Validate schema structure
      for (const table of data) {
        // THEN: assertion
        expect(table).toHaveProperty('id')
        expect(table).toHaveProperty('name')
        expect(table).toHaveProperty('fields')
        expect(typeof table.id).toBe('number')
        expect(typeof table.name).toBe('string')
        expect(Array.isArray(table.fields)).toBe(true)
      }
    }
  )

  test.fixme(
    'API-TABLES-LIST-002: should return 200 OK with empty array',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with no tables
      // Application starts with clean slate for this test

      // WHEN: User requests list of all tables
      const response = await request.get('/api/tables', {})

      // THEN: Response should be 200 OK with empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  test.fixme(
    'API-TABLES-LIST-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server
      // No special setup needed

      // WHEN: Unauthenticated user requests list of tables
      const response = await request.get('/api/tables')

      // THEN: Response should be 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
      expect(typeof data.error).toBe('string')
      expect(typeof data.message).toBe('string')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-LIST-004: user can complete full tables list workflow',
    { tag: '@regression' },
    async ({ request }) => {
      await test.step('List tables with authentication', async () => {
        const authResponse = await request.get('/api/tables', {})

        expect(authResponse.status()).toBe(200)
        const tables = await authResponse.json()
        expect(Array.isArray(tables)).toBe(true)
      })

      await test.step('Verify unauthenticated access fails', async () => {
        const unauthResponse = await request.get('/api/tables')
        expect(unauthResponse.status()).toBe(401)
      })
    }
  )
})

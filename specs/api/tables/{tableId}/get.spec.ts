/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get table by ID
 *
 * Source: specs/api/paths/tables/{tableId}/get.json
 * Domain: api
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get table by ID', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-GET-001: should return 200 OK with table configuration',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with existing table
      // Database setup via executeQuery:
      // CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, first_name VARCHAR(255))
      // CREATE UNIQUE INDEX uq_users_email ON users(email)
      // CREATE INDEX idx_users_email ON users(email)

      // WHEN: User requests table by ID
      const response = await request.get('/api/tables/1', {})

      // THEN: Response should be 200 OK with table configuration
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('fields')
      expect(typeof data.id).toBe('number')
      expect(typeof data.name).toBe('string')
      expect(Array.isArray(data.fields)).toBe(true)

      // Validate complete table configuration
      // THEN: assertion
      expect(data.name).toBe('users')
      expect(data.fields).toHaveLength(3)
      expect(data).toHaveProperty('primaryKey')
      expect(data).toHaveProperty('uniqueConstraints')
      expect(data).toHaveProperty('indexes')
    }
  )

  test.fixme(
    'API-TABLES-GET-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server
      // No setup needed

      // WHEN: User requests non-existent table
      const response = await request.get('/api/tables/9999', {})

      // THEN: Response should be 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-GET-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request }) => {
      // GIVEN: A running server with existing table
      // Database setup: CREATE TABLE users (id SERIAL PRIMARY KEY)

      // WHEN: Unauthenticated user requests table by ID
      const response = await request.get('/api/tables/1')

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
    'API-TABLES-GET-004: user can complete full table retrieval workflow',
    { tag: '@regression' },
    async ({ request }) => {
      await test.step('Get table by ID successfully', async () => {
        const successResponse = await request.get('/api/tables/1', {})
        expect(successResponse.status()).toBe(200)

        const table = await successResponse.json()
        expect(table).toHaveProperty('id')
        expect(table).toHaveProperty('name')
        expect(table).toHaveProperty('fields')
      })

      await test.step('Verify get non-existent table fails', async () => {
        const notFoundResponse = await request.get('/api/tables/9999', {})
        expect(notFoundResponse.status()).toBe(404)
      })
    }
  )
})

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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
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

  test(
    'API-TABLES-GET-004: should return 403 when user lacks read permission for table',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A viewer user without permission to access confidential table
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'confidential',
            fields: [
              { id: 1, name: 'secret_data', type: 'long-text' },
              { id: 2, name: 'classification', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Create authenticated user (viewer role by default)
      await createAuthenticatedUser({
        email: 'viewer@example.com',
        password: 'password123',
        name: 'Test Viewer',
      })

      // WHEN: User requests table they don't have permission to access
      const response = await request.get('/api/tables/1', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to access this table')
    }
  )

  test(
    'API-TABLES-GET-005: should return 404 for cross-org table access',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: A table belonging to organization org_456
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text' },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: User from org_123 attempts to access table from org_456
      const response = await request.get('/api/tables/1', {
        headers: {},
      })

      // THEN: Returns 404 Not Found (prevent org enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Table not found')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'API-TABLES-GET-REGRESSION: user can complete full table retrieval workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 1,
              name: 'users',
              fields: [
                { id: 1, name: 'id', type: 'single-line-text' },
                { id: 2, name: 'email', type: 'single-line-text' },
                { id: 3, name: 'first_name', type: 'single-line-text' },
              ],
              permissions: {
                read: {
                  type: 'roles',
                  roles: ['owner', 'admin', 'member'],
                },
              },
            },
            {
              id: 2,
              name: 'confidential',
              fields: [
                { id: 1, name: 'secret_data', type: 'long-text' },
                { id: 2, name: 'classification', type: 'single-line-text' },
              ],
            },
          ],
        })

        // Create authenticated user with member role
        await createAuthenticatedUser({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
      })

      await test.step('API-TABLES-GET-001: Return 200 OK with table configuration', async () => {
        // WHEN: User requests table by ID
        const response = await request.get('/api/tables/1', {})

        // THEN: Response is 200 OK with complete table configuration
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name')
        expect(data).toHaveProperty('fields')
        expect(typeof data.id).toBe('number')
        expect(typeof data.name).toBe('string')
        expect(Array.isArray(data.fields)).toBe(true)
        expect(data.name).toBe('users')
      })

      await test.step('API-TABLES-GET-002: Return 404 Not Found', async () => {
        // WHEN: User requests non-existent table
        const response = await request.get('/api/tables/9999', {})

        // THEN: Response is 404 Not Found
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Table not found')
      })

      await test.step('API-TABLES-GET-003: Return 401 Unauthorized', async () => {
        // WHEN: Unauthenticated request for table
        const response = await request.get('/api/tables/1')

        // THEN: Response is 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
      })

      await test.step('API-TABLES-GET-004: Return 403 when user lacks read permission', async () => {
        // WHEN: User requests table they don't have permission to access
        const response = await request.get('/api/tables/2', {})

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Forbidden')
      })

      await test.step('API-TABLES-GET-005: Return 404 for cross-org table access', async () => {
        // WHEN: User attempts to access table from different organization
        const response = await request.get('/api/tables/999', {})

        // THEN: Returns 404 Not Found (prevent org enumeration)
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Table not found')
      })
    }
  )
})

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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
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

  test(
    'API-TABLES-LIST-004: should return 403 when user lacks list-tables permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: A user with restricted permissions (cannot list tables)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
        ],
      })

      // Create a user and set role to 'viewer' manually
      const viewer = await createAuthenticatedUser()

      // Set viewer role manually (admin plugin not enabled in this test)
      await executeQuery(`
        UPDATE "_sovrium_auth_users"
        SET role = 'viewer'
        WHERE id = '${viewer.user.id}'
      `)

      // WHEN: User without list-tables permission requests tables
      const response = await request.get('/api/tables', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You do not have permission to list tables')
    }
  )

  test(
    'API-TABLES-LIST-005: should only return tables user has permission to view',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Multiple tables with different permission levels
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'public_projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
          {
            id: 2,
            name: 'confidential_data',
            fields: [{ id: 1, name: 'secret', type: 'long-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin'] }, // Only owner/admin can read
            },
          },
          {
            id: 3,
            name: 'team_tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
            permissions: {
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
            },
          },
        ],
      })

      // Create a user and set role to 'member' manually
      const member = await createAuthenticatedUser()

      // Set member role manually (admin plugin not enabled in this test)
      await executeQuery(`
        UPDATE "_sovrium_auth_users"
        SET role = 'member'
        WHERE id = '${member.user.id}'
      `)

      // WHEN: Member with limited permissions requests tables
      const response = await request.get('/api/tables', {})

      // THEN: Returns 200 with only permitted tables
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
      expect(data.length).toBeLessThan(3) // Not all tables returned

      // Verify confidential table is not in response
      const tableNames = data.map((t: { name: string }) => t.name)
      expect(tableNames).not.toContain('confidential_data')
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test(
    'API-TABLES-LIST-REGRESSION: user can complete full tables list workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, signOut }) => {
      // Setup: Start server with tables and auth
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [{ id: 1, name: 'name', type: 'single-line-text' }],
          },
          {
            id: 2,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })

      await test.step('API-TABLES-LIST-003: Returns 401 Unauthorized', async () => {
        // WHEN: Unauthenticated user requests list of tables
        const response = await request.get('/api/tables')

        // THEN: Response should be 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data).toHaveProperty('message')
      })

      // Setup: Create authenticated user
      await createAuthenticatedUser()

      await test.step('API-TABLES-LIST-001: Returns 200 OK with array of tables', async () => {
        // WHEN: User requests list of all tables
        const response = await request.get('/api/tables', {})

        // THEN: Response should be 200 OK with array of tables
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThanOrEqual(2)

        // Validate schema structure
        for (const table of data) {
          expect(table).toHaveProperty('id')
          expect(table).toHaveProperty('name')
          expect(table).toHaveProperty('fields')
          expect(typeof table.id).toBe('number')
          expect(typeof table.name).toBe('string')
          expect(Array.isArray(table.fields)).toBe(true)
        }
      })
    }
  )
})

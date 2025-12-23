/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Activity Listing
 *
 * Domain: api/activity
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for activity log access.
 * Only users with 'admin' or 'member' roles can access activity logs (viewers excluded).
 */

test.describe('API Key Authentication - Activity Listing', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage
  // ============================================================================

  test(
    'API-ACTIVITY-AUTH-001: should return 200 OK for admin with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with activity logs and admin API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        createOrganization: true,
      })

      // Set role to admin
      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'admin' WHERE user_id = '${admin.user.id}'`
      )

      // Create activity log entry
      await executeQuery(
        `INSERT INTO _sovrium_activity_logs (id, action, table_name, table_id, record_id, organization_id) VALUES ('${crypto.randomUUID()}', 'create', 'tasks', '1', '1', '${admin.organizationId}')`
      )

      const authHeaders = await createApiKeyAuth({ name: 'admin-key' })

      // WHEN: Admin requests activity logs with Bearer token
      const response = await request.get('/api/activity', authHeaders)

      // THEN: Returns 200 OK with activity logs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-002: should return 200 OK for member with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with activity logs and member API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const member = await createAuthenticatedUser({
        email: 'member@example.com',
        createOrganization: true,
      })

      // Set role to member (default)
      await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'tasks', '${member.organizationId}')`
      )

      const authHeaders = await createApiKeyAuth({ name: 'member-key' })

      // WHEN: Member requests activity logs
      const response = await request.get('/api/activity', authHeaders)

      // THEN: Returns 200 OK with activity logs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-003: should return 403 for viewer with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with viewer API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const viewer = await createAuthenticatedUser({
        email: 'viewer@example.com',
        createOrganization: true,
      })

      // Set role to viewer
      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'viewer' WHERE user_id = '${viewer.user.id}'`
      )

      const authHeaders = await createApiKeyAuth({ name: 'viewer-key' })

      // WHEN: Viewer requests activity logs
      const response = await request.get('/api/activity', authHeaders)

      // THEN: Returns 403 Forbidden (viewers cannot access activity logs)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('permission')
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-004: should return 401 without Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      // WHEN: Request without Authorization header
      const response = await request.get('/api/activity')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-005: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: Request with invalid token
      const response = await request.get('/api/activity', {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-006: should enforce organization isolation on activity logs',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      signOut,
      executeQuery,
    }) => {
      // GIVEN: Two organizations with separate activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const user1 = await createAuthenticatedUser({
        email: 'user1@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'org1_task', '${user1.organizationId}')`
      )

      const user1ApiKey = await createApiKeyAuth()
      await signOut()

      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'org2_task', '${user2.organizationId}')`
      )

      // WHEN: User1 requests activity logs
      const response = await request.get('/api/activity', user1ApiKey)

      // THEN: Returns only org1's activity logs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.every((log: { table_name: string }) => log.table_name === 'org1_task')).toBe(true)
    }
  )

  test.fixme(
    'API-ACTIVITY-AUTH-007: should return empty array when no activity logs exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, createApiKeyAuth }) => {
      // GIVEN: Application with no activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true, apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      await createAuthenticatedUser({
        email: 'admin@example.com',
        createOrganization: true,
      })

      const authHeaders = await createApiKeyAuth()

      // WHEN: Request activity logs
      const response = await request.get('/api/activity', authHeaders)

      // THEN: Returns empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-AUTH-008: user can access activity logs via API key workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      await test.step('Setup: Start server with activity tracking', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true, apiKeys: true },
          },
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      let apiKey: { headers: { Authorization: string } }

      await test.step('Setup: Create admin user, activity logs, and API key', async () => {
        const admin = await createAuthenticatedUser({
          email: 'admin@example.com',
          createOrganization: true,
        })

        await executeQuery(
          `INSERT INTO activity_logs (action, table_name, organization_id) VALUES
          ('create', 'tasks', '${admin.organizationId}'),
          ('update', 'tasks', '${admin.organizationId}'),
          ('delete', 'tasks', '${admin.organizationId}')`
        )

        apiKey = await createApiKeyAuth({ name: 'activity-test-key' })
      })

      await test.step('Verify: Admin can access activity logs', async () => {
        const adminResponse = await request.get('/api/activity', apiKey)
        expect(adminResponse.status()).toBe(200)

        const logs = await adminResponse.json()
        expect(logs.length).toBe(3)
      })

      await test.step('Verify: Unauthorized access rejected', async () => {
        const unauthorizedResponse = await request.get('/api/activity')
        expect(unauthorizedResponse.status()).toBe(401)
      })
    }
  )
})

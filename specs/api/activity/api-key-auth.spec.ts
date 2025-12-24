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
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - Endpoint-specific authentication behaviors (4 tests)
 * 2. @regression test - ONE optimized integration test - Activity listing workflow
 *
 * NOTE: Core authentication error scenarios (401 without auth, invalid token,
 * malformed token, expired key, disabled key, non-Bearer scheme) are tested
 * in specs/api/auth/api-key/core-authentication.spec.ts to avoid redundancy.
 *
 * This file focuses on:
 * - Valid API key returns activity logs (endpoint-specific response)
 * - Role-based access (admin/member can access, viewer cannot)
 * - Organization isolation (RLS layer enforcement)
 */

test.describe('API Key Authentication - Activity Listing', () => {
  // ============================================================================
  // @spec tests - ENDPOINT-SPECIFIC authentication behaviors
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

  test(
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
        `INSERT INTO _sovrium_activity_logs (id, action, table_name, table_id, record_id, organization_id) VALUES ('${crypto.randomUUID()}', 'create', 'tasks', '1', '1', '${member.organizationId}')`
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

  test(
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
    'API-ACTIVITY-AUTH-004: should enforce organization isolation on activity logs',
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
        `INSERT INTO _sovrium_activity_logs (action, table_name, organization_id) VALUES ('create', 'org1_task', '${user1.organizationId}')`
      )

      const user1ApiKey = await createApiKeyAuth()
      await signOut()

      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      await executeQuery(
        `INSERT INTO _sovrium_activity_logs (action, table_name, organization_id) VALUES ('create', 'org2_task', '${user2.organizationId}')`
      )

      // WHEN: User1 requests activity logs
      const response = await request.get('/api/activity', user1ApiKey)

      // THEN: Returns only org1's activity logs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.every((log: { table_name: string }) => log.table_name === 'org1_task')).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-AUTH-005: user can access activity logs via API key workflow',
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
          `INSERT INTO _sovrium_activity_logs (action, table_name, organization_id) VALUES
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
    }
  )
})

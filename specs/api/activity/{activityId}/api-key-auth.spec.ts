/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Authentication - Single Activity
 *
 * Domain: api/activity/{activityId}
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key authentication for single activity log retrieval.
 * Only users with 'admin' or 'member' roles can access activity logs (viewers excluded).
 */

test.describe('API Key Authentication - Single Activity', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-GET-AUTH-001: should return 200 OK for admin with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with activity log and admin API key
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

      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'admin' WHERE user_id = '${admin.user.id}'`
      )

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'tasks', '${admin.organizationId}') RETURNING id`
      )

      const authHeaders = await createApiKeyAuth()

      // WHEN: Admin requests single activity log
      const response = await request.get(`/api/activity/${activityId.id}`, authHeaders)

      // THEN: Returns 200 OK with activity log
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(activityId.id)
      expect(data.action).toBe('create')
    }
  )

  test.fixme(
    'API-ACTIVITY-GET-AUTH-002: should return 200 OK for member with valid Bearer token',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with activity log and member API key
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

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('update', 'tasks', '${member.organizationId}') RETURNING id`
      )

      const authHeaders = await createApiKeyAuth()

      // WHEN: Member requests activity log
      const response = await request.get(`/api/activity/${activityId.id}`, authHeaders)

      // THEN: Returns 200 OK with activity log
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(activityId.id)
    }
  )

  test.fixme(
    'API-ACTIVITY-GET-AUTH-003: should return 403 for viewer with valid Bearer token',
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

      await executeQuery(
        `UPDATE _sovrium_auth_members SET role = 'viewer' WHERE user_id = '${viewer.user.id}'`
      )

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('delete', 'tasks', '${viewer.organizationId}') RETURNING id`
      )

      const authHeaders = await createApiKeyAuth()

      // WHEN: Viewer requests activity log
      const response = await request.get(`/api/activity/${activityId.id}`, authHeaders)

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.message).toContain('permission')
    }
  )

  test.fixme(
    'API-ACTIVITY-GET-AUTH-004: should return 401 without Authorization header',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application with activity log
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

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name) VALUES ('create', 'tasks') RETURNING id`
      )

      // WHEN: Request without auth
      const response = await request.get(`/api/activity/${activityId.id}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ACTIVITY-GET-AUTH-005: should return 401 with invalid Bearer token',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activity log
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

      const user = await createAuthenticatedUser({
        email: 'user@example.com',
        createOrganization: true,
      })

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'tasks', '${user.organizationId}') RETURNING id`
      )

      // WHEN: Request with invalid token
      const response = await request.get(`/api/activity/${activityId.id}`, {
        headers: { Authorization: 'Bearer invalid-token' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ACTIVITY-GET-AUTH-006: should return 404 for cross-organization activity access',
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

      const user1ApiKey = await createApiKeyAuth()
      await signOut()

      const user2 = await createAuthenticatedUser({
        email: 'user2@example.com',
        createOrganization: true,
      })

      const org2ActivityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id) VALUES ('create', 'tasks', '${user2.organizationId}') RETURNING id`
      )

      // WHEN: User1 tries to access org2's activity log
      const response = await request.get(`/api/activity/${org2ActivityId.id}`, user1ApiKey)

      // THEN: Returns 404 (not 403) to prevent enumeration
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-GET-AUTH-007: user can access single activity log via API key',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createApiKeyAuth,
      executeQuery,
    }) => {
      // GIVEN: Application with activity log
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

      // WHEN/THEN: Complete workflow
      const admin = await createAuthenticatedUser({
        email: 'admin@example.com',
        createOrganization: true,
      })

      const activityId = await executeQuery(
        `INSERT INTO activity_logs (action, table_name, organization_id, changes) VALUES
        ('create', 'tasks', '${admin.organizationId}', '{"title": "New Task"}') RETURNING id`
      )

      const apiKey = await createApiKeyAuth({ name: 'activity-detail-key' })

      // Admin can access activity log
      const adminResponse = await request.get(`/api/activity/${activityId.id}`, apiKey)
      expect(adminResponse.status()).toBe(200)

      const log = await adminResponse.json()
      expect(log.action).toBe('create')
      expect(log.table_name).toBe('tasks')

      // Unauthorized access rejected
      const unauthorizedResponse = await request.get(`/api/activity/${activityId.id}`)
      expect(unauthorizedResponse.status()).toBe(401)

      // Invalid token rejected
      const invalidResponse = await request.get(`/api/activity/${activityId.id}`, {
        headers: { Authorization: 'Bearer invalid-token' },
      })
      expect(invalidResponse.status()).toBe(401)
    }
  )
})

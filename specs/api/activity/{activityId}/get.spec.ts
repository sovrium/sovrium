/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get Activity Log Details
 *
 * Source: specs/api/activity/{activityId}/get.spec.ts
 * Domain: api
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (8 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/activity/:activityId - Get Activity Log Details', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-DETAILS-001: should return 200 with activity details',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with a specific activity log
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const { user } = await createAuthenticatedUser()

      const activityResult = await executeQuery(`
        INSERT INTO _sovrium_activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1", "priority": 5}', NOW())
        RETURNING id
      `)
      const activityId = activityResult.id

      // WHEN: User requests specific activity details
      const response = await page.request.get(`/api/activity/${activityId}`)

      // THEN: Returns 200 with complete activity details
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', activityId)
      expect(data).toHaveProperty('userId', user.id)
      expect(data).toHaveProperty('action', 'create')
      expect(data).toHaveProperty('tableName', 'tasks')
      expect(data).toHaveProperty('recordId', 1)
      expect(data).toHaveProperty('changes')
      expect(data.changes).toEqual({ title: 'Task 1', priority: 5 })
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled but user not signed in
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })

      // WHEN: Unauthenticated user requests activity details
      const response = await page.request.get('/api/activity/123')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-003: should return 404 when activity does not exist',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user but no activity with ID 99999
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })

      await createAuthenticatedUser()

      // WHEN: User requests non-existent activity
      const response = await page.request.get('/api/activity/99999')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-004: should return 403 when user tries to access cross-org activity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Multi-tenant application with activities in different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user1@org1.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@org2.com' })

      // Create activity in org2
      const activityResult = await executeQuery(`
        INSERT INTO _sovrium_activity_logs (user_id, action, table_name, record_id, changes, organization_id, created_at)
        VALUES ('${user2.user.id}', 'create', 'tasks', 1, '{"title": "Org2 Task"}', 'org2', NOW())
        RETURNING id
      `)
      const activityId = activityResult.id

      // Sign in as user1 (org1)
      // Note: createAuthenticatedUser already signs in the user

      // WHEN: User1 (org1) tries to access org2 activity
      const response = await page.request.get(`/api/activity/${activityId}`)

      // THEN: Returns 403 Forbidden or 404 (organization isolation)
      expect([403, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-005: should include user metadata in activity details',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activity log and user information
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const { user } = await createAuthenticatedUser({ name: 'Bob Smith' })

      const activityResult = await executeQuery(`
        INSERT INTO _sovrium_activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Old", "new": "New"}}', NOW())
        RETURNING id
      `)
      const activityId = activityResult.id

      // WHEN: User requests activity details
      const response = await page.request.get(`/api/activity/${activityId}`)

      // THEN: Activity includes user metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.name).toBe('Bob Smith')
      expect(data.user.email).toBe(user.email)
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-006: should return activity with null changes for delete action',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with delete activity log
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const { user } = await createAuthenticatedUser()

      const activityResult = await executeQuery(`
        INSERT INTO _sovrium_activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES ('${user.id}', 'delete', 'tasks', 1, NULL, NOW())
        RETURNING id
      `)
      const activityId = activityResult.id

      // WHEN: User requests delete activity details
      const response = await page.request.get(`/api/activity/${activityId}`)

      // THEN: Returns activity with null changes
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.action).toBe('delete')
      expect(data.changes).toBeNull()
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-007: should return 400 when activityId is invalid format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })

      await createAuthenticatedUser()

      // WHEN: User requests activity with invalid ID format
      const response = await page.request.get('/api/activity/invalid-id')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-ACTIVITY-DETAILS-008: should return 401 Unauthorized when auth is not configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application WITHOUT auth configured
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
        // NOTE: No auth field - activity endpoints still require authentication
      })

      // WHEN: Unauthenticated user requests activity details
      const response = await page.request.get('/api/activity/123')

      // THEN: Returns 401 Unauthorized (activity APIs always require auth)
      expect(response.status()).toBe(401)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-DETAILS-009: user can retrieve specific activity with full metadata',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      await test.step('Setup: Start server with activity logging', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
          tables: [
            {
              id: 1,
              name: 'tasks',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
                { id: 3, name: 'status', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      let activityId: number
      let userId: string

      await test.step('Create activity log', async () => {
        const { user } = await createAuthenticatedUser({ name: 'Charlie Davis' })
        userId = user.id

        const result = await executeQuery(`
          INSERT INTO _sovrium_activity_logs (user_id, action, table_name, record_id, changes, created_at)
          VALUES (
            '${userId}',
            'update',
            'tasks',
            42,
            '{"status": {"old": "pending", "new": "completed"}, "updatedAt": "2025-12-16T10:00:00Z"}',
            NOW()
          )
          RETURNING id
        `)
        activityId = result.id
      })

      await test.step('Retrieve activity details with full metadata', async () => {
        const response = await page.request.get(`/api/activity/${activityId}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.id).toBe(activityId)
        expect(data.action).toBe('update')
        expect(data.tableName).toBe('tasks')
        expect(data.recordId).toBe(42)
        expect(data.changes.status.old).toBe('pending')
        expect(data.changes.status.new).toBe('completed')
        expect(data.user.name).toBe('Charlie Davis')
        expect(data.user.id).toBe(userId)
      })

      await test.step('Verify 404 for non-existent activity', async () => {
        const response = await page.request.get('/api/activity/99999')
        expect(response.status()).toBe(404)
      })
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List Activity Logs
 *
 * Source: specs/api/activity/get.spec.ts
 * Domain: api
 * Spec Count: 19
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (19 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/activity - List Activity Logs', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-ACTIVITY-LIST-001: should return 200 with paginated activity logs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with audit logging enabled and multiple activities
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      // Create activity logs via direct database insertion
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Task 1", "new": "Updated Task 1"}}', NOW() - INTERVAL '3 minutes'),
          ('${user.id}', 'delete', 'tasks', 1, NULL, NOW() - INTERVAL '1 minute')
      `)

      // WHEN: User requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns 200 with paginated activity logs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('activities')
      expect(data).toHaveProperty('pagination')
      expect(data.activities).toHaveLength(3)
      expect(data.pagination.total).toBe(3)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBe(50)
    }
  )

  test(
    'API-ACTIVITY-LIST-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled but user not signed in
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      // WHEN: Unauthenticated user requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test(
    'API-ACTIVITY-LIST-003: should return activities filtered by table name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities across multiple tables
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const { user } = await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW()),
          ('${user.id}', 'create', 'tasks', 2, '{"title": "Task 2"}', NOW()),
          ('${user.id}', 'create', 'projects', 1, '{"name": "Project 1"}', NOW())
      `)

      // WHEN: User requests activities filtered by table name 'tasks'
      const response = await page.request.get('/api/activity?tableName=tasks')

      // THEN: Returns only activities for 'tasks' table
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.tableName === 'tasks')).toBe(true)
    }
  )

  test(
    'API-ACTIVITY-LIST-004: should return activities filtered by action type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities of different action types
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW()),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Task 1", "new": "Updated"}}', NOW()),
          ('${user.id}', 'update', 'tasks', 2, '{"title": {"old": "Task 2", "new": "Updated 2"}}', NOW()),
          ('${user.id}', 'delete', 'tasks', 3, NULL, NOW())
      `)

      // WHEN: User requests activities filtered by action type 'update'
      const response = await page.request.get('/api/activity?action=update')

      // THEN: Returns only 'update' activities
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.action === 'update')).toBe(true)
    }
  )

  test(
    'API-ACTIVITY-LIST-005: should return activities filtered by user ID',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities from multiple users
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user1.user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW()),
          ('${user1.user.id}', 'create', 'tasks', 2, '{"title": "Task 2"}', NOW()),
          ('${user2.user.id}', 'create', 'tasks', 3, '{"title": "Task 3"}', NOW())
      `)

      // WHEN: User requests activities filtered by user1's ID
      const response = await page.request.get(`/api/activity?userId=${user1.user.id}`)

      // THEN: Returns only user1's activities
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.userId === user1.user.id)).toBe(true)
    }
  )

  test(
    'API-ACTIVITY-LIST-006: should return activities filtered by date range',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities across different time periods
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Old Task"}', NOW() - INTERVAL '10 days'),
          ('${user.id}', 'create', 'tasks', 2, '{"title": "Recent Task"}', NOW() - INTERVAL '2 days'),
          ('${user.id}', 'create', 'tasks', 3, '{"title": "Today Task"}', NOW())
      `)

      // WHEN: User requests activities from last 3 days
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const response = await page.request.get(`/api/activity?startDate=${startDate}`)

      // THEN: Returns only activities within date range
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-007: should return activities sorted by creation date descending',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with multiple activities at different times
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "First"}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'create', 'tasks', 2, '{"title": "Second"}', NOW() - INTERVAL '3 minutes'),
          ('${user.id}', 'create', 'tasks', 3, '{"title": "Third"}', NOW() - INTERVAL '1 minute')
      `)

      // WHEN: User requests activities (default sorting)
      const response = await page.request.get('/api/activity')

      // THEN: Returns activities sorted by creation date descending (newest first)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(3)
      expect(new Date(data.activities[0].createdAt).getTime()).toBeGreaterThan(
        new Date(data.activities[1].createdAt).getTime()
      )
      expect(new Date(data.activities[1].createdAt).getTime()).toBeGreaterThan(
        new Date(data.activities[2].createdAt).getTime()
      )
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-008: should support pagination with page and pageSize parameters',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with 25 activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      // Create 25 activity logs
      const insertValues = Array.from(
        { length: 25 },
        (_, i) => `('${user.id}', 'create', 'tasks', ${i + 1}, '{"title": "Task ${i + 1}"}', NOW())`
      ).join(',')
      await executeQuery(
        `INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at) VALUES ${insertValues}`
      )

      // WHEN: User requests page 2 with pageSize 10
      const response = await page.request.get('/api/activity?page=2&pageSize=10')

      // THEN: Returns correct page with pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(10)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.pageSize).toBe(10)
      expect(data.pagination.total).toBe(25)
      expect(data.pagination.totalPages).toBe(3)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-009: should return empty array when no activities exist',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with no activity logs
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      await createAuthenticatedUser()

      // WHEN: User requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns empty array with pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(0)
      expect(data.pagination.total).toBe(0)
      expect(data.pagination.totalPages).toBe(0)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-010: should return 400 when page parameter is invalid',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      await createAuthenticatedUser()

      // WHEN: User requests with invalid page parameter
      const response = await page.request.get('/api/activity?page=-1')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-011: should return 400 when pageSize exceeds maximum',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      await createAuthenticatedUser()

      // WHEN: User requests with pageSize > 100
      const response = await page.request.get('/api/activity?pageSize=200')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-012: should include user metadata in activity logs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities and user information
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      const { user } = await createAuthenticatedUser({ name: 'Alice Johnson' })

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW())
      `)

      // WHEN: User requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Activity includes user metadata (name, email)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(1)
      expect(data.activities[0]).toHaveProperty('user')
      expect(data.activities[0].user.name).toBe('Alice Johnson')
      expect(data.activities[0].user.email).toBe(user.email)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-013: should exclude activities older than 1 year (retention policy)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with activities older and newer than 1 year
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Old Activity"}', NOW() - INTERVAL '400 days'),
          ('${user.id}', 'create', 'tasks', 2, '{"title": "Recent Activity"}', NOW() - INTERVAL '30 days'),
          ('${user.id}', 'create', 'tasks', 3, '{"title": "Today Activity"}', NOW())
      `)

      // WHEN: User requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns only activities within 1 year retention period
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.recordId !== 1)).toBe(true)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-014: should return 400 when action filter has invalid value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      await createAuthenticatedUser()

      // WHEN: User requests with invalid action type
      const response = await page.request.get('/api/activity?action=invalid_action')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test(
    'API-ACTIVITY-LIST-015: should return 401 Unauthorized when auth is not configured',
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

      // WHEN: Unauthenticated user requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns 401 Unauthorized (activity APIs always require auth)
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-016: should include null user metadata for system-logged activities',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Application with auth enabled and system-logged activities
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      // System-logged activities (e.g., automated background processes) have null user_id
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          (NULL, 'create', 'tasks', 1, '{"title": "System-created Task"}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "System-created Task", "new": "User-updated Task"}}', NOW())
      `)

      // WHEN: Authenticated user requests activity logs
      const response = await page.request.get('/api/activity')

      // THEN: Returns all activities with null user metadata for system-logged entries
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities[0].user).toBeNull()
      expect(data.activities[1].user).not.toBeNull()
      expect(data.activities[1].user.id).toBe(user.id)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-017: should allow non-admin user to filter by their own userId',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Regular user with their own activities
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "My Task"}', NOW()),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "My Task", "new": "Updated Task"}}', NOW())
      `)

      // WHEN: User filters activities by their own userId
      const response = await page.request.get(`/api/activity?userId=${user.id}`)

      // THEN: Returns their activities successfully
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.userId === user.id)).toBe(true)
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-018: should return 403 when non-admin filters by another users userId',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Two regular users with separate activities
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user1.user.id}', 'create', 'tasks', 1, '{"title": "User1 Task"}', NOW()),
          ('${user2.user.id}', 'create', 'tasks', 2, '{"title": "User2 Task"}', NOW())
      `)

      // Sign in as user1 (need to re-authenticate as user1, since user2 is currently authenticated)
      // Note: Implementation detail - test assumes proper session management

      // WHEN: User1 tries to filter by user2's userId
      const response = await page.request.get(`/api/activity?userId=${user2.user.id}`)

      // THEN: Returns 403 Forbidden (non-admin cannot view other users' activities)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-ACTIVITY-LIST-019: should allow admin to filter by any userId',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createAuthenticatedUser,
      executeQuery,
    }) => {
      // GIVEN: Admin user and regular user with activities
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      const regularUser = await createAuthenticatedUser({ email: 'regular@example.com' })
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${regularUser.user.id}', 'create', 'tasks', 1, '{"title": "Regular User Task"}', NOW()),
          ('${regularUser.user.id}', 'update', 'tasks', 1, '{"title": {"old": "Regular User Task", "new": "Updated"}}', NOW())
      `)

      // Sign in as admin
      await createAuthenticatedAdmin({ email: 'admin@example.com' })

      // WHEN: Admin filters activities by regular user's userId
      const response = await page.request.get(`/api/activity?userId=${regularUser.user.id}`)

      // THEN: Returns regular user's activities successfully
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.activities).toHaveLength(2)
      expect(data.activities.every((a: any) => a.userId === regularUser.user.id)).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-LIST-REGRESSION: user can retrieve and filter activity logs',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // Setup: Start server with activity logging
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
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

      // --- Step 002: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-ACTIVITY-LIST-002: Return 401 when not authenticated', async () => {
        const response = await request.get('/api/activity')
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // --- Authenticate as member ---
      const { user } = await createAuthenticatedUser()

      // --- Step 009: Empty array when no activities exist ---
      await test.step('API-ACTIVITY-LIST-009: Return empty array when no activities exist', async () => {
        const response = await request.get('/api/activity')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(0)
        expect(data.pagination.total).toBe(0)
        expect(data.pagination.totalPages).toBe(0)
      })

      // Setup: Insert activity data with varied timestamps
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW() - INTERVAL '10 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"status": {"old": "pending", "new": "active"}}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'create', 'tasks', 2, '{"title": "Task 2"}', NOW() - INTERVAL '3 minutes'),
          ('${user.id}', 'delete', 'tasks', 2, NULL, NOW() - INTERVAL '1 minute')
      `)

      // --- Step 001: Paginated activity logs ---
      await test.step('API-ACTIVITY-LIST-001: Return 200 with paginated activity logs', async () => {
        const response = await request.get('/api/activity')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('activities')
        expect(data).toHaveProperty('pagination')
        expect(data.activities).toHaveLength(4)
        expect(data.pagination.total).toBe(4)
      })

      // --- Step 007: Sort by creation date descending ---
      await test.step('API-ACTIVITY-LIST-007: Return activities sorted by date descending', async () => {
        const response = await request.get('/api/activity')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(4)
        expect(new Date(data.activities[0].createdAt).getTime()).toBeGreaterThan(
          new Date(data.activities[1].createdAt).getTime()
        )
      })

      // --- Step 004: Filter by action type ---
      await test.step('API-ACTIVITY-LIST-004: Return activities filtered by action type', async () => {
        const response = await request.get('/api/activity?action=create')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(2)
        expect(data.activities.every((a: any) => a.action === 'create')).toBe(true)
      })

      // --- Step 003: Filter by table name ---
      await test.step('API-ACTIVITY-LIST-003: Return activities filtered by table name', async () => {
        const response = await request.get('/api/activity?tableName=tasks')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(4)
        expect(data.activities.every((a: any) => a.tableName === 'tasks')).toBe(true)
      })

      // --- Step 006: Filter by date range ---
      await test.step('API-ACTIVITY-LIST-006: Return activities filtered by date range', async () => {
        // 6 minutes ago: should capture update(-5m), create(-3m), delete(-1m) but not create(-10m)
        const startDate = new Date(Date.now() - 6 * 60 * 1000).toISOString()
        const response = await request.get(`/api/activity?startDate=${startDate}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(3)
      })

      // --- Step 017: Filter by own userId ---
      await test.step('API-ACTIVITY-LIST-017: Allow non-admin to filter by own userId', async () => {
        const response = await request.get(`/api/activity?userId=${user.id}`)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities).toHaveLength(4)
        expect(data.activities.every((a: any) => a.userId === user.id)).toBe(true)
      })

      // --- Step 012: User metadata in activity logs ---
      await test.step('API-ACTIVITY-LIST-012: Include user metadata in activity logs', async () => {
        const response = await request.get('/api/activity')
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.activities[0]).toHaveProperty('user')
        expect(data.activities[0].user).toHaveProperty('id', user.id)
      })

      // --- Step 010: Invalid page parameter ---
      await test.step('API-ACTIVITY-LIST-010: Return 400 for invalid page parameter', async () => {
        const response = await request.get('/api/activity?page=-1')
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // --- Step 011: PageSize exceeds maximum ---
      await test.step('API-ACTIVITY-LIST-011: Return 400 when pageSize exceeds maximum', async () => {
        const response = await request.get('/api/activity?pageSize=200')
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // --- Step 014: Invalid action filter ---
      await test.step('API-ACTIVITY-LIST-014: Return 400 for invalid action filter', async () => {
        const response = await request.get('/api/activity?action=invalid_action')
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // --- Steps skipped: require different auth contexts or schema ---
      // API-ACTIVITY-LIST-005: Filter by userId (multi-user — covered by @spec)
      // API-ACTIVITY-LIST-008: Pagination with 25+ records (covered by @spec)
      // API-ACTIVITY-LIST-013: Retention policy (covered by @spec)
      // API-ACTIVITY-LIST-015: No auth config 401 (different schema — covered by @spec)
      // API-ACTIVITY-LIST-016: Null user metadata (system activities — covered by @spec)
      // API-ACTIVITY-LIST-018: 403 other user's activities (multi-user auth — covered by @spec)
      // API-ACTIVITY-LIST-019: Admin can filter any userId (admin auth — covered by @spec)
    }
  )
})

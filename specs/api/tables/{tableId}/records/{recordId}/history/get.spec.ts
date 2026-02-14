/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get Record Change History
 *
 * Source: specs/api/tables/{tableId}/records/{recordId}/history/get.spec.ts
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (10 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('GET /api/tables/:tableId/records/:recordId/history - Get Record Change History', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-ACTIVITY-RECORD-HISTORY-001: should return 200 with chronological change history',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with a record and multiple activities
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

      const { user } = await createAuthenticatedUser()

      // Create record and activity history
      await executeQuery(`INSERT INTO tasks (id, title, status) VALUES (1, 'Task 1', 'pending')`)
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Task 1", "status": "pending"}', NOW() - INTERVAL '10 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"status": {"old": "pending", "new": "active"}}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Task 1", "new": "Updated Task"}}', NOW() - INTERVAL '2 minutes')
      `)

      // WHEN: User requests record history
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns chronological change history
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(3)
      expect(data.history[0].action).toBe('create')
      expect(data.history[1].action).toBe('update')
      expect(data.history[2].action).toBe('update')
      // Verify chronological order (oldest to newest)
      expect(new Date(data.history[0].createdAt).getTime()).toBeLessThan(
        new Date(data.history[1].createdAt).getTime()
      )
    }
  )

  test(
    'API-ACTIVITY-RECORD-HISTORY-002: should return 401 when user is not authenticated',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled but user not signed in
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

      // WHEN: Unauthenticated user requests record history
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test(
    'API-ACTIVITY-RECORD-HISTORY-003: should return 404 when table does not exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with authenticated user but no table ID 9999
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      await createAuthenticatedUser()

      // WHEN: User requests history for non-existent table
      const response = await request.get('/api/tables/9999/records/1/history')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-004: should return 404 when record does not exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists but record ID 99999 does not
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

      await createAuthenticatedUser()

      // WHEN: User requests history for non-existent record
      const response = await request.get('/api/tables/1/records/99999/history')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('code')
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-005: should return empty history when no activities exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with record but no activity logs
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

      await createAuthenticatedUser()
      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task 1')`)

      // WHEN: User requests history for record with no activities
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns empty history array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(0)
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-006: should include user metadata for each activity',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Record with activities from multiple users
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

      const user1 = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const user2 = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task 1')`)
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user1.user.id}', 'create', 'tasks', 1, '{"title": "Task 1"}', NOW() - INTERVAL '10 minutes'),
          ('${user2.user.id}', 'update', 'tasks', 1, '{"title": {"old": "Task 1", "new": "Updated"}}', NOW() - INTERVAL '5 minutes')
      `)

      // WHEN: User requests record history
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Each activity includes user metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(2)
      expect(data.history[0].user.name).toBe('Alice')
      expect(data.history[1].user.name).toBe('Bob')
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-007: should exclude activities older than 1 year (retention policy)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Record with activities older and newer than 1 year
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

      await executeQuery(`INSERT INTO tasks (id, title) VALUES (1, 'Task 1')`)
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "Old Activity"}', NOW() - INTERVAL '400 days'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Old", "new": "Recent"}}', NOW() - INTERVAL '30 days'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "Recent", "new": "Current"}}', NOW())
      `)

      // WHEN: User requests record history
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns only activities within 1 year retention period
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(2)
      expect(data.history.every((a: any) => a.changes.title !== 'Old Activity')).toBe(true)
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-008: should support pagination for record history',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Record with many activities (30 activities)
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'counter', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      const { user } = await createAuthenticatedUser()

      await executeQuery(`INSERT INTO tasks (id, counter) VALUES (1, 0)`)

      // Create 30 activities
      const insertValues = Array.from(
        { length: 30 },
        (_, i) =>
          `('${user.id}', 'update', 'tasks', 1, '{"counter": {"old": ${i}, "new": ${i + 1}}}', NOW() - INTERVAL '${30 - i} minutes')`
      ).join(',')
      await executeQuery(
        `INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at) VALUES ${insertValues}`
      )

      // WHEN: User requests second page of history with limit 10 and offset 10
      const response = await request.get('/api/tables/1/records/1/history?limit=10&offset=10')

      // THEN: Returns paginated history
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(10)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(10)
      expect(data.pagination.total).toBe(30)
    }
  )

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-009: should show complete lifecycle including delete',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Record that was created, updated, and deleted
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

      // Note: Record may be soft-deleted, so history should still be accessible
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user.id}', 'create', 'tasks', 1, '{"title": "New Task"}', NOW() - INTERVAL '10 minutes'),
          ('${user.id}', 'update', 'tasks', 1, '{"title": {"old": "New Task", "new": "Updated Task"}}', NOW() - INTERVAL '5 minutes'),
          ('${user.id}', 'delete', 'tasks', 1, NULL, NOW() - INTERVAL '1 minute')
      `)

      // WHEN: User requests history for deleted record
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns complete lifecycle including delete action
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.history).toHaveLength(3)
      expect(data.history[0].action).toBe('create')
      expect(data.history[1].action).toBe('update')
      expect(data.history[2].action).toBe('delete')
      expect(data.history[2].changes).toBeNull()
    }
  )

  test(
    'API-ACTIVITY-RECORD-HISTORY-010: should return 401 Unauthorized when auth is not configured',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth configured but user not authenticated
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

      // WHEN: Unauthenticated user requests record history
      const response = await request.get('/api/tables/1/records/1/history')

      // THEN: Returns 401 Unauthorized (activity APIs always require auth)
      expect(response.status()).toBe(401)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-ACTIVITY-RECORD-HISTORY-REGRESSION: user can view complete change history for a record',
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
              { id: 4, name: 'priority', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('API-ACTIVITY-RECORD-HISTORY-002: Returns 401 when user is not authenticated', async () => {
        // WHEN: Unauthenticated user requests record history
        const response = await request.get('/api/tables/1/records/1/history')

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })

      // Setup: Create users and record with history
      const user1 = await createAuthenticatedUser({ name: 'Alice', email: 'alice@example.com' })
      const user2 = await createAuthenticatedUser({ name: 'Bob', email: 'bob@example.com' })

      await executeQuery(
        `INSERT INTO tasks (id, title, status, priority) VALUES (42, 'Important Task', 'pending', 1)`
      )
      await executeQuery(`
        INSERT INTO system.activity_logs (user_id, action, table_name, record_id, changes, created_at)
        VALUES
          ('${user1.user.id}', 'create', 'tasks', 42, '{"title": "Important Task", "status": "pending", "priority": 1}', NOW() - INTERVAL '20 minutes'),
          ('${user1.user.id}', 'update', 'tasks', 42, '{"status": {"old": "pending", "new": "active"}}', NOW() - INTERVAL '15 minutes'),
          ('${user2.user.id}', 'update', 'tasks', 42, '{"priority": {"old": 1, "new": 5}}', NOW() - INTERVAL '10 minutes'),
          ('${user2.user.id}', 'update', 'tasks', 42, '{"title": {"old": "Important Task", "new": "Critical Task"}}', NOW() - INTERVAL '5 minutes')
      `)

      await test.step('API-ACTIVITY-RECORD-HISTORY-001: Returns 200 with chronological change history', async () => {
        // WHEN: User requests record history
        const response = await request.get('/api/tables/1/records/42/history')

        // THEN: Returns chronological change history
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.history).toHaveLength(4)
        expect(data.history[0].action).toBe('create')
        expect(data.history[1].action).toBe('update')
        expect(data.history[2].action).toBe('update')
        expect(data.history[3].action).toBe('update')
        // Verify chronological order (oldest to newest)
        expect(new Date(data.history[0].createdAt).getTime()).toBeLessThan(
          new Date(data.history[1].createdAt).getTime()
        )
      })

      await test.step('API-ACTIVITY-RECORD-HISTORY-006: Includes user metadata for each activity', async () => {
        // WHEN: User requests record history
        const response = await request.get('/api/tables/1/records/42/history')

        // THEN: Each activity includes user metadata
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.history[0].user.name).toBe('Alice')
        expect(data.history[2].user.name).toBe('Bob')
      })

      await test.step('API-ACTIVITY-RECORD-HISTORY-008: Supports pagination for record history', async () => {
        // WHEN: User requests history with limit 2 and offset 0
        const response = await request.get('/api/tables/1/records/42/history?limit=2&offset=0')

        // THEN: Returns paginated history
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.history).toHaveLength(2)
        expect(data.pagination.limit).toBe(2)
        expect(data.pagination.offset).toBe(0)
        expect(data.pagination.total).toBe(4)
      })

      await test.step('API-ACTIVITY-RECORD-HISTORY-004: Returns 404 when record does not exist', async () => {
        // WHEN: User requests history for non-existent record
        const response = await request.get('/api/tables/1/records/99999/history')

        // THEN: Returns 404 Not Found
        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data).toHaveProperty('success')
        expect(data).toHaveProperty('message')
        expect(data).toHaveProperty('code')
      })
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List comments on a record
 *
 * Domain: api
 * Spec Count: 10
 *
 * Comments Feature:
 * - Flat comments (no threading) similar to Airtable
 * - Chronological order (newest first by default)
 * - Authentication required (no anonymous comments)
 * - Supports @mentions stored as @[user_id]
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (11 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('List comments on a record', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-001: should return 200 with comments array',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a record that has multiple comments
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title, status) VALUES (1, 'Task One', 'in-progress')
      `)
      await executeQuery(`
        INSERT INTO auth.user (id, name, email, email_verified) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', true),
          ('user_2', 'Bob Smith', 'bob@example.com', true)
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
        VALUES
          ('comment_1', '1', '1', 'user_1', 'First comment', NOW() - INTERVAL '2 hours'),
          ('comment_2', '1', '1', 'user_2', 'Second comment', NOW() - INTERVAL '1 hour'),
          ('comment_3', '1', '1', 'user_1', 'Third comment', NOW())
      `)

      // WHEN: User requests all comments for the record
      const response = await request.get('/api/tables/1/records/1/comments', {})

      // THEN: Returns 200 with comments array in chronological order (newest first)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(3)
      expect(data.comments[0].id).toBe('comment_3')
      expect(data.comments[0].content).toBe('Third comment')
      expect(data.comments[0].userId).toBe('user_1')
      expect(data.comments[1].id).toBe('comment_2')
      expect(data.comments[2].id).toBe('comment_1')
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-002: should return empty array when no comments exist',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a record that has no comments
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task Without Comments')
      `)

      // WHEN: User requests comments for the record
      const response = await request.get('/api/tables/2/records/1/comments', {})

      // THEN: Returns 200 with empty comments array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toEqual([])
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A record with comments in an authenticated app
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Private Task')
      `)

      // WHEN: Unauthenticated user attempts to list comments
      const response = await request.get('/api/tables/3/records/1/comments')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-004: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists but record does not
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()

      // WHEN: User requests comments for non-existent record
      const response = await request.get('/api/tables/4/records/9999/comments', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-005: should exclude soft-deleted comments by default',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with active and soft-deleted comments
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 6,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task with deleted comments')
      `)
      await executeQuery(`
        INSERT INTO auth.user (id, name, email, email_verified) VALUES
          ('user_1', 'Test User', 'user1@example.com', true)
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, deleted_at)
        VALUES
          ('comment_1', '1', '6', 'user_1', 'Active comment', NULL),
          ('comment_2', '1', '6', 'user_1', 'Deleted comment', NOW())
      `)

      // WHEN: User lists comments without includeDeleted parameter
      const response = await request.get('/api/tables/6/records/1/comments', {})

      // THEN: Returns only active comments (soft-deleted excluded)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(1)
      expect(data.comments[0].id).toBe('comment_1')
      expect(data.comments[0].content).toBe('Active comment')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-LIST-006: should include user metadata with each comment',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with comments from different users
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 7,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Collaborative Task')
      `)
      await executeQuery(`
        INSERT INTO auth.user (id, name, email, email_verified) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', true),
          ('user_2', 'Bob Smith', 'bob@example.com', true)
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES
          ('comment_1', '1', '1', 'user_1', 'Comment by Alice'),
          ('comment_2', '1', '1', 'user_2', 'Comment by Bob')
      `)

      // WHEN: User lists comments
      const response = await request.get('/api/tables/7/records/1/comments', {})

      // THEN: Each comment includes user metadata (name, email, image)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(2)
      expect(data.comments[0].user).toMatchObject({
        id: 'user_2',
        name: 'Bob Smith',
        email: 'bob@example.com',
      })
      expect(data.comments[1].user).toMatchObject({
        id: 'user_1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
      })
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-LIST-007: should support pagination with limit and offset',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with many comments (15 comments)
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Popular Task')
      `)
      // Insert 15 comments
      const values = Array.from({ length: 15 }, (_, i) => {
        const commentId = i + 1
        return `('comment_${commentId}', '1', '1', 'user_1', 'Comment ${commentId}', NOW() - INTERVAL '${15 - commentId} hours')`
      }).join(',')
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
        VALUES ${values}
      `)

      // WHEN: User requests page 2 with limit=5 (offset=5)
      const response = await request.get('/api/tables/8/records/1/comments', {
        params: {
          limit: '5',
          offset: '5',
        },
      })

      // THEN: Returns 5 comments (comments 6-10) with pagination metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(5)
      expect(data.comments[0].id).toBe('comment_10')
      expect(data.pagination).toMatchObject({
        total: 15,
        limit: 5,
        offset: 5,
        hasMore: true,
      })
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-LIST-008: should support sorting by createdAt',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with comments at different times
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 9,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task with sorted comments')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
        VALUES
          ('comment_1', '1', '1', 'user_1', 'Oldest', NOW() - INTERVAL '3 days'),
          ('comment_2', '1', '1', 'user_1', 'Middle', NOW() - INTERVAL '2 days'),
          ('comment_3', '1', '1', 'user_1', 'Newest', NOW())
      `)

      // WHEN: User requests comments sorted oldest first
      const response = await request.get('/api/tables/9/records/1/comments', {
        params: {
          sort: 'createdAt:asc',
        },
      })

      // THEN: Returns comments in ascending chronological order
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(3)
      expect(data.comments[0].id).toBe('comment_1')
      expect(data.comments[0].content).toBe('Oldest')
      expect(data.comments[1].id).toBe('comment_2')
      expect(data.comments[2].id).toBe('comment_3')
      expect(data.comments[2].content).toBe('Newest')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-LIST-009: should include timestamps for each comment',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with a comment that was edited
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 10,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task with edited comment')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
        VALUES ('comment_1', '1', '1', 'user_1', 'Edited comment', NOW() - INTERVAL '1 hour', NOW())
      `)

      // WHEN: User lists comments
      const response = await request.get('/api/tables/10/records/1/comments', {})

      // THEN: Each comment includes createdAt and updatedAt timestamps
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comments).toHaveLength(1)
      expect(data.comments[0]).toHaveProperty('createdAt')
      expect(data.comments[0]).toHaveProperty('updatedAt')
      // updatedAt should be more recent than createdAt for edited comment
      expect(new Date(data.comments[0].updatedAt).getTime()).toBeGreaterThan(
        new Date(data.comments[0].createdAt).getTime()
      )
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-LIST-010: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User without read permission for the table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 11,
            name: 'confidential_tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO confidential_tasks (id, title) VALUES (1, 'Secret Task')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Confidential comment')
      `)

      // WHEN: User without read permission attempts to list comments
      const response = await request.get('/api/tables/11/records/1/comments', {})

      // THEN: Returns 403 Forbidden (no permission to read record)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test(
    'API-TABLES-RECORDS-COMMENTS-LIST-REGRESSION: user can complete full list comments workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Initialize server with tasks table
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Seed a record for 401 test
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (99, 'Auth Test Task')
      `)

      // --- Step 003: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-003: Return 401 when not authenticated', async () => {
        const response = await request.get('/api/tables/1/records/99/comments')
        expect(response.status()).toBe(401)
      })

      // --- Authenticate as user for all subsequent test steps ---
      await createAuthenticatedUser()

      // Insert users for comment attribution
      await executeQuery(`
        INSERT INTO auth.user (id, name, email, email_verified) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', true),
          ('user_2', 'Bob Smith', 'bob@example.com', true)
      `)

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-001: Returns 200 with comments array in chronological order', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title, status) VALUES (1, 'Task One', 'in-progress')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
          VALUES
            ('comment_1', '1', '1', 'user_1', 'First comment', NOW() - INTERVAL '2 hours'),
            ('comment_2', '1', '1', 'user_2', 'Second comment', NOW() - INTERVAL '1 hour'),
            ('comment_3', '1', '1', 'user_1', 'Third comment', NOW())
        `)

        const response = await request.get('/api/tables/1/records/1/comments', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(3)
        expect(data.comments[0].id).toBe('comment_3')
        expect(data.comments[0].content).toBe('Third comment')
        expect(data.comments[0].userId).toBe('user_1')
        expect(data.comments[1].id).toBe('comment_2')
        expect(data.comments[2].id).toBe('comment_1')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-002: Returns empty array when no comments exist', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (2, 'Task Without Comments')
        `)

        const response = await request.get('/api/tables/1/records/2/comments', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toEqual([])
      })

      // Step 003 (401) is tested above BEFORE authentication

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-004: Returns 404 Not Found for non-existent record', async () => {
        const response = await request.get('/api/tables/1/records/9999/comments', {})

        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-005: Excludes soft-deleted comments by default', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (5, 'Task with deleted comments')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, deleted_at)
          VALUES
            ('comment_active', '5', '1', 'user_1', 'Active comment', NULL),
            ('comment_deleted', '5', '1', 'user_1', 'Deleted comment', NOW())
        `)

        const response = await request.get('/api/tables/1/records/5/comments', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(1)
        expect(data.comments[0].id).toBe('comment_active')
        expect(data.comments[0].content).toBe('Active comment')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-006: Includes user metadata with each comment', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (6, 'Collaborative Task')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
          VALUES
            ('comment_alice', '6', '1', 'user_1', 'Comment by Alice'),
            ('comment_bob', '6', '1', 'user_2', 'Comment by Bob')
        `)

        const response = await request.get('/api/tables/1/records/6/comments', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(2)
        expect(data.comments[0].user).toMatchObject({
          id: 'user_2',
          name: 'Bob Smith',
          email: 'bob@example.com',
        })
        expect(data.comments[1].user).toMatchObject({
          id: 'user_1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
        })
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-007: Supports pagination with limit and offset', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (7, 'Popular Task')
        `)
        // Insert 15 comments
        const values = Array.from({ length: 15 }, (_, i) => {
          const commentId = i + 1
          return `('comment_page_${commentId}', '7', '1', 'user_1', 'Comment ${commentId}', NOW() - INTERVAL '${15 - commentId} hours')`
        }).join(',')
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
          VALUES ${values}
        `)

        const response = await request.get('/api/tables/1/records/7/comments', {
          params: {
            limit: '5',
            offset: '5',
          },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(5)
        expect(data.comments[0].id).toBe('comment_page_10')
        expect(data.pagination).toMatchObject({
          total: 15,
          limit: 5,
          offset: 5,
          hasMore: true,
        })
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-008: Supports sorting by createdAt', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (8, 'Task with sorted comments')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at)
          VALUES
            ('comment_oldest', '8', '1', 'user_1', 'Oldest', NOW() - INTERVAL '3 days'),
            ('comment_middle', '8', '1', 'user_1', 'Middle', NOW() - INTERVAL '2 days'),
            ('comment_newest', '8', '1', 'user_1', 'Newest', NOW())
        `)

        const response = await request.get('/api/tables/1/records/8/comments', {
          params: {
            sort: 'createdAt:asc',
          },
        })

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(3)
        expect(data.comments[0].id).toBe('comment_oldest')
        expect(data.comments[0].content).toBe('Oldest')
        expect(data.comments[1].id).toBe('comment_middle')
        expect(data.comments[2].id).toBe('comment_newest')
        expect(data.comments[2].content).toBe('Newest')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-LIST-009: Includes timestamps for each comment', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (9, 'Task with edited comment')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
          VALUES ('comment_edited', '9', '1', 'user_1', 'Edited comment', NOW() - INTERVAL '1 hour', NOW())
        `)

        const response = await request.get('/api/tables/1/records/9/comments', {})

        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.comments).toHaveLength(1)
        expect(data.comments[0]).toHaveProperty('createdAt')
        expect(data.comments[0]).toHaveProperty('updatedAt')
        expect(new Date(data.comments[0].updatedAt).getTime()).toBeGreaterThan(
          new Date(data.comments[0].createdAt).getTime()
        )
      })

      // --- Step 010 skipped: requires different auth context ---
      // API-TABLES-RECORDS-COMMENTS-LIST-010 tests viewer role getting 403 Forbidden.
      // This needs createAuthenticatedViewer and a table with permissions config,
      // which would invalidate the current session for subsequent tests.
      // Covered by @spec test API-TABLES-RECORDS-COMMENTS-LIST-010.
    }
  )
})

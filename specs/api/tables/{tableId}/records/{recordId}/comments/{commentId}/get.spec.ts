/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get single comment by ID
 *
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (7 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Get single comment by ID', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-001: should return 200 with complete comment data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with record that has a comment
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
        VALUES ('comment_1', '1', '1', 'user_1', 'This is a test comment', NOW(), NOW())
      `)

      // WHEN: User requests comment by ID
      const response = await request.get('/api/tables/1/records/1/comments/comment_1', {})

      // THEN: Returns 200 with complete comment data including user metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comment.id).toBe('comment_1')
      expect(data.comment.content).toBe('This is a test comment')
      expect(data.comment.userId).toBe('user_1')
      expect(data.comment.recordId).toBe('1')
      expect(data.comment.tableId).toBe('1')
      expect(data.comment).toHaveProperty('createdAt')
      expect(data.comment).toHaveProperty('updatedAt')
      expect(data.comment.user).toMatchObject({
        id: 'user_1',
        name: 'Alice',
        email: 'alice@example.com',
      })
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-002: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with record but comment does not exist
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)

      // WHEN: User requests non-existent comment
      const response = await request.get('/api/tables/2/records/1/comments/nonexistent', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Record with comment in authenticated app
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
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Private comment')
      `)

      // WHEN: Unauthenticated user attempts to fetch comment
      const response = await request.get('/api/tables/3/records/1/comments/comment_1')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-004: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Comment owned by different user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'owner_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title, owner_id) VALUES (1, 'Task owned by user_2', 'user_2')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_2', 'Comment by user_2')
      `)

      // WHEN: user_1 attempts to fetch comment on record owned by user_2
      const response = await request.get('/api/tables/4/records/1/comments/comment_1', {
        headers: {},
      })

      // THEN: Returns 404 Not Found (don't leak existence for cross-owner access)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-005: should return 404 Not Found for soft-deleted comment',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with soft-deleted comment
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 5,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, deleted_at)
        VALUES ('comment_1', '1', '1', 'user_1', 'Deleted comment', NOW())
      `)

      // WHEN: User attempts to fetch soft-deleted comment
      const response = await request.get('/api/tables/5/records/1/comments/comment_1', {})

      // THEN: Returns 404 Not Found (soft-deleted comments are hidden)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-006: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User without read permission for the record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 6,
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

      // WHEN: User without permission attempts to fetch comment
      const response = await request.get('/api/tables/6/records/1/comments/comment_1', {})

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-007: should show updated timestamp for edited comments',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record with an edited comment (updatedAt > createdAt)
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
        VALUES ('comment_1', '1', '1', 'user_1', 'Edited comment', NOW() - INTERVAL '1 hour', NOW())
      `)

      // WHEN: User fetches the edited comment
      const response = await request.get('/api/tables/7/records/1/comments/comment_1', {})

      // THEN: updatedAt is more recent than createdAt
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comment.content).toBe('Edited comment')
      expect(new Date(data.comment.updatedAt).getTime()).toBeGreaterThan(
        new Date(data.comment.createdAt).getTime()
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-GET-REGRESSION: user can complete full get comment workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with tasks table and authenticate', async () => {
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
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-001: Returns 200 with complete comment data', async () => {
        // GIVEN: Table with record that has a comment
        await executeQuery(`
            INSERT INTO tasks (id, title) VALUES (1, 'Task One')
          `)
        await executeQuery(`
            INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
          `)
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
            VALUES ('comment_1', '1', '1', 'user_1', 'This is a test comment', NOW(), NOW())
          `)

        // WHEN: User requests comment by ID
        const response = await request.get('/api/tables/8/records/1/comments/comment_1', {})

        // THEN: Returns 200 with complete comment data including user metadata
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.comment.id).toBe('comment_1')
        expect(data.comment.content).toBe('This is a test comment')
        expect(data.comment.userId).toBe('user_1')
        expect(data.comment.recordId).toBe('1')
        expect(data.comment.tableId).toBe('1')
        expect(data.comment).toHaveProperty('createdAt')
        expect(data.comment).toHaveProperty('updatedAt')
        expect(data.comment.user).toMatchObject({
          id: 'user_1',
          name: 'Alice',
          email: 'alice@example.com',
        })
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-002: Returns 404 for non-existent comment', async () => {
        // WHEN: User requests non-existent comment
        const response = await request.get('/api/tables/8/records/1/comments/nonexistent', {})

        // THEN: Returns 404 Not Found
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-003: Returns 401 for unauthenticated request', async () => {
        // GIVEN: Record with comment in authenticated app
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
            VALUES ('comment_2', '1', '1', 'user_1', 'Private comment')
          `)

        // WHEN: Unauthenticated user attempts to fetch comment
        const response = await request.get('/api/tables/8/records/1/comments/comment_2')

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-004: Returns 404 for cross-owner access', async () => {
        // GIVEN: Comment by different user
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
            VALUES ('comment_3', '1', '1', 'user_2', 'Comment by user_2')
          `)

        // WHEN: user_1 attempts to fetch comment on record owned by user_2
        const response = await request.get('/api/tables/8/records/1/comments/comment_3', {
          headers: {},
        })

        // THEN: Returns 404 Not Found (don't leak existence for cross-owner access)
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-005: Returns 404 for soft-deleted comment', async () => {
        // GIVEN: Record with soft-deleted comment
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, deleted_at)
            VALUES ('comment_4', '1', '1', 'user_1', 'Deleted comment', NOW())
          `)

        // WHEN: User attempts to fetch soft-deleted comment
        const response = await request.get('/api/tables/8/records/1/comments/comment_4', {})

        // THEN: Returns 404 Not Found (soft-deleted comments are hidden)
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-006: Returns 403 for unauthorized access', async () => {
        // GIVEN: User without read permission for the record
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
            VALUES ('comment_5', '1', '1', 'user_1', 'Confidential comment')
          `)

        // WHEN: User without permission attempts to fetch comment
        const response = await request.get('/api/tables/8/records/1/comments/comment_5', {})

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('You do not have permission to perform this action')
        expect(data.code).toBe('FORBIDDEN')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-GET-007: Shows updated timestamp for edited comments', async () => {
        // GIVEN: Record with an edited comment (updatedAt > createdAt)
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at)
            VALUES ('comment_6', '1', '1', 'user_1', 'Edited comment', NOW() - INTERVAL '1 hour', NOW())
          `)

        // WHEN: User fetches the edited comment
        const response = await request.get('/api/tables/8/records/1/comments/comment_6', {})

        // THEN: updatedAt is more recent than createdAt
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.comment.content).toBe('Edited comment')
        expect(new Date(data.comment.updatedAt).getTime()).toBeGreaterThan(
          new Date(data.comment.createdAt).getTime()
        )
      })
    }
  )
})

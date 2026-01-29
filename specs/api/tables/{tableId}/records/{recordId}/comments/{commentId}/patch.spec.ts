/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update comment
 *
 * Domain: api
 * Spec Count: 10
 *
 * Authorization:
 * - Only the comment author can edit their own comments
 * - Admins cannot edit other users' comments (respect authorship)
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (10 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Update comment', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-001: should return 200 with updated comment data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own comment on a record
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
        VALUES ('comment_1', '1', '1', 'user_1', 'Original comment', NOW(), NOW())
      `)

      // WHEN: User updates their own comment
      const response = await request.patch('/api/tables/1/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Updated comment text',
        },
      })

      // THEN: Returns 200 with updated comment data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comment.id).toBe('comment_1')
      expect(data.comment.content).toBe('Updated comment text')
      expect(data.comment.userId).toBe('user_1')
      // updatedAt should be more recent than createdAt
      expect(new Date(data.comment.updatedAt).getTime()).toBeGreaterThan(
        new Date(data.comment.createdAt).getTime()
      )

      // Verify in database
      const result = await executeQuery(`
        SELECT content, updated_at FROM system.record_comments WHERE id = 'comment_1'
      `)
      expect(result.rows[0].content).toBe('Updated comment text')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-002: should update @mentions in content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Comment with original @mention
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
        INSERT INTO tasks (id, title) VALUES (1, 'Collaborative Task')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES
          ('user_1', 'Alice', 'alice@example.com'),
          ('user_2', 'Bob', 'bob@example.com'),
          ('user_3', 'Carol', 'carol@example.com')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Hey @[user_2], check this out')
      `)

      // WHEN: User updates comment with new @mention
      const response = await request.patch('/api/tables/2/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Actually, @[user_3] should review this instead',
        },
      })

      // THEN: Comment updated with new @mention
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comment.content).toBe('Actually, @[user_3] should review this instead')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-003: should return 400 Bad Request for empty content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own comment
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
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Original comment')
      `)

      // WHEN: User attempts to update with empty content
      const response = await request.patch('/api/tables/3/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: '',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Invalid input data')
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.message).toContain('content')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-004: should return 400 Bad Request for content too long',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own comment
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
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Original comment')
      `)

      // WHEN: User attempts to update with content exceeding max length
      const longContent = 'a'.repeat(10_001)
      const response = await request.patch('/api/tables/4/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: longContent,
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Invalid input data')
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.message).toContain('content')
      expect(data.message).toContain('maximum length')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-005: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Comment on a record in authenticated app
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
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Original comment')
      `)

      // WHEN: Unauthenticated user attempts to update comment
      const response = await request.patch('/api/tables/5/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Trying to update without auth',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-006: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Comment authored by different user
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES
          ('user_1', 'Alice', 'alice@example.com'),
          ('user_2', 'Bob', 'bob@example.com')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_2', 'Comment by Bob')
      `)

      // WHEN: Different user attempts to edit comment
      const response = await request.patch('/api/tables/6/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Alice trying to edit Bobs comment',
        },
      })

      // THEN: Returns 403 Forbidden (only author can edit)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toBe('You can only edit your own comments')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-007: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with record but comment does not exist
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

      // WHEN: User attempts to update non-existent comment
      const response = await request.patch('/api/tables/7/records/1/comments/nonexistent', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Trying to update non-existent comment',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-008: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Comment on record owned by different user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
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

      // WHEN: user_1 attempts to update comment on record owned by user_2
      const response = await request.patch('/api/tables/8/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Cross-owner update attempt',
        },
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
    'API-TABLES-RECORDS-COMMENTS-UPDATE-009: should return 404 Not Found for soft-deleted comment',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own soft-deleted comment
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, deleted_at)
        VALUES ('comment_1', '1', '1', 'user_1', 'Deleted comment', NOW())
      `)

      // WHEN: User attempts to update soft-deleted comment
      const response = await request.patch('/api/tables/9/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Trying to update deleted comment',
        },
      })

      // THEN: Returns 404 Not Found (cannot edit deleted comments)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-010: should include user metadata in response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User updating their own comment
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email, image) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', 'https://example.com/alice.jpg')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'user_1', 'Original comment')
      `)

      // WHEN: User updates their comment
      const response = await request.patch('/api/tables/10/records/1/comments/comment_1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Updated comment',
        },
      })

      // THEN: Response includes user metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.comment.user).toMatchObject({
        id: 'user_1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        image: 'https://example.com/alice.jpg',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // Combines 10 @spec scenarios into one workflow validating the update comment feature
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-UPDATE-REGRESSION: user can complete full update comment workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      await test.step('Setup: Start server with tasks table and authenticate', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: { emailAndPassword: true },
          tables: [
            {
              id: 11,
              name: 'tasks',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text', required: true },
                { id: 2, name: 'owner_id', type: 'single-line-text' },
              ],
            },
          ],
        })
        await createAuthenticatedUser()
      })

      await test.step('Setup: Insert test records, users, and comments', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title, owner_id) VALUES
            (1, 'Task owned by user_1', NULL),
            (2, 'Task owned by user_2', 'user_2')
        `)
        await executeQuery(`
          INSERT INTO users (id, name, email, image) VALUES
            ('user_1', 'Alice Johnson', 'alice@example.com', 'https://example.com/alice.jpg'),
            ('user_2', 'Bob Smith', 'bob@example.com', NULL),
            ('user_3', 'Carol White', 'carol@example.com', NULL)
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, user_id, content, created_at, updated_at, deleted_at)
          VALUES
            ('comment_1', '1', '1', 'user_1', 'Original comment by Alice', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NULL),
            ('comment_2', '1', '1', 'user_2', 'Comment by Bob', NOW(), NOW(), NULL),
            ('comment_3', '1', '1', 'user_1', 'Deleted comment', NOW(), NOW(), NOW()),
            ('comment_4', '2', '1', 'user_2', 'Cross-owner comment', NOW(), NOW(), NULL)
        `)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-001: Return 200 with updated comment data', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Updated comment text' },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.comment.id).toBe('comment_1')
        expect(data.comment.content).toBe('Updated comment text')
        expect(data.comment.userId).toBe('user_1')
        expect(new Date(data.comment.updatedAt).getTime()).toBeGreaterThan(
          new Date(data.comment.createdAt).getTime()
        )

        const result = await executeQuery(`
          SELECT content, updated_at FROM system.record_comments WHERE id = 'comment_1'
        `)
        expect(result.rows[0].content).toBe('Updated comment text')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-002: Update @mentions in content', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Actually, @[user_3] should review this instead' },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.comment.content).toBe('Actually, @[user_3] should review this instead')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-003: Return 400 Bad Request for empty content', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: '' },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Invalid input data')
        expect(data.code).toBe('VALIDATION_ERROR')
        expect(data.message).toContain('content')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-004: Return 400 Bad Request for content too long', async () => {
        const longContent = 'a'.repeat(10_001)
        const response = await request.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: longContent },
        })

        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Invalid input data')
        expect(data.code).toBe('VALIDATION_ERROR')
        expect(data.message).toContain('content')
        expect(data.message).toContain('maximum length')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-005: Return 401 Unauthorized', async () => {
        // Create new request context without authentication
        const unauthRequest = request
        const response = await unauthRequest.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Trying to update without auth' },
        })

        expect(response.status()).toBe(401)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-006: Return 403 Forbidden for different user', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_2', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Alice trying to edit Bobs comment' },
        })

        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('You do not have permission to perform this action')
        expect(data.code).toBe('FORBIDDEN')
        expect(data.message).toBe('You can only edit your own comments')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-007: Return 404 Not Found for nonexistent comment', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/nonexistent', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Trying to update non-existent comment' },
        })

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-008: Return 404 Not Found for cross-owner access', async () => {
        const response = await request.patch('/api/tables/11/records/2/comments/comment_4', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Cross-owner update attempt' },
        })

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-009: Return 404 Not Found for soft-deleted comment', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_3', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Trying to update deleted comment' },
        })

        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-UPDATE-010: Include user metadata in response', async () => {
        const response = await request.patch('/api/tables/11/records/1/comments/comment_1', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Final update with metadata check' },
        })

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.comment.user).toMatchObject({
          id: 'user_1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          image: 'https://example.com/alice.jpg',
        })
      })
    }
  )
})

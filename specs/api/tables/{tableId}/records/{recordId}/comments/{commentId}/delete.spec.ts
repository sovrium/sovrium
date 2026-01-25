/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Delete comment
 *
 * Domain: api
 * Spec Count: 9
 *
 * Authorization:
 * - Comment author can delete their own comments
 * - Admins can delete any comment in their organization
 * - Soft delete by default (sets deleted_at timestamp)
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (9 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Delete comment', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-001: should return 204 No Content',
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
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_1', 'Comment to delete')
      `)

      // WHEN: User deletes their own comment
      const response = await request.delete('/api/tables/1/records/1/comments/comment_1', {})

      // THEN: Returns 204 No Content
      expect(response.status()).toBe(204)

      // Verify comment is soft-deleted (deleted_at IS NOT NULL)
      const result = await executeQuery(`
        SELECT deleted_at FROM system.record_comments WHERE id = 'comment_1'
      `)
      expect(result.rows[0].deleted_at).not.toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-002: should return 204 No Content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedAdmin }) => {
      // GIVEN: Comment authored by different user, admin user deleting it
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
      await createAuthenticatedAdmin()
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email, role) VALUES
          ('admin_1', 'Admin User', 'admin@example.com', 'admin'),
          ('user_2', 'Bob', 'bob@example.com', 'member')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_2', 'Comment by Bob')
      `)

      // WHEN: Admin deletes another user's comment
      const response = await request.delete('/api/tables/2/records/1/comments/comment_1', {
        headers: {},
      })

      // THEN: Returns 204 No Content (admin can delete any comment)
      expect(response.status()).toBe(204)

      // Verify comment is soft-deleted
      const result = await executeQuery(`
        SELECT deleted_at FROM system.record_comments WHERE id = 'comment_1'
      `)
      expect(result.rows[0].deleted_at).not.toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Comment on a record in authenticated app
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_1', 'Comment to delete')
      `)

      // WHEN: Unauthenticated user attempts to delete comment
      const response = await request.delete('/api/tables/3/records/1/comments/comment_1')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-004: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Comment authored by different user, non-admin attempting to delete
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
        INSERT INTO users (id, name, email, role) VALUES
          ('user_1', 'Alice', 'alice@example.com', 'member'),
          ('user_2', 'Bob', 'bob@example.com', 'member')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_2', 'Comment by Bob')
      `)

      // WHEN: Different non-admin user attempts to delete comment
      const response = await request.delete('/api/tables/4/records/1/comments/comment_1', {})

      // THEN: Returns 403 Forbidden (only author or admin can delete)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
      expect(data.message).toBe('You can only delete your own comments or be an admin')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-005: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with record but comment does not exist
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

      // WHEN: User attempts to delete non-existent comment
      const response = await request.delete('/api/tables/5/records/1/comments/nonexistent', {})

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Comment not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-006: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User from different organization
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 6,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO tasks (id, title, organization_id) VALUES (1, 'Task in Org 456', 'org_456')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_456', 'user_2', 'Comment in org 456')
      `)

      // WHEN: User from org_123 attempts to delete comment from org_456
      const response = await request.delete('/api/tables/6/records/1/comments/comment_1', {
        headers: {},
      })

      // THEN: Returns 404 Not Found (don't leak existence across orgs)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Comment not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-007: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Already soft-deleted comment
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
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content, deleted_at)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_1', 'Already deleted comment', NOW())
      `)

      // WHEN: User attempts to delete already-deleted comment
      const response = await request.delete('/api/tables/7/records/1/comments/comment_1', {})

      // THEN: Returns 404 Not Found (already deleted)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Comment not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-008: should soft-delete by default',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own comment
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
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_1', 'Comment to soft-delete')
      `)

      // WHEN: User deletes comment (default behavior)
      const response = await request.delete('/api/tables/8/records/1/comments/comment_1', {})

      // THEN: Comment is soft-deleted (deleted_at set, record still exists)
      expect(response.status()).toBe(204)

      const result = await executeQuery(`
        SELECT id, content, deleted_at FROM system.record_comments WHERE id = 'comment_1'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].content).toBe('Comment to soft-delete')
      expect(result.rows[0].deleted_at).not.toBeNull()
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-009: should hide deleted comment from GET requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User's own comment
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
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)
      await executeQuery(`
        INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
        VALUES ('comment_1', '1', '1', 'org_123', 'user_1', 'Comment to delete')
      `)

      // WHEN: User deletes comment
      await request.delete('/api/tables/9/records/1/comments/comment_1', {})

      // THEN: Subsequent GET request returns 404
      const getResponse = await request.get('/api/tables/9/records/1/comments/comment_1', {})
      expect(getResponse.status()).toBe(404)

      // THEN: List comments excludes deleted comment
      const listResponse = await request.get('/api/tables/9/records/1/comments', {})
      const listData = await listResponse.json()
      expect(listData.comments).toEqual([])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-DELETE-REGRESSION: user can complete full delete comment workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      executeQuery,
      createAuthenticatedUser,
      createAuthenticatedAdmin,
    }) => {
      await test.step('Setup: Start server with tasks table', async () => {
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
      })

      await test.step('Setup: Insert test records, users, and comments', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title) VALUES (1, 'Task One'), (2, 'Task Two')
        `)
        await executeQuery(`
          INSERT INTO users (id, name, email, role) VALUES
            ('user_1', 'Alice', 'alice@example.com', 'member'),
            ('user_2', 'Bob', 'bob@example.com', 'member'),
            ('admin_1', 'Admin User', 'admin@example.com', 'admin')
        `)
        await executeQuery(`
          INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
          VALUES
            ('comment_1', '1', '1', 'org_123', 'user_1', 'Comment by Alice'),
            ('comment_2', '1', '1', 'org_123', 'user_2', 'Comment by Bob'),
            ('comment_3', '1', '1', 'org_123', 'user_1', 'Another comment by Alice'),
            ('comment_4', '1', '1', 'org_123', 'user_1', 'Yet another comment by Alice'),
            ('comment_5', '1', '1', 'org_123', 'user_1', 'Comment for GET verification')
        `)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-001: User deletes their own comment and returns 204 No Content', async () => {
        const response = await request.delete('/api/tables/10/records/1/comments/comment_1', {})
        expect(response.status()).toBe(204)

        const result = await executeQuery(`
            SELECT deleted_at FROM system.record_comments WHERE id = 'comment_1'
          `)
        expect(result.rows[0].deleted_at).not.toBeNull()
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-002: Admin deletes another user comment and returns 204 No Content', async () => {
        await createAuthenticatedAdmin()
        const response = await request.delete('/api/tables/10/records/1/comments/comment_2', {})
        expect(response.status()).toBe(204)

        const result = await executeQuery(`
            SELECT deleted_at FROM system.record_comments WHERE id = 'comment_2'
          `)
        expect(result.rows[0].deleted_at).not.toBeNull()
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-003: Unauthenticated user attempts to delete comment and returns 401 Unauthorized', async () => {
        const response = await request.delete('/api/tables/10/records/1/comments/comment_3')
        expect(response.status()).toBe(401)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-004: Different non-admin user attempts to delete comment and returns 403 Forbidden', async () => {
        await createAuthenticatedUser()
        await executeQuery(`
            UPDATE system.record_comments SET user_id = 'user_2' WHERE id = 'comment_3'
          `)
        const response = await request.delete('/api/tables/10/records/1/comments/comment_3', {})
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data.error).toBe('Forbidden')
        expect(data.message).toBe('You can only delete your own comments or be an admin')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-005: User attempts to delete non-existent comment and returns 404 Not Found', async () => {
        const response = await request.delete('/api/tables/10/records/1/comments/nonexistent', {})
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Comment not found')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-006: User from different organization attempts to delete comment and returns 404 Not Found', async () => {
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content)
            VALUES ('comment_org_456', '1', '1', 'org_456', 'user_2', 'Comment in org 456')
          `)
        const response = await request.delete(
          '/api/tables/10/records/1/comments/comment_org_456',
          {}
        )
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Comment not found')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-007: User attempts to delete already-deleted comment and returns 404 Not Found', async () => {
        await executeQuery(`
            INSERT INTO system.record_comments (id, record_id, table_id, organization_id, user_id, content, deleted_at)
            VALUES ('comment_deleted', '1', '1', 'org_123', 'user_1', 'Already deleted comment', NOW())
          `)
        const response = await request.delete(
          '/api/tables/10/records/1/comments/comment_deleted',
          {}
        )
        expect(response.status()).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Comment not found')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-008: Comment is soft-deleted by default', async () => {
        const response = await request.delete('/api/tables/10/records/1/comments/comment_4', {})
        expect(response.status()).toBe(204)

        const result = await executeQuery(`
            SELECT id, content, deleted_at FROM system.record_comments WHERE id = 'comment_4'
          `)
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].content).toBe('Yet another comment by Alice')
        expect(result.rows[0].deleted_at).not.toBeNull()
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-DELETE-009: Deleted comment is hidden from GET requests', async () => {
        await request.delete('/api/tables/10/records/1/comments/comment_5', {})

        const getResponse = await request.get('/api/tables/10/records/1/comments/comment_5', {})
        expect(getResponse.status()).toBe(404)

        const listResponse = await request.get('/api/tables/10/records/1/comments', {})
        const listData = await listResponse.json()
        expect(listData.comments.find((c: any) => c.id === 'comment_5')).toBeUndefined()
      })
    }
  )
})

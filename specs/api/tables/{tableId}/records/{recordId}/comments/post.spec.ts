/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Create comment on a record
 *
 * Domain: api
 * Spec Count: 12
 *
 * Comments Feature:
 * - Authentication required (no anonymous comments)
 * - Organization-scoped (multi-tenant)
 * - Validates content (not empty, max length)
 * - Supports @mentions stored as @[user_id]
 * - Auto-injects user_id and organization_id from session
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (11 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Create comment on a record', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-001: should return 201 Created with comment data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server with valid table and record
      await startServerWithSchema({
        name: 'test-app',
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
      await executeQuery(`
        INSERT INTO tasks (id, title, status) VALUES (1, 'Task One', 'active')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)

      // WHEN: User creates a comment on the record
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_1_token',
        },
        data: {
          content: 'This is my first comment on this task.',
        },
      })

      // THEN: Returns 201 Created with comment data
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.comment).toBeDefined()
      expect(data.comment.id).toBeDefined()
      expect(data.comment.content).toBe('This is my first comment on this task.')
      expect(data.comment.userId).toBe('user_1')
      expect(data.comment.recordId).toBe('1')
      expect(data.comment.tableId).toBe('1')
      expect(data.comment.organizationId).toBe('org_123')
      expect(data.comment.createdAt).toBeDefined()

      // Verify comment exists in database
      const result = await executeQuery(`
        SELECT * FROM _sovrium_record_comments WHERE record_id = '1'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].content).toBe('This is my first comment on this task.')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-002: should support @mentions in content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with record and multiple users in the organization
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Collaborative Task')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES
          ('user_1', 'Alice', 'alice@example.com'),
          ('user_2', 'Bob', 'bob@example.com')
      `)

      // WHEN: User creates comment with @mention
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_1_token',
        },
        data: {
          content: 'Hey @[user_2], can you review this task?',
        },
      })

      // THEN: Comment is created with @mention preserved
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.comment.content).toBe('Hey @[user_2], can you review this task?')

      // Verify in database
      const result = await executeQuery(`
        SELECT content FROM _sovrium_record_comments WHERE id = '${data.comment.id}'
      `)
      expect(result.rows[0].content).toContain('@[user_2]')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-003: should return 400 Bad Request for empty content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with a valid record
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: User attempts to create comment with empty content
      const response = await request.post('/api/tables/1/records/1/comments', {
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
      expect(data.error).toBe('Validation error')
      expect(data.message).toContain('content')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-004: should return 400 Bad Request for content too long',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with a valid record
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)

      // WHEN: User attempts to create comment exceeding max length (e.g., 10,000 chars)
      const longContent = 'a'.repeat(10_001)
      const response = await request.post('/api/tables/1/records/1/comments', {
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
      expect(data.error).toBe('Validation error')
      expect(data.message).toContain('content')
      expect(data.message).toContain('maximum length')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-005: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A valid table with record in an authenticated app
      await startServerWithSchema({
        name: 'test-app',
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

      // WHEN: Unauthenticated user attempts to create comment
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Attempting to comment without auth',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-006: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Table exists but record does not
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      // WHEN: User attempts to comment on non-existent record
      const response = await request.post('/api/tables/1/records/9999/comments', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Comment on non-existent record',
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-007: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User from different organization
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'organization_id', type: 'single-line-text' },
            ],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title, organization_id) VALUES (1, 'Task in Org 456', 'org_456')
      `)

      // WHEN: User from org_123 attempts to comment on org_456's record
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer org1_token',
        },
        data: {
          content: 'Cross-org comment attempt',
        },
      })

      // THEN: Returns 404 Not Found (don't leak existence across orgs)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.error).toBe('Record not found')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-008: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: User without read permission for the record
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'confidential_tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO confidential_tasks (id, title) VALUES (1, 'Secret Task')
      `)

      // WHEN: User without permission attempts to comment
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Trying to comment without permission',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('Forbidden')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-009: should auto-inject user_id from session',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Authenticated user attempting to create comment
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)

      // WHEN: User creates comment (user_id auto-injected from session)
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_1_token',
        },
        data: {
          content: 'Comment from authenticated user',
        },
      })

      // THEN: Comment created with correct user_id from session
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.comment.userId).toBe('user_1')

      // Verify in database
      const result = await executeQuery(`
        SELECT user_id FROM _sovrium_record_comments WHERE id = '${data.comment.id}'
      `)
      expect(result.rows[0].user_id).toBe('user_1')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-010: should auto-inject organization_id from session',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Authenticated user in organization
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)
      await executeQuery(`
        INSERT INTO organizations (id, name, slug) VALUES ('org_123', 'Test Org', 'test-org')
      `)

      // WHEN: User creates comment (organization_id auto-injected from session)
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_1_token',
        },
        data: {
          content: 'Comment in organization',
        },
      })

      // THEN: Comment created with correct organization_id from session
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.comment.organizationId).toBe('org_123')

      // Verify in database
      const result = await executeQuery(`
        SELECT organization_id FROM _sovrium_record_comments WHERE id = '${data.comment.id}'
      `)
      expect(result.rows[0].organization_id).toBe('org_123')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-011: should include user metadata in response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: Authenticated user creating a comment
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await executeQuery(`
        INSERT INTO tasks (id, title) VALUES (1, 'Task One')
      `)
      await executeQuery(`
        INSERT INTO users (id, name, email, image) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', 'https://example.com/alice.jpg')
      `)

      // WHEN: User creates comment
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_1_token',
        },
        data: {
          content: 'My comment with user metadata',
        },
      })

      // THEN: Response includes user metadata (name, email, image)
      expect(response.status()).toBe(201)

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
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-012: user can complete full create comment workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with tasks table', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 12,
              name: 'tasks',
              fields: [
                { id: 1, name: 'title', type: 'single-line-text', required: true },
                { id: 2, name: 'status', type: 'single-line-text' },
              ],
            },
          ],
        })
      })

      await test.step('Setup: Insert test record and user', async () => {
        await executeQuery(`
          INSERT INTO tasks (id, title, status) VALUES (1, 'Test Task', 'active')
        `)
        await executeQuery(`
          INSERT INTO users (id, name, email) VALUES ('user_1', 'Test User', 'test@example.com')
        `)
      })

      await test.step('Create comment on the record', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer user_1_token',
          },
          data: {
            content: 'This is a test comment with @[user_1] mention.',
          },
        })

        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.comment.id).toBeDefined()
        expect(data.comment.content).toBe('This is a test comment with @[user_1] mention.')
        expect(data.comment.userId).toBe('user_1')
        expect(data.comment.user.name).toBe('Test User')
      })

      await test.step('Verify comment exists in database', async () => {
        const result = await executeQuery(`
          SELECT * FROM _sovrium_record_comments WHERE record_id = '1'
        `)
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].content).toContain('@[user_1]')
      })
    }
  )
})

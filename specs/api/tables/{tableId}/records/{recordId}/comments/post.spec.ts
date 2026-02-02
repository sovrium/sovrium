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
 * Spec Count: 10
 *
 * Comments Feature:
 * - Authentication required (no anonymous comments)
 * - Owner-scoped (user-level multi-tenancy)
 * - Validates content (not empty, max length)
 * - Supports @mentions stored as @[user_id]
 * - Auto-injects user_id from session
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (10 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Create comment on a record', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test(
    'API-TABLES-RECORDS-COMMENTS-CREATE-001: should return 201 Created with comment data',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: A running server with valid table and record
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
      const auth = await createAuthenticatedUser({ email: 'alice@example.com', name: 'Alice' })
      await executeQuery(`
        INSERT INTO tasks (id, title, status) VALUES (1, 'Task One', 'active')
      `)

      // WHEN: User creates a comment on the record
      const response = await request.post('/api/tables/1/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
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
      expect(data.comment.userId).toBe(auth.userId)
      expect(data.comment.recordId).toBe('1')
      expect(data.comment.tableId).toBe('1')
      expect(data.comment.createdAt).toBeDefined()

      // Verify comment exists in database
      const result = await executeQuery(`
        SELECT * FROM system.record_comments WHERE record_id = '1'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].content).toBe('This is my first comment on this task.')
      expect(result.rows[0].user_id).toBe(auth.userId)
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-CREATE-002: should support @mentions in content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with record and multiple users in the organization
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
        INSERT INTO auth.user (id, name, email) VALUES
          ('user_1', 'Alice', 'alice@example.com'),
          ('user_2', 'Bob', 'bob@example.com')
      `)

      // WHEN: User creates comment with @mention
      const response = await request.post('/api/tables/2/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
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
        SELECT content FROM system.record_comments WHERE id = '${data.comment.id}'
      `)
      expect(result.rows[0].content).toContain('@[user_2]')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-003: should return 400 Bad Request for empty content',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a valid record
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

      // WHEN: User attempts to create comment with empty content
      const response = await request.post('/api/tables/3/records/1/comments', {
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
      expect(data.code).toBe('VALIDATION_ERROR')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-004: should return 400 Bad Request for content too long',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Table with a valid record
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

      // WHEN: User attempts to create comment exceeding max length (e.g., 10,000 chars)
      const longContent = 'a'.repeat(10_001)
      const response = await request.post('/api/tables/4/records/1/comments', {
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
      expect(data.code).toBe('VALIDATION_ERROR')
    }
  )

  test(
    'API-TABLES-RECORDS-COMMENTS-CREATE-005: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery }) => {
      // GIVEN: A valid table with record in an authenticated app
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

      // WHEN: Unauthenticated user attempts to create comment
      const response = await request.post('/api/tables/5/records/1/comments', {
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
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Table exists but record does not
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

      // WHEN: User attempts to comment on non-existent record
      const response = await request.post('/api/tables/6/records/9999/comments', {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-007: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Record owned by different user
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 7,
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

      // WHEN: user_1 attempts to comment on user_2's record
      const response = await request.post('/api/tables/7/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Cross-owner comment attempt',
        },
      })

      // THEN: Returns 404 Not Found (prevent owner enumeration)
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Resource not found')
      expect(data.code).toBe('NOT_FOUND')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-008: should return 403 Forbidden',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: User without read permission for the record
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 8,
            name: 'confidential_tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })
      await createAuthenticatedUser()
      await executeQuery(`
        INSERT INTO confidential_tasks (id, title) VALUES (1, 'Secret Task')
      `)

      // WHEN: User without permission attempts to comment
      const response = await request.post('/api/tables/8/records/1/comments', {
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
      expect(data.success).toBe(false)
      expect(data.message).toBe('You do not have permission to perform this action')
      expect(data.code).toBe('FORBIDDEN')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-009: should auto-inject user_id from session',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Authenticated user attempting to create comment
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
        INSERT INTO auth.user (id, name, email) VALUES ('user_1', 'Alice', 'alice@example.com')
      `)

      // WHEN: User creates comment (user_id auto-injected from session)
      const response = await request.post('/api/tables/9/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
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
        SELECT user_id FROM system.record_comments WHERE id = '${data.comment.id}'
      `)
      expect(result.rows[0].user_id).toBe('user_1')
    }
  )

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-010: should include user metadata in response',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // GIVEN: Authenticated user creating a comment
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
        tables: [
          {
            id: 11,
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
        INSERT INTO auth.user (id, name, email, image) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', 'https://example.com/alice.jpg')
      `)

      // WHEN: User creates comment
      const response = await request.post('/api/tables/11/records/1/comments', {
        headers: {
          'Content-Type': 'application/json',
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
  // Generated from 10 @spec tests - covers: creation, mentions, validation, auth, permissions, auto-injection
  // ============================================================================

  test.fixme(
    'API-TABLES-RECORDS-COMMENTS-CREATE-REGRESSION: user can complete full create comment workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, createAuthenticatedUser }) => {
      // Setup: Start server with comprehensive configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'title', type: 'single-line-text', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'single-line-text' },
            ],
          },
        ],
      })

      await executeQuery(`
        INSERT INTO tasks (id, title, status, owner_id) VALUES
          (1, 'Task One', 'active', 'user_1'),
          (2, 'Task owned by user_2', 'active', 'user_2')
      `)

      // --- Step 005: 401 Unauthorized (BEFORE authentication) ---
      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-005: Return 401 Unauthorized', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Attempting to comment without auth' },
        })

        expect(response.status()).toBe(401)
      })

      // --- Authenticate ---
      await createAuthenticatedUser()

      await executeQuery(`
        INSERT INTO auth.user (id, name, email, image) VALUES
          ('user_1', 'Alice Johnson', 'alice@example.com', 'https://example.com/alice.jpg'),
          ('user_2', 'Bob Smith', 'bob@example.com', NULL)
      `)

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-001: Return 201 Created with comment data', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'This is my first comment on this task.' },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.comment.id).toBeDefined()
        expect(data.comment.content).toBe('This is my first comment on this task.')
        expect(data.comment.userId).toBe('user_1')
        expect(data.comment.recordId).toBe('1')
        expect(data.comment.tableId).toBe('1')
        expect(data.comment.createdAt).toBeDefined()

        // Verify in database
        const result = await executeQuery(`
          SELECT * FROM system.record_comments WHERE record_id = '1' AND table_id = '1'
        `)
        expect(result.rows.length).toBeGreaterThan(0)
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-002: Support @mentions in content', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Hey @[user_2], can you review this task?' },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.comment.content).toBe('Hey @[user_2], can you review this task?')

        const result = await executeQuery(`
          SELECT content FROM system.record_comments WHERE id = '${data.comment.id}'
        `)
        expect(result.rows[0].content).toContain('@[user_2]')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-003: Return 400 for empty content', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: '' },
        })

        expect(response.status()).toBe(400)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-004: Return 400 for content too long', async () => {
        const longContent = 'a'.repeat(10_001)
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: longContent },
        })

        expect(response.status()).toBe(400)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-006: Return 404 for non-existent record', async () => {
        const response = await request.post('/api/tables/1/records/9999/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Comment on non-existent record' },
        })

        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-007: Return 404 for cross-owner access', async () => {
        // user_1 attempts to comment on user_2's record
        const response = await request.post('/api/tables/1/records/2/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Cross-owner comment attempt' },
        })

        expect(response.status()).toBe(404)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.message).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })

      // --- Step 008 skipped: requires different auth context ---
      // API-TABLES-RECORDS-COMMENTS-CREATE-008 tests 403 Forbidden without permission.
      // This needs a table with permissions config and createAuthenticatedViewer,
      // which would invalidate the current session for subsequent tests.
      // Covered by @spec test API-TABLES-RECORDS-COMMENTS-CREATE-008.

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-009: Auto-inject user_id from session', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Comment from authenticated user' },
        })

        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.comment.userId).toBe('user_1')

        const result = await executeQuery(`
          SELECT user_id FROM system.record_comments WHERE id = '${data.comment.id}'
        `)
        expect(result.rows[0].user_id).toBe('user_1')
      })

      await test.step('API-TABLES-RECORDS-COMMENTS-CREATE-010: Include user metadata in response', async () => {
        const response = await request.post('/api/tables/1/records/1/comments', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'My comment with user metadata' },
        })

        expect(response.status()).toBe(201)
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

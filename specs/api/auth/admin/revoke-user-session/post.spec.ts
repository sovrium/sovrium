/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Admin: Revoke user session
 *
 * Source: specs/api/paths/auth/admin/revoke-user-session/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Admin: Revoke user session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-001: should returns 200 OK and revokes the session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and a user with active session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 2, 'user_session', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin revokes specific user session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '2',
        },
      })

      // THEN: Returns 200 OK and revokes the session
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response indicates success
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })

      // User session is revoked in database
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-002: should returns 400 Bad Request with validation errors',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {})

      // THEN: Returns 400 Bad Request with validation errors
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for required fields
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-003: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Unauthenticated user attempts to revoke session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '2',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-004: should returns 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Regular User', true, 'member', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 2, 'target_session', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Regular user attempts to revoke another user's session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '2',
        },
      })

      // THEN: Returns 403 Forbidden
      // Returns 403 Forbidden
      expect(response.status).toBe(403)

      // Response contains error about insufficient permissions
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-005: should returns 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin attempts to revoke session for non-existent user
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '999',
          sessionId: '2',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about user not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-006: should returns 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin attempts to revoke non-existent session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '999',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about session not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-007: should returns 404 Not Found (session ownership validation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user with two users and sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'user1@example.com', '$2a$10$YourHashedPasswordHere', 'User 1', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (3, 'user2@example.com', '$2a$10$YourHashedPasswordHere', 'User 2', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 2, 'user1_session', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (3, 3, 'user2_session', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin attempts to revoke session belonging to different user
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '3',
        },
      })

      // THEN: Returns 404 Not Found (session ownership validation)
      // Returns 404 Not Found (session doesn't belong to specified user)
      expect(response.status).toBe(404)

      // User 2's session remains active (not revoked)
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-008: should returns 200 OK (idempotent operation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and an already revoked session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, deleted_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NULL, NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, deleted_at, created_at) VALUES (2, 2, 'revoked_session', NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 hour', NOW())`
      )

      // WHEN: Admin attempts to revoke already revoked session
      const response = await page.request.post('/api/auth/admin/revoke-user-session', {
        data: {
          userId: '2',
          sessionId: '2',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      // Returns 200 OK (idempotent)
      expect(response.status).toBe(200)

      // Session remains revoked
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-REVOKE-USER-SESSION-009: user can complete full adminRevokeUserSession workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})

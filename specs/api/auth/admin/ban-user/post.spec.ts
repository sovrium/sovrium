/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Admin: Ban user
 *
 * Source: specs/api/paths/auth/admin/ban-user/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Admin: Ban user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-001: should returns 200 OK and bans user with all sessions revoked',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and an active user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, banned, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, banned, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 2, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin bans the user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 200 OK and bans user with all sessions revoked
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response indicates success
      const data = await response.json()
      // Validate response schema
      expect(data).toMatchObject({
        success: true,
        user: {
          id: '2',
          email: 'target@example.com',
          banned: true,
        },
      })

      // User is marked as banned in database
      const bannedUser = await executeQuery(`SELECT id, email, banned FROM users WHERE id = 2`)
      expect(bannedUser).toMatchObject({
        id: 2,
        email: 'target@example.com',
        banned: true,
      })

      // User sessions are revoked
      const sessions = await executeQuery(
        `SELECT COUNT(*) as count FROM sessions WHERE user_id = 2`
      )
      expect(sessions.count).toBe(0)
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-002: should returns 200 OK and stores ban reason',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and an active user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, banned, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, banned, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin bans user with reason
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
          reason: 'Violation of terms of service',
        },
      })

      // THEN: Returns 200 OK and stores ban reason
      // Returns 200 OK
      expect(response.status).toBe(200)

      // User is banned with reason stored
      const bannedUser = await executeQuery(
        `SELECT id, email, banned, ban_reason FROM users WHERE id = 2`
      )
      expect(bannedUser).toMatchObject({
        id: 2,
        email: 'target@example.com',
        banned: true,
        ban_reason: 'Violation of terms of service',
      })
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-003: should returns 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin submits request without userId
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for userId field
      const data = await response.json()
      expect(data).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('userId'),
      })
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-004: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // WHEN: Unauthenticated user attempts to ban user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      expect(data).toMatchObject({
        error: expect.any(String),
        message: expect.stringMatching(/unauthorized|authentication/i),
      })
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-005: should returns 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
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

      // WHEN: Regular user attempts to ban another user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 403 Forbidden
      // Returns 403 Forbidden
      expect(response.status).toBe(403)

      // Response contains error about insufficient permissions
      const data = await response.json()
      expect(data).toMatchObject({
        error: expect.any(String),
        message: expect.stringMatching(/forbidden|permission|admin/i),
      })
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-006: should returns 404 Not Found',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin attempts to ban non-existent user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '999',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about user not found
      const data = await response.json()
      expect(data).toMatchObject({
        error: expect.any(String),
        message: expect.stringMatching(/not found|does not exist/i),
      })
    }
  )

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-007: should returns 200 OK (idempotent operation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated admin user and an already banned user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, banned, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, banned, created_at, updated_at) VALUES (2, 'target@example.com', '$2a$10$YourHashedPasswordHere', 'Target User', true, true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Admin bans already banned user
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      // Returns 200 OK (idempotent)
      expect(response.status).toBe(200)

      // User remains banned
      const bannedUser = await executeQuery(`SELECT id, email, banned FROM users WHERE id = 2`)
      expect(bannedUser).toMatchObject({
        id: 2,
        email: 'target@example.com',
        banned: true,
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ADMIN-BAN-USER-008: user can complete full adminBanUser workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Representative test scenario with admin and regular users
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      // Setup admin and target user
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, banned, created_at, updated_at) VALUES (1, 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'Admin User', true, 'admin', false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, banned, created_at, updated_at) VALUES (2, 'violator@example.com', '$2a$10$YourHashedPasswordHere', 'Violating User', true, false, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'admin_token', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 2, 'violator_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Execute workflow - Admin bans user with policy violation
      const response = await page.request.post('/api/auth/admin/ban-user', {
        data: {
          userId: '2',
          reason: 'Repeated policy violations',
        },
      })

      // THEN: Verify integration - User banned, sessions revoked, reason stored
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({
        success: true,
        user: {
          id: '2',
          banned: true,
        },
      })

      // Verify database state reflects complete ban workflow
      const bannedUser = await executeQuery(
        `SELECT id, email, banned, ban_reason FROM users WHERE id = 2`
      )
      expect(bannedUser).toMatchObject({
        id: 2,
        email: 'violator@example.com',
        banned: true,
        ban_reason: 'Repeated policy violations',
      })

      const activeSessions = await executeQuery(
        `SELECT COUNT(*) as count FROM sessions WHERE user_id = 2`
      )
      expect(activeSessions.count).toBe(0)
    }
  )
})

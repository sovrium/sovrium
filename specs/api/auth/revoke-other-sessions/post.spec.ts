/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Revoke all other sessions
 *
 * Source: specs/api/paths/auth/revoke-other-sessions/post.json
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Revoke all other sessions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-REVOKE-OTHER-SESSIONS-001: should returns 200 OK and revokes all sessions except current one',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with multiple active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'current_session', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 1, 'other_session_1', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (3, 1, 'other_session_2', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User revokes all other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 200 OK and revokes all sessions except current one
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response indicates success
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })

      // Other sessions are revoked in database
      const otherSessions = await executeQuery(
        "SELECT COUNT(*) as count FROM sessions WHERE user_id = 1 AND token != 'current_session'"
      )
      expect(otherSessions.count).toBe(0)

      // Current session remains active
      const currentSession = await executeQuery(
        "SELECT * FROM sessions WHERE token = 'current_session' LIMIT 1"
      )
      expect(currentSession).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-OTHER-SESSIONS-002: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Unauthenticated user attempts to revoke other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-OTHER-SESSIONS-003: should returns 200 OK (no sessions to revoke)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with only current session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'current_session', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User revokes other sessions (none exist)
      const response = await page.request.post('/api/auth/revoke-other-sessions', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 200 OK (no sessions to revoke)
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Current session remains active
      const currentSession = await executeQuery(
        "SELECT * FROM sessions WHERE token = 'current_session' LIMIT 1"
      )
      expect(currentSession).toBeDefined()

      // No other sessions exist for this user
      const totalSessions = await executeQuery(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = 1'
      )
      expect(totalSessions.count).toBe(1)
    }
  )

  test.fixme(
    'API-AUTH-REVOKE-OTHER-SESSIONS-004: should returns 200 OK and revokes all sessions except current device',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with sessions across multiple devices
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at) VALUES (1, 1, 'desktop_session', '192.168.1.10', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at) VALUES (2, 1, 'mobile_session', '192.168.1.20', 'Mozilla/5.0 (iPhone; iOS 17.0) Safari/17.0', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at) VALUES (3, 1, 'tablet_session', '192.168.1.30', 'Mozilla/5.0 (iPad; iPadOS 17.0) Safari/17.0', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User revokes other sessions from one device
      const response = await page.request.post('/api/auth/revoke-other-sessions', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 200 OK and revokes all sessions except current device
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Mobile and tablet sessions are revoked
      const revokedSessions = await executeQuery(
        "SELECT COUNT(*) as count FROM sessions WHERE user_id = 1 AND token != 'desktop_session'"
      )
      expect(revokedSessions.count).toBe(0)

      // Desktop session (current) remains active
      const desktopSession = await executeQuery(
        "SELECT * FROM sessions WHERE token = 'desktop_session' LIMIT 1"
      )
      expect(desktopSession).toBeDefined()
    }
  )

  test.fixme(
    "API-AUTH-REVOKE-OTHER-SESSIONS-005: should returns 200 OK and only revokes User A's sessions (User B unaffected)",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two users with multiple sessions each
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user1@example.com', '$2a$10$YourHashedPasswordHere', 'User 1', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'user2@example.com', '$2a$10$YourHashedPasswordHere', 'User 2', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user1_session1', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 1, 'user1_session2', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (3, 2, 'user2_session1', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (4, 2, 'user2_session2', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User A revokes their other sessions
      const response = await page.request.post('/api/auth/revoke-other-sessions', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 200 OK and only revokes User A's sessions (User B unaffected)
      // Returns 200 OK
      expect(response.status).toBe(200)

      // User 1's other session is revoked
      const user1OtherSessions = await executeQuery(
        "SELECT COUNT(*) as count FROM sessions WHERE user_id = 1 AND token != 'user1_session1'"
      )
      expect(user1OtherSessions.count).toBe(0)

      // User 1's current session remains active
      const user1CurrentSession = await executeQuery(
        "SELECT * FROM sessions WHERE token = 'user1_session1' LIMIT 1"
      )
      expect(user1CurrentSession).toBeDefined()

      // User 2's sessions remain unaffected
      const user2Sessions = await executeQuery(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = 2'
      )
      expect(user2Sessions.count).toBe(2)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-REVOKE-OTHER-SESSIONS-005: user can complete full revokeOtherSessions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        headers: { Authorization: 'Bearer admin_token' },
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})

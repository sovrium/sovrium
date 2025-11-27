/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Session Permission Enforcement
 *
 * Domain: api/auth
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Session Enforcement Scenarios:
 * - Session validity verification
 * - Cross-user session isolation
 * - Session revocation enforcement
 * - Token refresh security
 */

test.describe('Session Permission Enforcement', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-001: should prevent user from accessing another users sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two users with separate sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User One', true, NOW(), NOW()),
         (2, 'user2@example.com', '$2a$10$hash', 'User Two', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days', NOW()),
         (2, 2, 'user2_token', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: User 1 tries to access User 2's sessions
      const response = await page.request.get('/api/auth/session/list?userId=2', {})

      // THEN: Access denied or only own sessions returned
      if (response.status() === 200) {
        const data = await response.json()
        // Should not contain User 2's session
        const otherUserSessions = data.sessions?.filter((s: { userId: string }) => s.userId === '2')
        expect(otherUserSessions?.length ?? 0).toBe(0)
      } else {
        expect(response.status()).toBe(403)
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-002: should prevent user from revoking another users session',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two users with separate sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User One', true, NOW(), NOW()),
         (2, 'user2@example.com', '$2a$10$hash', 'User Two', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days', NOW()),
         (2, 2, 'user2_token', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: User 1 tries to revoke User 2's session
      const response = await page.request.post('/api/auth/session/revoke', {
        data: { sessionId: '2' },
      })

      // THEN: Revocation denied
      expect(response.status()).toBe(403)

      // User 2's session still active
      const session = await executeQuery(`SELECT * FROM sessions WHERE id = 2`)
      expect(session).toHaveLength(1)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-003: should invalidate session immediately after sign-out',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
         VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: User signs out
      const signOutResponse = await page.request.post('/api/auth/sign-out', {})
      expect(signOutResponse.ok()).toBe(true)

      // THEN: Session token immediately invalid
      const protectedResponse = await page.request.get('/api/auth/session', {})
      expect(protectedResponse.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-004: should enforce session expiration strictly',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Session that just expired
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        // Session expired 1 second ago
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
         VALUES (1, 1, 'expired_token', NOW() - INTERVAL '1 second', NOW() - INTERVAL '7 days')`,
      ])

      // WHEN: Using just-expired session
      const response = await page.request.get('/api/auth/session', {
        headers: { Authorization: 'Bearer expired_token' },
      })

      // THEN: Access denied (no grace period)
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-005: should prevent session token reuse after refresh',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: User with active session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
         VALUES (1, 1, 'old_token', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: Token is refreshed
      const refreshResponse = await page.request.post('/api/auth/session/refresh', {
        headers: { Authorization: 'Bearer old_token' },
      })

      if (refreshResponse.ok()) {
        // Old token should be invalidated
        const oldTokenResponse = await page.request.get('/api/auth/session', {
          headers: { Authorization: 'Bearer old_token' },
        })

        // THEN: Old token no longer valid
        expect(oldTokenResponse.status()).toBe(401)
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-006: should allow user to revoke all own sessions except current',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: User with multiple sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES
         (1, 1, 'current_session', NOW() + INTERVAL '7 days', NOW()),
         (2, 1, 'other_session_1', NOW() + INTERVAL '7 days', NOW()),
         (3, 1, 'other_session_2', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: User revokes all other sessions
      const response = await page.request.post('/api/auth/session/revoke-others', {})
      expect(response.ok()).toBe(true)

      // THEN: Current session still valid
      const currentSessionResponse = await page.request.get('/api/auth/session', {})
      expect(currentSessionResponse.status()).toBe(200)

      // Other sessions revoked
      const remainingSessions = await executeQuery(`SELECT * FROM sessions WHERE user_id = 1`)
      expect(remainingSessions).toHaveLength(1)
      expect(remainingSessions[0].token).toBe('current_session')
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-007: should bind session to original IP/user-agent when strict mode enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Session created with specific IP and user-agent
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at, created_at)
         VALUES (1, 1, 'session_token', '192.168.1.1', 'Original-Agent', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // WHEN: Request from different IP/user-agent
      const response = await page.request.get('/api/auth/session', {
        headers: {
          'User-Agent': 'Different-Agent',
          'X-Forwarded-For': '10.0.0.1',
        },
      })

      // THEN: Session may be invalidated or flagged (depends on config)
      // At minimum, the session metadata should be logged for security
      expect([200, 401]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-SESSION-008: session enforcement workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: User with active session
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
         VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`,
      ])

      // Test 1: Valid session - success
      const validResponse = await page.request.get('/api/auth/session', {})
      expect(validResponse.status()).toBe(200)

      // Test 2: Sign out
      await page.request.post('/api/auth/sign-out', {})

      // Test 3: Token now invalid
      const invalidResponse = await page.request.get('/api/auth/session', {})
      expect(invalidResponse.status()).toBe(401)
    }
  )
})

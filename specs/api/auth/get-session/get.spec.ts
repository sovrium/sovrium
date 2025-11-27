/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Get current session
 *
 * Source: specs/api/paths/auth/get-session/get.json
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

test.describe('Get current session', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-GET-SESSION-001: should returns 200 OK with session and user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with active session
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
        `INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at) VALUES (1, 1, 'valid_session_token', NOW() + INTERVAL '7 days', '192.168.1.1', 'Mozilla/5.0', NOW(), NOW())`
      )

      // WHEN: User requests current session information
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer valid_session_token',
        },
      })

      // THEN: Returns 200 OK with session and user data
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains session and user data
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('session')
      expect(data).toHaveProperty('user')

      // User password is not included in response (security)
    }
  )

  test.fixme(
    'API-AUTH-GET-SESSION-002: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
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

      // WHEN: User requests session without authentication token
      const response = await page.request.get('/api/auth/get-session')

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
    'API-AUTH-GET-SESSION-003: should returns 401 Unauthorized',
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

      // WHEN: User requests session with invalid token
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about invalid token
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-GET-SESSION-004: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with expired session token
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
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at, updated_at) VALUES (1, 1, 'expired_token', NOW() - INTERVAL '1 day', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')`
      )

      // WHEN: User requests session with expired token
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer expired_token',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about expired token
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-GET-SESSION-005: should returns session with IP address and user agent metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with session metadata
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
        `INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', '203.0.113.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', NOW(), NOW())`
      )

      // WHEN: User requests session information
      const response = await page.request.get('/api/auth/get-session', {
        headers: {
          Authorization: 'Bearer valid_token',
        },
      })

      // THEN: Returns session with IP address and user agent metadata
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response includes session metadata (IP and user agent)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-GET-SESSION-006: user can complete full getSession workflow',
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

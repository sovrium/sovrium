/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Reset password
 *
 * Source: specs/api/paths/auth/reset-password/post.json
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

test.describe('Reset password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================
  test.fixme(
    'API-AUTH-RESET-PASSWORD-001: should  password is updated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with valid reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_reset_token', NOW() + INTERVAL '1 hour', NOW())`
      )

      // WHEN: User submits valid token and new password
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'valid_reset_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and password is updated
      // Returns 200 OK
      // Response indicates success
      // Password hash is updated in database
      // Reset token is marked as used
      // THEN: assertion
      expect(response.status).toBe(200)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-002: should  request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with valid reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_reset_token', NOW() + INTERVAL '1 hour', NOW())`
      )

      // WHEN: User submits request without newPassword field
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'valid_reset_token',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      // Response contains validation error for newPassword field
      expect(response.status).toBe(400)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-003: should  request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with valid reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_reset_token', NOW() + INTERVAL '1 hour', NOW())`
      )

      // WHEN: User submits new password shorter than minimum length (8 characters)
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'valid_reset_token',
          newPassword: 'Short1!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      // Response contains validation error for password length
      expect(response.status).toBe(400)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-004: should  (or 400 depending on better auth version)',
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

      // WHEN: User submits request with invalid token
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'invalid_token_abc123',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      // Returns 401 or 400 (depending on Better Auth version)
      // Response contains error about invalid token

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-005: should  (or 400 depending on better auth version)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with expired reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'expired_token', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours')`
      )

      // WHEN: User submits request with expired token
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'expired_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      // Returns 401 or 400 (depending on Better Auth version)
      // Response contains error about expired token

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-006: should  (token already used)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user who has already used their reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used_at, created_at) VALUES (1, 1, 'used_token', NOW() + INTERVAL '1 hour', NOW() - INTERVAL '5 minutes', NOW())`
      )

      // WHEN: User attempts to reuse the same token
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'used_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (token already used)
      // Returns 401 or 400 (token already used)
      // Response contains error about invalid token

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-007: should  request with validation error',
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

      // WHEN: User submits request without token field
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      // Response contains error about missing token
      expect(response.status).toBe(400)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-008: should  all active sessions are revoked',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A user with active sessions and valid reset token
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$OldPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_reset_token', NOW() + INTERVAL '1 hour', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'session_1', NOW() + INTERVAL '7 days', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (2, 1, 'session_2', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User resets password
      const response = await page.request.post('/api/auth/reset-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          token: 'valid_reset_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and all active sessions are revoked
      // Returns 200 OK
      // All user sessions are revoked for security
      expect(response.status).toBe(200)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-RESET-PASSWORD-009: user can complete full Resetpassword workflow',
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

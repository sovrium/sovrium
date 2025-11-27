/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Change password
 *
 * Source: specs/api/paths/auth/change-password/post.json
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

test.describe('Change password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================
  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-001: should  password is updated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with valid current password
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits correct current password and valid new password
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and password is updated
      // Returns 200 OK
      // Response contains user data
      // Password hash is updated in database
      // THEN: assertion
      expect(response.status).toBe(200)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-002: should  with new token and revokes all other sessions',
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
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

      // WHEN: User changes password with revokeOtherSessions enabled
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer current_session',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
          revokeOtherSessions: true,
        },
      })

      // THEN: Returns 200 OK with new token and revokes all other sessions
      // Returns 200 OK
      // Response contains new token
      // Other sessions are revoked in database
      // THEN: assertion
      expect(response.status).toBe(200)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-003: should  request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits request without newPassword field
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      // Response contains validation error for newPassword field
      expect(response.status).toBe(400)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-004: should  request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits request without currentPassword field
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      // Response contains validation error for currentPassword field
      expect(response.status).toBe(400)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-005: should  request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits new password shorter than minimum length (8 characters)
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
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
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-006: should',
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

      // WHEN: Unauthenticated user attempts to change password
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      // Response contains error about missing authentication
      expect(response.status).toBe(401)

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-007: should  (or 400 bad request depending on better auth version)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits incorrect current password
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 Bad Request depending on Better Auth version)
      // Returns 401 or 400 (depending on Better Auth version)
      // Response contains error about invalid password

      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-008: should  (same password allowed) or 400 (rejected)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourCurrentPasswordHash', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User attempts to change password to the same password
      const response = await page.request.post('/api/auth/change-password', {
        headers: {
          Authorization: 'Bearer valid_token',
          'Content-Type': 'application/json',
        },
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'CurrentPass123!',
        },
      })

      // THEN: Returns 200 OK (same password allowed) or 400 (rejected)
      // Returns success or validation error (implementation-dependent)

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
    'API-AUTH-CHANGE-PASSWORD-009: user can complete full Changepassword workflow',
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

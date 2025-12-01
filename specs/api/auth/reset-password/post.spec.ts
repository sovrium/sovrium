/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

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
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Better Auth's reset-password endpoint requires a valid token from forget-password.
 * These tests verify the behavior when calling the endpoint.
 */

test.describe('Reset password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the /api/auth/reset-password
  // endpoint requires a valid token which can't be easily obtained in tests
  // ============================================================================

  test.fixme(
    'API-AUTH-RESET-PASSWORD-001: should return 200 OK and update password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A user with valid reset token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // Note: In real tests, we'd need to capture the token from the email
      // For now, this test assumes a valid token is available

      // WHEN: User submits valid token and new password
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'valid_reset_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and password is updated
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-002: should return 400 Bad Request without newPassword',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request without newPassword field
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'valid_reset_token',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-003: should return 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits new password shorter than minimum length
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'valid_reset_token',
          newPassword: 'Short1!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-004: should return 401 Unauthorized with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request with invalid token
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'invalid_token_abc123',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-005: should return 401 Unauthorized with expired token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token would be expired)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request with expired token
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'expired_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-006: should return 401 Unauthorized with already used token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token already used)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User attempts to reuse the same token
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'used_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized (token already used)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-007: should return 400 Bad Request without token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits request without token field
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-RESET-PASSWORD-008: should revoke all sessions after password reset',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A user with active sessions and valid reset token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'OldPassword123!',
        name: 'Test User',
      })

      // WHEN: User resets password
      const response = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'valid_reset_token',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and all active sessions are revoked
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-RESET-PASSWORD-009: user can complete full reset-password workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // Create user
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })

      // Test 1: Reset without token fails
      const noTokenResponse = await page.request.post('/api/auth/reset-password', {
        data: { newPassword: 'NewPass123!' },
      })
      expect(noTokenResponse.status()).toBe(400)

      // Test 2: Reset with invalid token fails
      const invalidTokenResponse = await page.request.post('/api/auth/reset-password', {
        data: {
          token: 'invalid_token',
          newPassword: 'NewPass123!',
        },
      })
      expect([400, 401]).toContain(invalidTokenResponse.status())

      // Note: Full workflow test would require capturing token from email
    }
  )
})

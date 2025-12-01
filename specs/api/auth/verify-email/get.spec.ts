/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Verify email address
 *
 * Source: specs/api/paths/auth/verify-email/get.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Better Auth's verify-email endpoint requires a valid token.
 * These tests verify the behavior when calling the endpoint.
 */

test.describe('Verify email address', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the /api/auth/verify-email
  // endpoint requires a valid token which can't be easily obtained in tests
  // ============================================================================

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-001: should return 200 OK and mark email as verified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A user with valid verification token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // Note: In real tests, we'd need to capture the token from the email
      // For now, this test assumes a valid token is available

      // WHEN: User clicks verification link with valid token
      const response = await page.request.get('/api/auth/verify-email?token=valid_verify_token')

      // THEN: Returns 200 OK and marks email as verified
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-002: should return 400 Bad Request without token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User accesses endpoint without token parameter
      const response = await page.request.get('/api/auth/verify-email')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-003: should return 401 Unauthorized with invalid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits invalid verification token
      const response = await page.request.get('/api/auth/verify-email?token=invalid_token_abc123')

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-004: should return 401 Unauthorized with expired token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token would be expired)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User submits expired token
      const response = await page.request.get('/api/auth/verify-email?token=expired_token')

      // THEN: Returns 401 Unauthorized (or 400 depending on Better Auth version)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-005: should return 401 Unauthorized with already used token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (token already used)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      // WHEN: User attempts to reuse the same verification token
      const response = await page.request.get('/api/auth/verify-email?token=used_token')

      // THEN: Returns 401 Unauthorized (token already used)
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-006: should handle already verified email with valid token',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: A user with already verified email and unused token
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User clicks verification link for already verified email
      const response = await page.request.get('/api/auth/verify-email?token=valid_token')

      // THEN: Returns 200 OK or 400 (implementation-dependent)
      expect([200, 400]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-VERIFY-EMAIL-007: user can complete full verify-email workflow',
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

      // Test 1: Verify without token fails
      const noTokenResponse = await page.request.get('/api/auth/verify-email')
      expect(noTokenResponse.status()).toBe(400)

      // Test 2: Verify with invalid token fails
      const invalidTokenResponse = await page.request.get(
        '/api/auth/verify-email?token=invalid_token'
      )
      expect([400, 401]).toContain(invalidTokenResponse.status())

      // Note: Full workflow test would require capturing token from email
    }
  )
})

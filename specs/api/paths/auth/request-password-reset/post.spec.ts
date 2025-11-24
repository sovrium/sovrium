/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for POST /api/auth/request-password-reset
 *
 * Specification:
 * - Request password reset endpoint must send password reset email
 * - Must validate email format
 * - Must return success even for non-existent emails (security: don't leak user existence)
 * - Email should contain reset token and redirect URL
 *
 * Reference Implementation:
 * - Better Auth: src/infrastructure/auth/better-auth/auth.ts
 * - OpenAPI Spec: specs/api/paths/auth/forget-password/post.json
 *
 * Note: Better Auth v1.4.0+ uses /api/auth/request-password-reset endpoint
 */

const generateTestUser = () => ({
  email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  password: 'SecurePassword123!',
  name: 'Test User',
})

/**
 * Test Case 1: Forget password sends reset email
 *
 * GIVEN: A user account exists
 * WHEN: User requests password reset
 * THEN: Response should indicate email was sent
 *
 * NOTE: Actual email delivery depends on email service configuration.
 * This test validates the endpoint behavior, not email delivery.
 */
// API-AUTH-FORGET-PASSWORD-001: User requests password reset
test(
  'API-AUTH-FORGET-PASSWORD-001: should accept password reset request',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: A running server
    await startServerWithSchema(
      {
        name: 'forget-password-test',
      },
      { useDatabase: true }
    )

    // AND: A user that signed up
    const testUser = generateTestUser()
    await page.request.post('/api/auth/sign-up/email', {
      data: {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      },
    })

    // WHEN: User requests password reset
    const response = await page.request.post('/api/auth/request-password-reset', {
      data: {
        email: testUser.email,
        redirectTo: 'https://app.example.com/reset-password',
      },
    })

    // THEN: Response should be 200 OK
    expect(response.status()).toBe(200)

    const responseData = await response.json()

    // AND: Response should indicate success
    expect(responseData).toHaveProperty('status', true)
  }
)

/**
 * Test Case 2: Forget password validates email format
 *
 * GIVEN: A running server
 * WHEN: User submits invalid email format
 * THEN: Response should be validation error
 */
// API-AUTH-FORGET-PASSWORD-002: User requests password reset with invalid email
test(
  'API-AUTH-FORGET-PASSWORD-002: should validate email format',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: A running server
    await startServerWithSchema(
      {
        name: 'forget-password-validation-test',
      },
      { useDatabase: true }
    )

    // WHEN: User requests password reset with invalid email
    const response = await page.request.post('/api/auth/request-password-reset', {
      data: {
        email: 'not-an-email',
        redirectTo: 'https://app.example.com/reset-password',
      },
    })

    // THEN: Response should be validation error (4xx)
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  }
)

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Verify Two-Factor Authentication Code
 *
 * Source: src/domain/models/app/auth/plugins/two-factor.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Verify Two-Factor Authentication Code', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-001: should verify valid TOTP code successfully',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: User with 2FA enabled and valid TOTP code
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: {
              issuer: 'Test App',
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA and get secret
      const enableResponse = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const { secret } = await enableResponse.json()

      // Generate valid TOTP code from secret (using TOTP algorithm)
      // Note: Implementation will need to use a TOTP library to generate code
      const totpCode = '123456' // Placeholder - actual implementation will generate from secret

      // WHEN: User submits valid TOTP code
      const response = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          code: totpCode,
        },
      })

      // THEN: Returns 200 OK confirming verification
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('verified')
      expect(data.verified).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-002: should reject invalid TOTP code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: User with 2FA enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: true,
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA
      await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // WHEN: User submits invalid TOTP code
      const response = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          code: '000000', // Invalid code
        },
      })

      // THEN: Returns 400 Bad Request or 401 Unauthorized
      expect([400, 401]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-003: should accept backup code when enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: User with 2FA and backup codes enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: {
              issuer: 'Test App',
              backupCodes: true,
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA and get backup codes
      const enableResponse = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const { backupCodes } = await enableResponse.json()
      const firstBackupCode = backupCodes[0]

      // WHEN: User submits backup code instead of TOTP
      const response = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          code: firstBackupCode,
        },
      })

      // THEN: Returns 200 OK accepting backup code
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('verified')
      expect(data.verified).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-004: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with 2FA enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to verify 2FA code
      const response = await page.request.post('/api/auth/two-factor/verify', {
        data: {
          code: '123456',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-005: should return 400 when code is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: true,
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User submits verification request without code
      const response = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-VERIFY-006: user can complete full 2FA verification workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with 2FA and backup codes enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            twoFactor: {
              issuer: 'Test App',
              backupCodes: true,
            },
          },
        },
      })

      const user = await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User enables 2FA
      const enableResponse = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      expect(enableResponse.status()).toBe(200)
      const { secret, backupCodes } = await enableResponse.json()

      // WHEN: User submits invalid code
      const invalidResponse = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          code: '000000',
        },
      })

      // THEN: Verification fails
      expect([400, 401]).toContain(invalidResponse.status())

      // WHEN: User submits backup code
      const backupResponse = await page.request.post('/api/auth/two-factor/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          code: backupCodes[0],
        },
      })

      // THEN: Verification succeeds with backup code
      expect(backupResponse.status()).toBe(200)
      const backupData = await backupResponse.json()
      expect(backupData.verified).toBe(true)

      // WHEN: Unauthenticated user attempts verification
      const unauthResponse = await page.request.post('/api/auth/two-factor/verify', {
        data: {
          code: '123456',
        },
      })

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

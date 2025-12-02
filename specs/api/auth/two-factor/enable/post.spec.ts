/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Enable Two-Factor Authentication
 *
 * Source: src/domain/models/app/auth/plugins/two-factor.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Enable Two-Factor Authentication', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-001: should return TOTP secret and QR code URL',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
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

      // WHEN: User initiates 2FA setup
      const response = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 200 OK with TOTP secret and QR code data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('secret') // TOTP secret for manual entry
      expect(data).toHaveProperty('qrCode') // QR code URL or data URI
      expect(data.secret).toMatch(/^[A-Z2-7]{32}$/) // Base32 encoded secret
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-002: should include backup codes when configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA and backup codes enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
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

      // WHEN: User initiates 2FA setup
      const response = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns backup codes along with TOTP secret
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('secret')
      expect(data).toHaveProperty('backupCodes')
      expect(Array.isArray(data.backupCodes)).toBe(true)
      expect(data.backupCodes.length).toBeGreaterThan(0)
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with 2FA enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            twoFactor: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to enable 2FA
      const response = await page.request.post('/api/auth/two-factor/enable')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-004: should return 400 when 2FA already enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA already enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
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

      // Enable 2FA first time
      const firstResponse = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const { secret } = await firstResponse.json()

      // Verify with TOTP code to complete setup
      // Note: This would require generating a valid TOTP code from the secret
      // For now, we'll assume 2FA is enabled after verification

      // WHEN: User attempts to enable 2FA again
      const response = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 400 Bad Request indicating 2FA already enabled
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
      expect(data.message).toContain('already enabled')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-005: should return 400 when 2FA plugin not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user but 2FA plugin disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          // No twoFactor plugin
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

      // WHEN: User attempts to enable 2FA
      const response = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-ENABLE-006: user can complete full 2FA enable workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with 2FA and backup codes enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          plugins: {
            twoFactor: {
              issuer: 'Test App',
              backupCodes: true,
              digits: 6,
              period: 30,
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

      // WHEN: User initiates 2FA setup
      const enableResponse = await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: 2FA setup data is returned
      expect(enableResponse.status()).toBe(200)
      const enableData = await enableResponse.json()
      expect(enableData).toHaveProperty('secret')
      expect(enableData).toHaveProperty('qrCode')
      expect(enableData).toHaveProperty('backupCodes')
      expect(enableData.backupCodes.length).toBeGreaterThan(0)

      // WHEN: Unauthenticated user attempts to enable 2FA
      const unauthResponse = await page.request.post('/api/auth/two-factor/enable')

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

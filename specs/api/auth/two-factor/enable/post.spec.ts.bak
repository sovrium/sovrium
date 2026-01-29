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
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Enable Two-Factor Authentication', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-001: should return TOTP secret and QR code URL',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Authenticated user with 2FA plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          twoFactor: {
            issuer: 'Test App',
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User initiates 2FA setup
      const response = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 200 OK with TOTP URI (contains secret)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('totpURI') // TOTP URI for authenticator apps
      expect(data.totpURI).toMatch(/^otpauth:\/\/totp\//) // Valid TOTP URI format

      // Extract secret from URI and validate it's Base32
      const secretMatch = data.totpURI.match(/secret=([A-Z2-7]+)/)
      expect(secretMatch).toBeTruthy()
      expect(secretMatch[1]).toMatch(/^[A-Z2-7]{32,}$/) // Base32 encoded secret
    }
  )

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-002: should include backup codes when configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Authenticated user with 2FA and backup codes enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          twoFactor: {
            issuer: 'Test App',
            backupCodes: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User initiates 2FA setup
      const response = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns backup codes along with TOTP URI
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('totpURI')
      expect(data).toHaveProperty('backupCodes')
      expect(Array.isArray(data.backupCodes)).toBe(true)
      expect(data.backupCodes.length).toBeGreaterThan(0)
    }
  )

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with 2FA enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          twoFactor: true,
        },
      })

      // WHEN: Unauthenticated user attempts to enable 2FA
      const response = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      // Better Auth may return empty body for 401, check if response has content
      const text = await response.text()
      if (text) {
        const data = JSON.parse(text)
        expect(data).toHaveProperty('message')
      }
    }
  )

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-004: should allow regenerating TOTP setup',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user who has already initiated 2FA setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          twoFactor: true,
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA first time
      const firstResponse = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      expect(firstResponse.status()).toBe(200)
      const firstData = await firstResponse.json()
      expect(firstData).toHaveProperty('totpURI')

      // WHEN: User calls enable endpoint again (regenerate setup)
      // Note: Better Auth allows this - users can regenerate TOTP if they lose access
      const response = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 200 OK with new TOTP URI (allows regeneration)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('totpURI')
      expect(data.totpURI).toMatch(/^otpauth:\/\/totp\//)
    }
  )

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-005: should return 400 when 2FA plugin not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Authenticated user but 2FA plugin disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          // No twoFactor plugin
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to enable 2FA
      const response = await page.request.post('/api/auth/two-factor/enable', {
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-TWO-FACTOR-ENABLE-REGRESSION: user can complete full 2FA enable workflow',
    { tag: '@regression' },
    async ({ page, request, startServerWithSchema, signUp, signIn }) => {
      // Step 1: Test unauthenticated access (API-AUTH-TWO-FACTOR-ENABLE-003)
      await test.step('API-AUTH-TWO-FACTOR-ENABLE-003: Returns 401 when not authenticated', async () => {
        // GIVEN: Application with 2FA enabled but no authentication
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            twoFactor: true,
          },
        })

        // WHEN: Unauthenticated user attempts to enable 2FA
        const response = await request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        // Better Auth may return empty body for 401, check if response has content
        const text = await response.text()
        if (text) {
          const data = JSON.parse(text)
          expect(data).toHaveProperty('message')
        }
      })

      // Step 2: Test 2FA plugin not enabled (API-AUTH-TWO-FACTOR-ENABLE-005)
      await test.step('API-AUTH-TWO-FACTOR-ENABLE-005: Returns 400/404 when 2FA plugin not enabled', async () => {
        // GIVEN: Authenticated user but 2FA plugin disabled
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            // No twoFactor plugin
          },
        })

        await signUp({
          name: 'Test User',
          email: 'test@example.com',
          password: 'ValidPassword123!',
        })

        // WHEN: User attempts to enable 2FA
        const response = await page.request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        // THEN: Returns 400 Bad Request or 404 Not Found
        expect([400, 404]).toContain(response.status())
      })

      // Step 3: Test successful 2FA enable with TOTP URI (API-AUTH-TWO-FACTOR-ENABLE-001)
      await test.step('API-AUTH-TWO-FACTOR-ENABLE-001: Returns TOTP URI', async () => {
        // GIVEN: Authenticated user with 2FA plugin enabled
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            twoFactor: {
              issuer: 'Test App',
            },
          },
        })

        await signUp({
          name: 'Test User 2FA',
          email: 'test-with-2fa@example.com',
          password: 'ValidPassword123!',
        })

        // WHEN: User initiates 2FA setup
        const response = await page.request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        // THEN: Returns 200 OK with TOTP URI (contains secret)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('totpURI') // TOTP URI for authenticator apps
        expect(data.totpURI).toMatch(/^otpauth:\/\/totp\//) // Valid TOTP URI format

        // Extract secret from URI and validate it's Base32
        const secretMatch = data.totpURI.match(/secret=([A-Z2-7]+)/)
        expect(secretMatch).toBeTruthy()
        expect(secretMatch[1]).toMatch(/^[A-Z2-7]{32,}$/) // Base32 encoded secret
      })

      // Step 4: Test 2FA enable with backup codes (API-AUTH-TWO-FACTOR-ENABLE-002)
      await test.step('API-AUTH-TWO-FACTOR-ENABLE-002: Includes backup codes when configured', async () => {
        // GIVEN: Authenticated user with 2FA and backup codes enabled
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            twoFactor: {
              issuer: 'Test App',
              backupCodes: true,
            },
          },
        })

        await signUp({
          name: 'Test User Backup',
          email: 'test-with-backup@example.com',
          password: 'ValidPassword123!',
        })

        // WHEN: User initiates 2FA setup
        const response = await page.request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        // THEN: Returns backup codes along with TOTP URI
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('totpURI')
        expect(data).toHaveProperty('backupCodes')
        expect(Array.isArray(data.backupCodes)).toBe(true)
        expect(data.backupCodes.length).toBeGreaterThan(0)
      })

      // Step 5: Test TOTP setup regeneration (API-AUTH-TWO-FACTOR-ENABLE-004)
      await test.step('API-AUTH-TWO-FACTOR-ENABLE-004: Allows regenerating TOTP setup', async () => {
        // GIVEN: Authenticated user who has already initiated 2FA setup
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            twoFactor: true,
          },
        })

        await signUp({
          name: 'Test User Regenerate',
          email: 'test-regenerate@example.com',
          password: 'ValidPassword123!',
        })

        await signIn({
          email: 'test-regenerate@example.com',
          password: 'ValidPassword123!',
        })

        // Enable 2FA first time
        const firstResponse = await page.request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        expect(firstResponse.status()).toBe(200)
        const firstData = await firstResponse.json()
        expect(firstData).toHaveProperty('totpURI')

        // WHEN: User calls enable endpoint again (regenerate setup)
        // Note: Better Auth allows this - users can regenerate TOTP if they lose access
        const response = await page.request.post('/api/auth/two-factor/enable', {
          data: {
            password: 'ValidPassword123!',
          },
        })

        // THEN: Returns 200 OK with new TOTP URI (allows regeneration)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('totpURI')
        expect(data.totpURI).toMatch(/^otpauth:\/\/totp\//)
      })
    }
  )
})

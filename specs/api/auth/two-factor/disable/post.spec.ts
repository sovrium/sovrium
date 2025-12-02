/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Disable Two-Factor Authentication
 *
 * Source: src/domain/models/app/auth/plugins/two-factor.ts
 * Domain: api
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Disable Two-Factor Authentication', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-DISABLE-001: should disable 2FA with valid password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            twoFactor: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA first
      await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // WHEN: User disables 2FA with correct password
      const response = await page.request.post('/api/auth/two-factor/disable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 200 OK confirming 2FA is disabled
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('disabled')
      expect(data.disabled).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-DISABLE-002: should return 401 with incorrect password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with 2FA enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            twoFactor: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Enable 2FA first
      await page.request.post('/api/auth/two-factor/enable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // WHEN: User attempts to disable 2FA with wrong password
      const response = await page.request.post('/api/auth/two-factor/disable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          password: 'WrongPassword!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-DISABLE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with 2FA enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            twoFactor: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to disable 2FA
      const response = await page.request.post('/api/auth/two-factor/disable', {
        data: {
          password: 'AnyPassword123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-TWO-FACTOR-DISABLE-004: should return 400 when 2FA not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user without 2FA enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            twoFactor: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const session = await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to disable 2FA (without enabling it first)
      const response = await page.request.post('/api/auth/two-factor/disable', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          password: 'ValidPassword123!',
        },
      })

      // THEN: Returns 400 Bad Request indicating 2FA not enabled
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
      expect(data.message).toContain('not enabled')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-TWO-FACTOR-DISABLE-005: user can complete full 2FA disable workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      await test.step('Setup: Start server with two-factor plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: {
              twoFactor: {
                issuer: 'Test App',
              },
            },
          },
        })
      })

      await test.step('Setup: Sign up user', async () => {
        await signUp({
          name: 'Test User',
          email: 'test@example.com',
          password: 'ValidPassword123!',
        })
      })

      let session: { token?: string }

      await test.step('Sign in user', async () => {
        session = await signIn({
          email: 'test@example.com',
          password: 'ValidPassword123!',
        })
      })

      await test.step('Enable 2FA', async () => {
        const enableResponse = await page.request.post('/api/auth/two-factor/enable', {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        })

        expect(enableResponse.status()).toBe(200)
      })

      await test.step('Verify disable with wrong password fails', async () => {
        const wrongPasswordResponse = await page.request.post('/api/auth/two-factor/disable', {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
          data: {
            password: 'WrongPassword!',
          },
        })

        expect(wrongPasswordResponse.status()).toBe(401)
      })

      await test.step('Disable 2FA with correct password', async () => {
        const disableResponse = await page.request.post('/api/auth/two-factor/disable', {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
          data: {
            password: 'ValidPassword123!',
          },
        })

        expect(disableResponse.status()).toBe(200)
        const disableData = await disableResponse.json()
        expect(disableData.disabled).toBe(true)
      })

      await test.step('Verify disable 2FA fails without auth', async () => {
        const unauthResponse = await page.request.post('/api/auth/two-factor/disable', {
          data: {
            password: 'AnyPassword123!',
          },
        })

        expect(unauthResponse.status()).toBe(401)
      })
    }
  )
})

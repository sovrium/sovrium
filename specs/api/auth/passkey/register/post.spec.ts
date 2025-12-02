/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Register Passkey (WebAuthn)
 *
 * Source: src/domain/models/app/auth/methods/passkey.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Register Passkey (WebAuthn)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-001: should return WebAuthn registration options',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with passkey authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password', 'passkey'],
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

      // WHEN: User initiates passkey registration
      const response = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 200 OK with WebAuthn registration options
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('challenge') // WebAuthn challenge
      expect(data).toHaveProperty('rp') // Relying Party info
      expect(data.rp).toHaveProperty('name')
      expect(data.rp).toHaveProperty('id')
      expect(data).toHaveProperty('user') // User info for credential
      expect(data.user).toHaveProperty('id')
      expect(data.user).toHaveProperty('name')
      expect(data.user).toHaveProperty('displayName')
      expect(data).toHaveProperty('pubKeyCredParams') // Supported algorithms
      expect(data).toHaveProperty('authenticatorSelection') // Authenticator requirements
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-002: should complete passkey registration with valid credential',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: User with registration options
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password', 'passkey'],
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

      // Get registration options
      const optionsResponse = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const options = await optionsResponse.json()

      // WHEN: User completes WebAuthn registration with credential
      // Note: In real implementation, this would use WebAuthn API to create credential
      // For spec, we document expected credential structure
      const mockCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          attestationObject: 'attestation-object-base64',
        },
        type: 'public-key',
      }

      const verifyResponse = await page.request.post('/api/auth/passkey/register/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          credential: mockCredential,
        },
      })

      // THEN: Returns 200 OK confirming passkey registration
      expect(verifyResponse.status()).toBe(200)

      const verifyData = await verifyResponse.json()
      expect(verifyData).toHaveProperty('registered')
      expect(verifyData.registered).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with passkey enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['passkey'],
        },
      })

      // WHEN: Unauthenticated user attempts to register passkey
      const response = await page.request.post('/api/auth/passkey/register')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-004: should return 400 when passkey not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user but passkey authentication disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          // No passkey method
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

      // WHEN: User attempts to register passkey
      const response = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-005: should use custom RP name and ID when configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Passkey with custom Relying Party configuration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: [
            {
              method: 'passkey',
              rpName: 'My Custom App',
              rpId: 'example.com',
            },
          ],
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

      // WHEN: User initiates passkey registration
      const response = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns registration options with custom RP info
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.rp.name).toBe('My Custom App')
      expect(data.rp.id).toBe('example.com')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-PASSKEY-REGISTER-006: user can complete full passkey registration workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with passkey authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password', 'passkey'],
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

      // WHEN: User requests registration options
      const optionsResponse = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Registration options are returned
      expect(optionsResponse.status()).toBe(200)
      const options = await optionsResponse.json()
      expect(options).toHaveProperty('challenge')
      expect(options).toHaveProperty('rp')
      expect(options).toHaveProperty('user')
      expect(options).toHaveProperty('pubKeyCredParams')

      // WHEN: User completes registration with mock credential
      const mockCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          attestationObject: 'attestation-object-base64',
        },
        type: 'public-key',
      }

      const verifyResponse = await page.request.post('/api/auth/passkey/register/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          credential: mockCredential,
        },
      })

      // THEN: Passkey is registered
      expect(verifyResponse.status()).toBe(200)
      const verifyData = await verifyResponse.json()
      expect(verifyData.registered).toBe(true)

      // WHEN: Unauthenticated user attempts registration
      const unauthResponse = await page.request.post('/api/auth/passkey/register')

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

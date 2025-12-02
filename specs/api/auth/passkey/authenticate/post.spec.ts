/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Authenticate with Passkey (WebAuthn)
 *
 * Source: src/domain/models/app/auth/methods/passkey.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Authenticate with Passkey (WebAuthn)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-001: should return WebAuthn authentication options',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with passkey authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['passkey'],
        },
      })

      // WHEN: User initiates passkey authentication
      const response = await page.request.post('/api/auth/passkey/authenticate')

      // THEN: Returns 200 OK with WebAuthn authentication options
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('challenge') // WebAuthn challenge
      expect(data).toHaveProperty('rpId') // Relying Party ID
      expect(data).toHaveProperty('timeout') // Authentication timeout
      expect(data).toHaveProperty('userVerification') // User verification requirement
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-002: should authenticate user with valid passkey credential',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: User with registered passkey
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password', 'passkey'],
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

      // Register passkey first
      const registerResponse = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const registerOptions = await registerResponse.json()

      // Complete passkey registration with mock credential
      const mockRegisterCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          attestationObject: 'attestation-object-base64',
        },
        type: 'public-key',
      }

      await page.request.post('/api/auth/passkey/register/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          credential: mockRegisterCredential,
        },
      })

      // Get authentication options
      const authOptionsResponse = await page.request.post('/api/auth/passkey/authenticate')
      const authOptions = await authOptionsResponse.json()

      // WHEN: User authenticates with passkey credential
      const mockAuthCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          authenticatorData: 'authenticator-data-base64',
          signature: 'signature-base64',
          userHandle: 'user-handle-base64',
        },
        type: 'public-key',
      }

      const response = await page.request.post('/api/auth/passkey/authenticate/verify', {
        data: {
          credential: mockAuthCredential,
        },
      })

      // THEN: Returns 200 OK with session token and user data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.email).toBe('test@example.com')
      expect(data).toHaveProperty('token')
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-003: should return 401 with invalid credential',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with passkey enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['passkey'],
        },
      })

      // Get authentication options
      await page.request.post('/api/auth/passkey/authenticate')

      // WHEN: User attempts authentication with invalid credential
      const invalidCredential = {
        id: 'invalid-credential-id',
        rawId: 'invalid-credential-id',
        response: {
          clientDataJSON: 'invalid-client-data',
          authenticatorData: 'invalid-authenticator-data',
          signature: 'invalid-signature',
        },
        type: 'public-key',
      }

      const response = await page.request.post('/api/auth/passkey/authenticate/verify', {
        data: {
          credential: invalidCredential,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-004: should return 400 when passkey not enabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application without passkey authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password'],
          // No passkey method
        },
      })

      // WHEN: User attempts passkey authentication
      const response = await page.request.post('/api/auth/passkey/authenticate')

      // THEN: Returns 400 Bad Request or 404 Not Found
      expect([400, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-005: should enforce user verification when required',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Passkey with required user verification
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: [
            {
              method: 'passkey',
              userVerification: 'required',
            },
          ],
        },
      })

      // WHEN: User initiates passkey authentication
      const response = await page.request.post('/api/auth/passkey/authenticate')

      // THEN: Returns authentication options with required user verification
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.userVerification).toBe('required')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-PASSKEY-AUTHENTICATE-006: user can complete full passkey authentication workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with passkey authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          methods: ['email-and-password', 'passkey'],
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

      // WHEN: User registers passkey
      const registerResponse = await page.request.post('/api/auth/passkey/register', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      expect(registerResponse.status()).toBe(200)

      const mockRegisterCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          attestationObject: 'attestation-object-base64',
        },
        type: 'public-key',
      }

      const verifyRegisterResponse = await page.request.post('/api/auth/passkey/register/verify', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          credential: mockRegisterCredential,
        },
      })

      expect(verifyRegisterResponse.status()).toBe(200)

      // WHEN: User requests authentication options
      const authOptionsResponse = await page.request.post('/api/auth/passkey/authenticate')

      // THEN: Authentication options are returned
      expect(authOptionsResponse.status()).toBe(200)
      const authOptions = await authOptionsResponse.json()
      expect(authOptions).toHaveProperty('challenge')
      expect(authOptions).toHaveProperty('rpId')

      // WHEN: User authenticates with valid passkey
      const mockAuthCredential = {
        id: 'credential-id-base64',
        rawId: 'credential-id-base64',
        response: {
          clientDataJSON: 'client-data-json-base64',
          authenticatorData: 'authenticator-data-base64',
          signature: 'signature-base64',
          userHandle: 'user-handle-base64',
        },
        type: 'public-key',
      }

      const authResponse = await page.request.post('/api/auth/passkey/authenticate/verify', {
        data: {
          credential: mockAuthCredential,
        },
      })

      // THEN: Authentication succeeds
      expect(authResponse.status()).toBe(200)
      const authData = await authResponse.json()
      expect(authData).toHaveProperty('user')
      expect(authData).toHaveProperty('token')

      // WHEN: Invalid credential is used
      const invalidResponse = await page.request.post('/api/auth/passkey/authenticate/verify', {
        data: {
          credential: {
            id: 'invalid',
            rawId: 'invalid',
            response: {},
            type: 'public-key',
          },
        },
      })

      // THEN: Authentication fails
      expect(invalidResponse.status()).toBe(401)
    }
  )
})

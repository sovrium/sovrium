/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Get API Key
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Get API Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-GET-001: should retrieve API key details by ID',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with existing API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Create API key
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Test Key',
          metadata: {
            environment: 'production',
          },
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User retrieves API key details via Better Auth endpoint
      const response = await page.request.get(`/api/auth/api-key?id=${keyId}`)

      // THEN: Returns 200 OK with complete key metadata (excluding key value)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.id).toBe(keyId)
      expect(data.name).toBe('Test Key')
      expect(data.metadata).toEqual({ environment: 'production' })
      expect(data).toHaveProperty('createdAt')
      expect(data).not.toHaveProperty('key') // Security: key value excluded
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-GET-002: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with API keys enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to retrieve API key
      const response = await page.request.get('/api/auth/api-key?id=test-key-id')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-GET-003: should return 404 for non-existent API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to retrieve non-existent API key
      const response = await page.request.get('/api/auth/api-key?id=non-existent-id')

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-GET-004: should return 400 when ID parameter is missing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User attempts to retrieve API key without ID parameter
      const response = await page.request.get('/api/auth/api-key')

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-GET-005: should prevent retrieving another user API key (user isolation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own API keys
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      // User 1 creates API key
      await signUp({
        name: 'User One',
        email: 'user1@example.com',
        password: 'ValidPassword123!',
      })

      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'User 1 Key',
        },
      })

      const { id: user1KeyId } = await createResponse.json()

      // User 2 signs in
      await signUp({
        name: 'User Two',
        email: 'user2@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User 2 attempts to retrieve User 1's API key
      const response = await page.request.get(`/api/auth/api-key?id=${user1KeyId}`)

      // THEN: Returns 404 Not Found (prevents enumeration)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-GET-006: user can complete full API key retrieval workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API keys enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: true,
          },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates API key
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Production Key',
          expiresIn: 2_592_000, // 30 days
          metadata: {
            environment: 'production',
            service: 'api',
          },
        },
      })

      const { id: keyId } = await createResponse.json()

      // THEN: User can retrieve key details
      const getResponse = await page.request.get(`/api/auth/api-key?id=${keyId}`)

      expect(getResponse.status()).toBe(200)
      const getData = await getResponse.json()
      expect(getData.id).toBe(keyId)
      expect(getData.name).toBe('Production Key')
      expect(getData).toHaveProperty('expiresAt')
      expect(getData.metadata).toEqual({
        environment: 'production',
        service: 'api',
      })

      // THEN: Retrieving non-existent key fails
      const notFoundResponse = await page.request.get('/api/auth/api-key?id=invalid-id')

      expect(notFoundResponse.status()).toBe(404)

      // WHEN: Unauthenticated user attempts to retrieve key
      const unauthResponse = await page.request.get(`/api/auth/api-key?id=${keyId}`)

      // THEN: Request fails with 401
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

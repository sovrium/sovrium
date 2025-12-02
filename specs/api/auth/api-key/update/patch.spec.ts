/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update API Key
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (9 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Update API Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-001: should update API key name',
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
          name: 'Old Name',
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User updates API key name via Better Auth endpoint
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          name: 'New Name',
        },
      })

      // THEN: Returns 200 OK with updated key details (excluding key value)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.name).toBe('New Name')
      expect(data).not.toHaveProperty('key') // Security: key value excluded
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-002: should enable/disable API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with enabled API key
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
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User disables the API key
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          enabled: false,
        },
      })

      // THEN: Returns 200 OK with enabled status updated
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.enabled).toBe(false)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-003: should update API key metadata',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API key
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

      // Create API key with initial metadata
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Test Key',
          metadata: {
            environment: 'development',
          },
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User updates metadata
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          metadata: {
            environment: 'production',
            version: '2.0',
          },
        },
      })

      // THEN: Returns 200 OK with updated metadata
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.metadata).toEqual({
        environment: 'production',
        version: '2.0',
      })
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-004: should update remaining request quota',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API key
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
          name: 'Rate Limited Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User sets request quota
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          remaining: 1000,
        },
      })

      // THEN: Returns 200 OK with updated remaining count
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.remaining).toBe(1000)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-005: should update refill settings',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API key
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
          name: 'Auto-Refill Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User configures automatic refill (e.g., 1000 requests per day)
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          refillAmount: 1000,
          refillInterval: 86_400, // 24 hours in seconds
        },
      })

      // THEN: Returns 200 OK with updated refill settings
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.refillAmount).toBe(1000)
      expect(data.refillInterval).toBe(86_400)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-006: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated user attempts to update API key
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId: 'test-key-id',
          name: 'New Name',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-007: should return error for non-existent API key',
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

      // WHEN: User attempts to update non-existent API key
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId: 'non-existent-id',
          name: 'New Name',
        },
      })

      // THEN: Returns error (400 or 404)
      expect([400, 404]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-008: should prevent updating another user API key (user isolation)',
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

      // WHEN: User 2 attempts to update User 1's API key
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId: user1KeyId,
          name: 'Hijacked Name',
        },
      })

      // THEN: Returns error (400 or 404) due to user isolation - prevents enumeration
      expect([400, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-009: should require keyId parameter',
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

      // WHEN: User attempts to update without keyId
      const response = await page.request.patch('/api/auth/api-key', {
        data: {
          name: 'New Name',
        },
      })

      // THEN: Returns 400 Bad Request
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-UPDATE-010: user can complete full API key update workflow',
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
          name: 'Initial Name',
          metadata: {
            version: '1.0',
          },
        },
      })

      const { id: keyId } = await createResponse.json()

      // THEN: User can update multiple fields
      const updateResponse = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          name: 'Updated Name',
          enabled: false,
          remaining: 500,
          refillAmount: 1000,
          refillInterval: 3600, // 1 hour
          metadata: {
            version: '2.0',
            environment: 'production',
          },
        },
      })

      expect(updateResponse.status()).toBe(200)
      const updateData = await updateResponse.json()
      expect(updateData.name).toBe('Updated Name')
      expect(updateData.enabled).toBe(false)
      expect(updateData.remaining).toBe(500)
      expect(updateData.refillAmount).toBe(1000)
      expect(updateData.refillInterval).toBe(3600)
      expect(updateData.metadata).toEqual({
        version: '2.0',
        environment: 'production',
      })

      // THEN: Updating non-existent key fails
      const notFoundResponse = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId: 'invalid-id',
          name: 'Test',
        },
      })

      expect([400, 404]).toContain(notFoundResponse.status())

      // WHEN: Unauthenticated user attempts to update key
      const unauthResponse = await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          name: 'Hacked',
        },
      })

      // THEN: Request fails with 401
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

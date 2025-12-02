/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Verify API Key
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Verify API Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-001: should verify valid API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with API keys enabled and user with valid API key
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

      const { key } = await createResponse.json()

      // WHEN: System verifies the API key via Better Auth endpoint
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key,
        },
      })

      // THEN: Returns 200 OK with valid status and key details (without key value)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(true)
      expect(data.error).toBeNull()
      expect(data.key).toBeDefined()
      expect(data.key).toHaveProperty('id')
      expect(data.key).toHaveProperty('name')
      expect(data.key).not.toHaveProperty('key') // Security: key value excluded
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-002: should reject invalid API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
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

      // WHEN: System verifies invalid API key
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key: 'invalid-key-12345',
        },
      })

      // THEN: Returns 200 OK but with valid=false and error details
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.key).toBeNull()
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-003: should reject expired API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with expired API key
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

      // Create API key with 1 second expiration
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expiring Key',
          expiresIn: 1, // 1 second
        },
      })

      const { key } = await createResponse.json()

      // Wait for key to expire
      await page.waitForTimeout(2000)

      // WHEN: System verifies expired API key
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key,
        },
      })

      // THEN: Returns 200 OK but with valid=false and expiration error
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.key).toBeNull()
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-004: should verify API key with permissions check (when permissions match)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: API key with specific permissions
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

      // Create API key with permissions
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Key with Permissions',
          metadata: {
            permissions: ['read', 'write'],
          },
        },
      })

      const { key } = await createResponse.json()

      // WHEN: System verifies key with matching permissions
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key,
          permissions: ['read'],
        },
      })

      // THEN: Returns valid with key details
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(true)
      expect(data.key).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-005: should reject API key with insufficient permissions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: API key with limited permissions
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

      // Create API key with read-only permission
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read Only Key',
          metadata: {
            permissions: ['read'],
          },
        },
      })

      const { key } = await createResponse.json()

      // WHEN: System verifies key with required permission that doesn't exist
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key,
          permissions: ['admin'],
        },
      })

      // THEN: Returns invalid due to insufficient permissions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(false)
      expect(data.error).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-006: should reject disabled API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: API key that has been disabled
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

      const { key, id: keyId } = await createResponse.json()

      // Disable the key
      await page.request.patch('/api/auth/api-key', {
        data: {
          keyId,
          enabled: false,
        },
      })

      // WHEN: System verifies disabled API key
      const response = await page.request.post('/api/auth/api-key/verify', {
        data: {
          key,
        },
      })

      // THEN: Returns invalid with error about disabled key
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.valid).toBe(false)
      expect(data.error).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-VERIFY-007: system can complete full API key verification workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      let key: string
      let keyId: string

      await test.step('Setup: Start server with API keys plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: {
              apiKeys: true,
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

      await test.step('Create API key with metadata', async () => {
        const createResponse = await page.request.post('/api/auth/api-key/create', {
          data: {
            name: 'Test Key',
            metadata: {
              permissions: ['read', 'write'],
            },
          },
        })

        const result = await createResponse.json()
        key = result.key
        keyId = result.id
      })

      await test.step('Verify valid API key passes verification', async () => {
        const validResponse = await page.request.post('/api/auth/api-key/verify', {
          data: { key },
        })

        expect(validResponse.status()).toBe(200)
        const validData = await validResponse.json()
        expect(validData.valid).toBe(true)
      })

      await test.step('Verify invalid API key fails verification', async () => {
        const invalidResponse = await page.request.post('/api/auth/api-key/verify', {
          data: { key: 'invalid-key' },
        })

        expect(invalidResponse.status()).toBe(200)
        const invalidData = await invalidResponse.json()
        expect(invalidData.valid).toBe(false)
      })

      await test.step('Disable API key', async () => {
        await page.request.patch('/api/auth/api-key', {
          data: {
            keyId,
            enabled: false,
          },
        })
      })

      await test.step('Verify disabled API key fails verification', async () => {
        const disabledResponse = await page.request.post('/api/auth/api-key/verify', {
          data: { key },
        })

        expect(disabledResponse.status()).toBe(200)
        const disabledData = await disabledResponse.json()
        expect(disabledData.valid).toBe(false)
      })
    }
  )
})

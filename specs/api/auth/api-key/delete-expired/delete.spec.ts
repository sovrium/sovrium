/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Delete Expired API Keys
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Delete Expired API Keys', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-EXPIRED-001: should delete expired API keys',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with expired API keys
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

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Create expired API key (1 second expiration)
      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresIn: 1,
        },
      })

      // Create valid long-lived API key
      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Valid Key',
          expiresIn: 86_400, // 1 day
        },
      })

      // Wait for first key to expire
      await page.waitForTimeout(2000)

      // Verify we have 2 keys before cleanup
      const beforeResponse = await page.request.get('/api/auth/api-key/list')
      const beforeData = await beforeResponse.json()
      expect(beforeData).toHaveLength(2)

      // WHEN: System deletes expired API keys via Better Auth endpoint
      const response = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Returns 200 OK with success status
      expect(response.status()).toBe(200)

      // THEN: Only valid key remains
      const afterResponse = await page.request.get('/api/auth/api-key/list')
      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(1)
      expect(afterData[0].name).toBe('Valid Key')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-EXPIRED-002: should not delete non-expired keys',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with only valid API keys
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

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Create two valid API keys with future expiration
      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Valid Key 1',
          expiresIn: 86_400, // 1 day
        },
      })

      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Valid Key 2',
          expiresIn: 172_800, // 2 days
        },
      })

      // WHEN: System attempts to delete expired keys
      const response = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Returns 200 OK but no keys are deleted
      expect(response.status()).toBe(200)

      // THEN: Both valid keys remain
      const afterResponse = await page.request.get('/api/auth/api-key/list')
      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(2)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-EXPIRED-003: should delete keys with no expiration set',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with keys without expiration
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

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // Create API key without expiration
      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Permanent Key',
          // No expiresIn - key never expires
        },
      })

      // Create expired key
      await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresIn: 1,
        },
      })

      // Wait for second key to expire
      await page.waitForTimeout(2000)

      // WHEN: System deletes expired keys
      const response = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Only expired key is deleted, permanent key remains
      expect(response.status()).toBe(200)

      const afterResponse = await page.request.get('/api/auth/api-key/list')
      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(1)
      expect(afterData[0].name).toBe('Permanent Key')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-EXPIRED-004: should return 401 when not authenticated',
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

      // WHEN: Unauthenticated user attempts to delete expired keys
      const response = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-EXPIRED-005: system can complete full expired keys cleanup workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with mix of expired and valid API keys
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

      await signIn({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User creates multiple keys with different expiration settings
      await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Expired 1', expiresIn: 1 },
      })

      await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Expired 2', expiresIn: 1 },
      })

      await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Valid Key', expiresIn: 86_400 },
      })

      await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Permanent Key' }, // No expiration
      })

      // Wait for expired keys to expire
      await page.waitForTimeout(2000)

      // Verify all 4 keys exist
      const beforeResponse = await page.request.get('/api/auth/api-key/list')
      const beforeData = await beforeResponse.json()
      expect(beforeData).toHaveLength(4)

      // WHEN: System cleans up expired keys
      const deleteResponse = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Cleanup succeeds
      expect(deleteResponse.status()).toBe(200)

      // THEN: Only 2 valid keys remain
      const afterResponse = await page.request.get('/api/auth/api-key/list')
      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(2)

      const remainingNames = afterData.map((key: { name: string }) => key.name).sort()
      expect(remainingNames).toEqual(['Permanent Key', 'Valid Key'])

      // WHEN: Unauthenticated user attempts cleanup
      const unauthResponse = await page.request.delete('/api/auth/api-key/delete-expired')

      // THEN: Request fails with 401
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List API Keys
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (4 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('List API Keys', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-LIST-001: should return list of user API keys',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with existing API keys
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            apiKeys: true,
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

      // Create two API keys
      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Production Key',
          description: 'For production use',
        },
      })

      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Development Key',
          description: 'For development use',
        },
      })

      // WHEN: User requests list of their API keys
      const response = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 200 OK with list of API keys (without key values)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)

      // API keys should not include the actual key value (security)
      expect(data[0]).not.toHaveProperty('key')
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('description')
      expect(data[0]).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-LIST-002: should return empty array when user has no API keys',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with no API keys
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            apiKeys: true,
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

      // WHEN: User requests list of their API keys
      const response = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 200 OK with empty array
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-LIST-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with API keys enabled but no authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            apiKeys: true,
          },
        },
      })

      // WHEN: Unauthenticated user attempts to list API keys
      const response = await page.request.get('/api/auth/api-keys')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-LIST-004: should only return API keys belonging to authenticated user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Two users with their own API keys
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            apiKeys: true,
          },
        },
      })

      // Create first user with API key
      await signUp({
        name: 'User One',
        email: 'user1@example.com',
        password: 'ValidPassword123!',
      })

      const session1 = await signIn({
        email: 'user1@example.com',
        password: 'ValidPassword123!',
      })

      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session1.token}`,
        },
        data: {
          name: 'User 1 Key',
        },
      })

      // Create second user with API key
      await signUp({
        name: 'User Two',
        email: 'user2@example.com',
        password: 'ValidPassword123!',
      })

      const session2 = await signIn({
        email: 'user2@example.com',
        password: 'ValidPassword123!',
      })

      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session2.token}`,
        },
        data: {
          name: 'User 2 Key',
        },
      })

      // WHEN: User 2 requests their API keys
      const response = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session2.token}`,
        },
      })

      // THEN: Returns only User 2's API key (isolation)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('User 2 Key')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-LIST-005: user can complete full API key list workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API keys enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          plugins: {
            apiKeys: true,
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

      // WHEN: User lists keys before creating any
      const emptyResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns empty array
      expect(emptyResponse.status()).toBe(200)
      const emptyData = await emptyResponse.json()
      expect(emptyData).toHaveLength(0)

      // WHEN: User creates multiple API keys
      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: { name: 'Key 1' },
      })

      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: { name: 'Key 2' },
      })

      // THEN: User can see all their keys
      const listResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      expect(listResponse.status()).toBe(200)
      const listData = await listResponse.json()
      expect(listData).toHaveLength(2)

      // WHEN: Unauthenticated request is made
      const unauthResponse = await page.request.get('/api/auth/api-keys')

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

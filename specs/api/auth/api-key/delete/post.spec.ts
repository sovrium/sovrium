/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Revoke/Delete API Key
 *
 * Source: src/domain/models/app/auth/plugins/api-keys.ts
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (5 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Revoke/Delete API Key', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-001: should revoke API key successfully',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User revokes the API key via Better Auth delete endpoint (POST method)
      const response = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId,
        },
      })

      // THEN: Returns 200 OK with success status
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data.success).toBe(true)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-002: should remove revoked key from list',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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
          name: 'Test Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // Verify key exists in list
      const beforeResponse = await page.request.get('/api/auth/api-key/list')

      const beforeData = await beforeResponse.json()
      expect(beforeData).toHaveLength(1)

      // WHEN: User revokes the API key
      await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId,
        },
      })

      // THEN: Key is removed from list
      const afterResponse = await page.request.get('/api/auth/api-key/list')

      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(0)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Application with API keys enabled and existing key
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

      // WHEN: Unauthenticated user attempts to revoke API key
      const response = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-004: should return error for non-existent API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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

      // WHEN: User attempts to revoke non-existent API key
      const response = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId: 'non-existent-id',
        },
      })

      // THEN: Returns error (400 or 404)
      expect([400, 404]).toContain(response.status())

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-005: should prevent revoking another user API key (user isolation)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
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

      // WHEN: User 2 attempts to revoke User 1's API key
      const response = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId: user1KeyId,
        },
      })

      // THEN: Returns error (400 or 404) due to user isolation - prevents enumeration
      expect([400, 404]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-006: user can complete full API key revocation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
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

      // WHEN: User creates multiple API keys
      const create1Response = await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Key 1' },
      })

      const { id: key1Id } = await create1Response.json()

      await page.request.post('/api/auth/api-key/create', {
        data: { name: 'Key 2' },
      })

      // Verify two keys exist
      const listResponse = await page.request.get('/api/auth/api-key/list')

      const listData = await listResponse.json()
      expect(listData).toHaveLength(2)

      // WHEN: User revokes one key
      const deleteResponse = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId: key1Id,
        },
      })

      // THEN: Key is revoked successfully
      expect(deleteResponse.status()).toBe(200)
      const deleteData = await deleteResponse.json()
      expect(deleteData.success).toBe(true)

      // THEN: Only one key remains
      const afterResponse = await page.request.get('/api/auth/api-key/list')

      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(1)
      expect(afterData[0].name).toBe('Key 2')

      // WHEN: Unauthenticated user attempts to revoke key
      const unauthResponse = await page.request.post('/api/auth/api-key/delete', {
        data: {
          keyId: key1Id,
        },
      })

      // THEN: Request fails with 401
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

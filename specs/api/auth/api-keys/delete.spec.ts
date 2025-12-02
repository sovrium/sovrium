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
 * Spec Count: 6
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
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with existing API key
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

      // Create API key
      const createResponse = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Test Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: User revokes the API key
      const response = await page.request.delete(`/api/auth/api-keys/${keyId}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 200 OK or 204 No Content
      expect([200, 204]).toContain(response.status())
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-002: should remove revoked key from list',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user with API key
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

      // Create API key
      const createResponse = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Test Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // Verify key exists in list
      const beforeResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const beforeData = await beforeResponse.json()
      expect(beforeData).toHaveLength(1)

      // WHEN: User revokes the API key
      await page.request.delete(`/api/auth/api-keys/${keyId}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Key is removed from list
      const afterResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(0)
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-003: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API keys enabled and existing key
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

      // Create API key
      const createResponse = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          name: 'Test Key',
        },
      })

      const { id: keyId } = await createResponse.json()

      // WHEN: Unauthenticated user attempts to revoke API key
      const response = await page.request.delete(`/api/auth/api-keys/${keyId}`)

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-004: should return 404 for non-existent API key',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Authenticated user
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

      // WHEN: User attempts to revoke non-existent API key
      const response = await page.request.delete('/api/auth/api-keys/non-existent-id', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-005: should return 404 when attempting to revoke another user API key',
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

      // User 1 creates API key
      await signUp({
        name: 'User One',
        email: 'user1@example.com',
        password: 'ValidPassword123!',
      })

      const session1 = await signIn({
        email: 'user1@example.com',
        password: 'ValidPassword123!',
      })

      const createResponse = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session1.token}`,
        },
        data: {
          name: 'User 1 Key',
        },
      })

      const { id: user1KeyId } = await createResponse.json()

      // User 2
      await signUp({
        name: 'User Two',
        email: 'user2@example.com',
        password: 'ValidPassword123!',
      })

      const session2 = await signIn({
        email: 'user2@example.com',
        password: 'ValidPassword123!',
      })

      // WHEN: User 2 attempts to revoke User 1's API key
      const response = await page.request.delete(`/api/auth/api-keys/${user1KeyId}`, {
        headers: {
          Authorization: `Bearer ${session2.token}`,
        },
      })

      // THEN: Returns 404 Not Found (user isolation - prevent enumeration)
      expect(response.status()).toBe(404)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-API-KEYS-DELETE-006: user can complete full API key revocation workflow',
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

      // WHEN: User creates multiple API keys
      const create1Response = await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: { name: 'Key 1' },
      })

      const { id: key1Id } = await create1Response.json()

      await page.request.post('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: { name: 'Key 2' },
      })

      // Verify two keys exist
      const listResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const listData = await listResponse.json()
      expect(listData).toHaveLength(2)

      // WHEN: User revokes one key
      const deleteResponse = await page.request.delete(`/api/auth/api-keys/${key1Id}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      // THEN: Key is revoked successfully
      expect([200, 204]).toContain(deleteResponse.status())

      // THEN: Only one key remains
      const afterResponse = await page.request.get('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      const afterData = await afterResponse.json()
      expect(afterData).toHaveLength(1)
      expect(afterData[0].name).toBe('Key 2')

      // WHEN: Unauthenticated user attempts to revoke key
      const unauthResponse = await page.request.delete(`/api/auth/api-keys/${key1Id}`)

      // THEN: Request fails
      expect(unauthResponse.status()).toBe(401)
    }
  )
})

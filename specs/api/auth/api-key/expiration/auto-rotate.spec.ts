/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Auto-Rotation
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('API Key Auto-Rotation', () => {
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-001: should auto-generate new key before expiration',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key configured for auto-rotation
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              autoRotate: {
                rotationWindow: 24 * 60 * 60 * 1000, // 24 hours before expiration
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // Expires in 48 hours

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Auto-Rotate Key',
          expiresAt: expiresAt.toISOString(),
          autoRotate: true,
        },
      })

      const { id } = await keyResponse.json()

      // WHEN: Time advances into rotation window
      // Simulate entering rotation window (implementation would trigger background job)

      // THEN: New key is auto-generated
      const listResponse = await page.request.get('/api/auth/api-key/list')
      const { apiKeys } = await listResponse.json()

      expect(apiKeys).toHaveLength(2) // Original + rotated
      expect(apiKeys.some((k: any) => k.id === id)).toBe(true)
      expect(apiKeys.some((k: any) => k.name.includes('rotated'))).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-002: should maintain old key during grace period',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with rotated API key in grace period
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              autoRotate: {
                gracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Grace Period Key',
          autoRotate: true,
        },
      })

      const { key: oldKey } = await keyResponse.json()

      // Trigger rotation (implementation specific)
      const rotateResponse = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: oldKey },
      })
      const { newKey } = await rotateResponse.json()

      // WHEN: Old key is used during grace period
      const oldKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${oldKey}` },
      })

      // THEN: Old key still works
      expect(oldKeyTest.status()).toBe(200)

      // THEN: New key also works
      const newKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${newKey}` },
      })
      expect(newKeyTest.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-003: should notify user of key rotation',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key configured for auto-rotation with notifications
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              autoRotate: {
                notifyOnRotation: true,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Notify Key',
          autoRotate: true,
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Key is rotated
      const rotateResponse = await page.request.post('/api/auth/api-key/rotate', {
        data: { key },
      })

      // THEN: Rotation notification is sent
      expect(rotateResponse.status()).toBe(200)
      const data = await rotateResponse.json()
      expect(data).toHaveProperty('notificationSent')
      expect(data.notificationSent).toBe(true)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-004: should revoke old key after grace period',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with rotated API key past grace period
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              autoRotate: {
                gracePeriod: 1, // Minimal grace period (1ms, can't be 0 due to positive() constraint)
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'No Grace Key',
          autoRotate: true,
        },
      })

      const { key: oldKey } = await keyResponse.json()

      // Trigger rotation
      const rotateResponse = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: oldKey },
      })
      const { newKey } = await rotateResponse.json()

      // WHEN: Old key is used after grace period
      const oldKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${oldKey}` },
      })

      // THEN: Old key is revoked
      expect(oldKeyTest.status()).toBe(401)

      // THEN: New key works
      const newKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${newKey}` },
      })
      expect(newKeyTest.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-005: should preserve permissions in rotated key',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key with specific permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: { autoRotate: true },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Permission Key',
          permissions: ['posts:read', 'comments:write'],
          autoRotate: true,
        },
      })

      const { key: oldKey, id } = await keyResponse.json()

      // WHEN: Key is rotated
      const rotateResponse = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: oldKey },
      })
      const { newKey } = await rotateResponse.json()

      // THEN: New key has same permissions
      const newKeyDetails = await page.request.get(`/api/auth/api-key/${id}`)
      const newKeyData = await newKeyDetails.json()

      expect(newKeyData.apiKey.permissions).toEqual(['posts:read', 'comments:write'])

      // Verify permissions work
      const readTest = await page.request.get('/api/posts', {
        headers: { Authorization: `Bearer ${newKey}` },
      })
      expect(readTest.status()).toBe(200)

      const writeTest = await page.request.post('/api/comments', {
        headers: { Authorization: `Bearer ${newKey}` },
        data: { text: 'Test' },
      })
      expect(writeTest.status()).toBe(201)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-006: should support manual rotation trigger',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Manual Rotate',
        },
      })

      const { key: oldKey } = await keyResponse.json()

      // WHEN: User manually triggers rotation
      const rotateResponse = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: oldKey },
      })

      // THEN: New key is generated
      expect(rotateResponse.status()).toBe(200)
      const { newKey } = await rotateResponse.json()

      expect(newKey).toBeDefined()
      expect(newKey).not.toBe(oldKey)

      // THEN: New key works
      const testResponse = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${newKey}` },
      })
      expect(testResponse.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-ROTATE-007: system can manage rotation lifecycle across multiple keys',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with multiple API keys with different rotation configs
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            apiKeys: {
              autoRotate: {
                gracePeriod: 7 * 24 * 60 * 60 * 1000,
              },
            },
          },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // Create key with auto-rotation
      const key1Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Auto Key',
          autoRotate: true,
        },
      })
      const { key: key1 } = await key1Response.json()

      // Create key without auto-rotation
      const key2Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Manual Key',
          autoRotate: false,
        },
      })
      const { key: key2 } = await key2Response.json()

      // WHEN/THEN: Auto key can be rotated
      const rotate1 = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: key1 },
      })
      expect(rotate1.status()).toBe(200)
      const { newKey: newKey1 } = await rotate1.json()

      // WHEN/THEN: During grace period, both old and new work
      const oldKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${key1}` },
      })
      expect(oldKeyTest.status()).toBe(200)

      const newKeyTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${newKey1}` },
      })
      expect(newKeyTest.status()).toBe(200)

      // WHEN/THEN: Manual key can also be rotated
      const rotate2 = await page.request.post('/api/auth/api-key/rotate', {
        data: { key: key2 },
      })
      expect(rotate2.status()).toBe(200)

      // WHEN/THEN: List shows all active keys
      const listResponse = await page.request.get('/api/auth/api-key/list')
      const { apiKeys } = await listResponse.json()
      expect(apiKeys.length).toBeGreaterThanOrEqual(3) // At least original key2 + rotated keys
    }
  )
})

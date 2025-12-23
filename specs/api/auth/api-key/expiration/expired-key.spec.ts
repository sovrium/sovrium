/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for Expired API Key Handling
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Expired API Key Handling', () => {
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-001: should reject requests with expired API key',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with expired API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Expired API key is used
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-002: should return 401 with expiration message',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with expired API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Expired API key is used
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Returns 401 with expiration message
      expect(response.status()).toBe(401)
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('expired')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-003: should allow setting custom expiration time',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User creating API key with future expiration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

      // WHEN: Creating API key with custom expiration
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Future Key',
          expiresAt: futureDate.toISOString(),
        },
      })

      // THEN: Key is created with specified expiration
      expect(response.status()).toBe(201)
      const data = await response.json()
      expect(data.apiKey.expiresAt).toBe(futureDate.toISOString())
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-004: should support never-expiring keys',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User creating API key without expiration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // WHEN: Creating API key without expiresAt
      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Permanent Key',
        },
      })

      const { key } = await keyResponse.json()

      // THEN: Key works and has no expiration
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })
      expect(response.status()).toBe(200)

      const keyData = await keyResponse.json()
      expect(keyData.apiKey.expiresAt).toBeNull()
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-005: should validate expiration before rate limiting',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with expired API key that has rate limit
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          rateLimit: 100,
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: Expired API key is used
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Returns 401 for expiration (not 429 for rate limit)
      expect(response.status()).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('expired')
      expect(data.error).not.toContain('rate limit')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-006: should include expiration metadata in response',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key with expiration
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expiring Key',
          expiresAt: futureDate.toISOString(),
        },
      })

      const { id } = await keyResponse.json()

      // WHEN: Retrieving API key details
      const response = await page.request.get(`/api/auth/api-key/${id}`)

      // THEN: Response includes expiration metadata
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.apiKey).toHaveProperty('expiresAt')
      expect(data.apiKey.expiresAt).toBe(futureDate.toISOString())
      expect(data.apiKey).toHaveProperty('isExpired')
      expect(data.apiKey.isExpired).toBe(false)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-EXPIRED-007: system can handle mixed expired and valid keys',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with multiple API keys (some expired, some valid)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // Create expired key
      const expiredResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Expired Key',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      })
      const { key: expiredKey } = await expiredResponse.json()

      // Create valid key
      const validResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Valid Key',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      const { key: validKey } = await validResponse.json()

      // Create never-expiring key
      const permanentResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Permanent Key',
        },
      })
      const { key: permanentKey } = await permanentResponse.json()

      // WHEN/THEN: Expired key is rejected
      const expiredTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${expiredKey}` },
      })
      expect(expiredTest.status()).toBe(401)

      // WHEN/THEN: Valid key works
      const validTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${validKey}` },
      })
      expect(validTest.status()).toBe(200)

      // WHEN/THEN: Permanent key works
      const permanentTest = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${permanentKey}` },
      })
      expect(permanentTest.status()).toBe(200)
    }
  )
})

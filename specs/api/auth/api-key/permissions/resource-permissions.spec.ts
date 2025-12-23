/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Resource-Specific Permissions
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('API Key Resource Permissions', () => {
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-001: should allow access when key has resource:read permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key that has posts:read permission
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
          name: 'Read Key',
          permissions: ['posts:read'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used to read posts
      const response = await page.request.get('/api/posts', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Request succeeds
      expect(response.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-002: should deny access when key lacks resource permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key that has posts:read but not posts:write
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
          name: 'Read Key',
          permissions: ['posts:read'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used to create post (write permission)
      const response = await page.request.post('/api/posts', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          title: 'New Post',
          content: 'Content',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-003: should support wildcard resource permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key that has posts:* wildcard permission
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
          name: 'Wildcard Key',
          permissions: ['posts:*'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for both read and write operations
      const readResponse = await page.request.get('/api/posts', {
        headers: { Authorization: `Bearer ${key}` },
      })

      const writeResponse = await page.request.post('/api/posts', {
        headers: { Authorization: `Bearer ${key}` },
        data: { title: 'Test', content: 'Content' },
      })

      // THEN: Both operations succeed
      expect(readResponse.status()).toBe(200)
      expect(writeResponse.status()).toBe(201)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-004: should enforce granular resource:action permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key that has posts:read and comments:write
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
          name: 'Mixed Permissions',
          permissions: ['posts:read', 'comments:write'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for allowed and disallowed operations
      const postsRead = await page.request.get('/api/posts', {
        headers: { Authorization: `Bearer ${key}` },
      })

      const postsWrite = await page.request.post('/api/posts', {
        headers: { Authorization: `Bearer ${key}` },
        data: { title: 'Test', content: 'Content' },
      })

      const commentsWrite = await page.request.post('/api/comments', {
        headers: { Authorization: `Bearer ${key}` },
        data: { text: 'Comment' },
      })

      // THEN: Only permitted operations succeed
      expect(postsRead.status()).toBe(200)
      expect(postsWrite.status()).toBe(403)
      expect(commentsWrite.status()).toBe(201)
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-005: should return 403 when action not permitted',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API key that has posts:read only
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
          name: 'Read Only',
          permissions: ['posts:read'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for delete operation (not permitted)
      const response = await page.request.delete('/api/posts/1', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Returns 403 Forbidden with permission error
      expect(response.status()).toBe(403)
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-006: should validate resource:action format',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User attempting to create API key with invalid permission format
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

      // WHEN: Creating API key with invalid permission format (no colon)
      const response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Invalid Key',
          permissions: ['invalid-format'],
        },
      })

      // THEN: Returns 400 Bad Request with format error
      expect(response.status()).toBe(400)
      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('format')
      expect(data.error).toContain('resource:action')
    }
  )
  test.fixme(
    'API-AUTH-API-KEY-RESOURCE-007: system can verify resource permissions across multiple resources',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with API keys for different resources
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

      // Create key with posts:* and comments:read
      const key1Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Mixed Key',
          permissions: ['posts:*', 'comments:read'],
        },
      })
      const { key: key1 } = await key1Response.json()

      // Create key with users:write only
      const key2Response = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'User Write Key',
          permissions: ['users:write'],
        },
      })
      const { key: key2 } = await key2Response.json()

      // WHEN/THEN: Verify key1 permissions
      const postsRead = await page.request.get('/api/posts', {
        headers: { Authorization: `Bearer ${key1}` },
      })
      expect(postsRead.status()).toBe(200)

      const postsWrite = await page.request.post('/api/posts', {
        headers: { Authorization: `Bearer ${key1}` },
        data: { title: 'Test', content: 'Content' },
      })
      expect(postsWrite.status()).toBe(201)

      const commentsRead = await page.request.get('/api/comments', {
        headers: { Authorization: `Bearer ${key1}` },
      })
      expect(commentsRead.status()).toBe(200)

      const commentsWrite = await page.request.post('/api/comments', {
        headers: { Authorization: `Bearer ${key1}` },
        data: { text: 'Test' },
      })
      expect(commentsWrite.status()).toBe(403)

      // WHEN/THEN: Verify key2 permissions
      const usersWrite = await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${key2}` },
        data: { name: 'New User', email: 'new@example.com' },
      })
      expect(usersWrite.status()).toBe(201)

      const postsRead2 = await page.request.get('/api/posts', {
        headers: { Authorization: `Bearer ${key2}` },
      })
      expect(postsRead2.status()).toBe(403)
    }
  )
})

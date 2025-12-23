/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Permission Scopes (read, write, admin)
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('API Key Scoped Access', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-001: should allow read-only API key to access GET endpoints',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with read-only API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read-Only Key',
          scopes: ['read'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for GET request
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      // THEN: Request succeeds
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-002: should reject read-only API key for POST endpoints',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with read-only API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read-Only Key',
          scopes: ['read'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for POST request
      const response = await page.request.post('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          name: 'New User',
          email: 'new@example.com',
        },
      })

      // THEN: Request is rejected with 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
      expect(data.error).toContain('write')
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-003: should allow write API key to access POST and PATCH endpoints',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with write API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Write Key',
          scopes: ['read', 'write'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for write operations
      const createResponse = await page.request.post('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          name: 'New User',
          email: 'new@example.com',
        },
      })

      const user = await createResponse.json()

      const updateResponse = await page.request.patch(`/api/users/${user.id}`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          name: 'Updated User',
        },
      })

      // THEN: Both requests succeed
      expect(createResponse.status()).toBe(201)
      expect(updateResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-004: should reject write API key for admin endpoints',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with write API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Write Key',
          scopes: ['read', 'write'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for admin endpoint
      const response = await page.request.post('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
        },
      })

      // THEN: Request is rejected with 403 Forbidden
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('admin')
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-005: should allow admin API key to access all endpoints',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with admin API key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      const keyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Admin Key',
          scopes: ['read', 'write', 'admin'],
        },
      })

      const { key } = await keyResponse.json()

      // WHEN: API key is used for read, write, and admin operations
      const readResponse = await page.request.get('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      })

      const writeResponse = await page.request.post('/api/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          name: 'New User',
          email: 'new@example.com',
        },
      })

      const adminResponse = await page.request.post('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        data: {
          email: 'another@example.com',
          name: 'Another User',
          role: 'admin',
        },
      })

      // THEN: All requests succeed
      expect(readResponse.status()).toBe(200)
      expect(writeResponse.status()).toBe(201)
      expect(adminResponse.status()).toBe(201)
    }
  )

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-006: should return 401 Unauthorized when API key is invalid',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Server running with API key authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      // WHEN: Invalid API key is used
      const response = await page.request.get('/api/users', {
        headers: {
          Authorization: 'Bearer invalid-api-key-value',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Invalid')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-APIKEY-PERMISSIONS-SCOPE-007: user can create keys with different scopes and verify access levels',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: User with multiple API keys with different scopes
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKey: true },
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Test User',
      })

      // Create read-only key
      const readKeyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read Key',
          scopes: ['read'],
        },
      })
      const { key: readKey } = await readKeyResponse.json()

      // Create write key
      const writeKeyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Write Key',
          scopes: ['read', 'write'],
        },
      })
      const { key: writeKey } = await writeKeyResponse.json()

      // WHEN: Keys are used for various operations
      // Read key - GET succeeds
      const readGetResponse = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${readKey}` },
      })
      expect(readGetResponse.status()).toBe(200)

      // Read key - POST fails
      const readPostResponse = await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${readKey}` },
        data: { name: 'Test', email: 'test@example.com' },
      })
      expect(readPostResponse.status()).toBe(403)

      // Write key - GET succeeds
      const writeGetResponse = await page.request.get('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
      })
      expect(writeGetResponse.status()).toBe(200)

      // Write key - POST succeeds
      const writePostResponse = await page.request.post('/api/users', {
        headers: { Authorization: `Bearer ${writeKey}` },
        data: { name: 'Test', email: 'test@example.com' },
      })
      expect(writePostResponse.status()).toBe(201)

      // THEN: Scope enforcement works correctly for all keys
      const failedErrors = await readPostResponse.json()
      expect(failedErrors.error).toContain('write')
    }
  )
})

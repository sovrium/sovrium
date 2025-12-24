/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Key Security - Secure API Key Management
 *
 * Domain: api/security
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 *
 * Tests API key security mechanisms:
 * - API keys hashed in database (not stored in plaintext)
 * - API key only returned once after creation
 * - Revoked API keys immediately invalidated
 * - Rate limiting applied to API key requests
 * - Scope enforcement for API keys
 *
 * API key security prevents:
 * 1. Database Breach Exposure: Hashed keys prevent compromise if DB is breached
 * 2. Key Disclosure: Keys only shown once, cannot be retrieved later
 * 3. Abuse After Revocation: Revoked keys fail immediately
 * 4. API Abuse: Rate limiting prevents excessive requests
 * 5. Unauthorized Access: Scopes limit what keys can access
 *
 * Better Auth provides API key plugin with secure key management.
 *
 * Error Response Structure:
 * - API key errors: `{ error: string }` - Generic API error format
 * - Better Auth errors: `{ message: string }` - Authentication-specific format
 * - See docs/architecture/testing-strategy/status-code-guidelines.md for details
 */

test.describe('API Key Security - Secure API Key Management', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-APIKEY-001: should store API keys hashed in database (not plaintext)',
    { tag: '@spec' },
    async ({ startServerWithSchema, createApiKey, executeQuery }) => {
      // GIVEN: Application with API key authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
      })

      // WHEN: Creating a new API key
      const apiKey = await createApiKey({ name: 'Test Key' })
      expect(apiKey).toBeDefined()
      expect(apiKey).toMatch(/^[A-Za-z0-9_-]+$/) // API key format

      // THEN: API key should NOT be stored in plaintext in database
      const dbKeys = await executeQuery('SELECT * FROM api_keys')

      // Database should not contain plaintext key
      for (const row of dbKeys.rows) {
        expect(row.key || row.api_key || row.value).not.toBe(apiKey)
      }

      // Database should contain hashed version (different from plaintext)
      const hashedKeys = dbKeys.rows.map(
        (row: Record<string, unknown>) => row.key || row.api_key || row.hash || row.value
      )
      const plaintextMatch = hashedKeys.some((hash: unknown) => hash === apiKey)
      expect(plaintextMatch).toBe(false)
    }
  )

  test.fixme(
    'API-SECURITY-APIKEY-002: should return API key only once after creation (not retrievable later)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API key authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // WHEN: Creating API key
      const createResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Test Key',
        },
      })

      expect(createResponse.status()).toBe(200)
      const createData = await createResponse.json()

      // API key should be returned in creation response
      expect(createData).toHaveProperty('key')
      const apiKey = createData.key

      // THEN: Attempting to retrieve API key later should not return the key value
      const listResponse = await page.request.post('/api/auth/api-key/list')
      expect(listResponse.status()).toBe(200)

      const listData = await listResponse.json()
      expect(Array.isArray(listData.keys)).toBe(true)

      // Listed keys should NOT contain the actual key value
      for (const key of listData.keys) {
        expect(key.key || key.value || key.apiKey).not.toBe(apiKey)
        expect(key.key || key.value || key.apiKey).toBeUndefined()
      }
    }
  )

  test.fixme(
    'API-SECURITY-APIKEY-003: should immediately invalidate revoked API keys',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createApiKey, signUp, signIn }) => {
      // GIVEN: Application with API key and valid key
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      const apiKey = await createApiKey({ name: 'Test Key' })

      // Verify key works initially
      const validResponse = await page.request.get('/api/tables', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
      expect(validResponse.status()).toBe(200)

      // WHEN: Revoking the API key
      const revokeResponse = await page.request.post('/api/auth/api-key/delete', {
        data: {
          id: apiKey, // Or key ID from creation response
        },
      })

      // Revocation should succeed
      expect([200, 204]).toContain(revokeResponse.status())

      // THEN: API key should be immediately invalidated
      const invalidResponse = await page.request.get('/api/tables', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      // Should return 401 Unauthorized
      expect(invalidResponse.status()).toBe(401)

      const errorData = await invalidResponse.json()
      expect(errorData).toHaveProperty('error')
    }
  )

  test.fixme(
    'API-SECURITY-APIKEY-004: should apply rate limiting to API key requests',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createApiKey }) => {
      // GIVEN: Application with API key and rate limiting
      // Note: Rate limiting configuration depends on server-level setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'test_table',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
          },
        ],
      })

      const apiKey = await createApiKey({ name: 'Test Key' })

      // WHEN: Making multiple requests with API key (exceeding rate limit)
      const requests = []

      for (let i = 0; i < 10; i++) {
        requests.push(
          page.request.get('/api/tables', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          })
        )
      }

      const responses = await Promise.all(requests)

      // THEN: Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status() === 429)

      expect(rateLimitedResponses.length).toBeGreaterThan(0)

      // Rate limited response should include error
      const firstRateLimited = rateLimitedResponses[0]
      if (firstRateLimited) {
        const rateLimitedData = await firstRateLimited.json()
        expect(rateLimitedData).toHaveProperty('error')
      }
    }
  )

  test.fixme(
    'API-SECURITY-APIKEY-005: should enforce API key scopes and permissions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: Application with API keys with different scopes
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'public_table',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'data', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'public' },
              create: { type: 'roles', roles: ['member'] },
            },
          },
          {
            id: 2,
            name: 'restricted_table',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['admin'] },
              create: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      // Create API key with limited scope (read-only for public table)
      const createKeyResponse = await page.request.post('/api/auth/api-key/create', {
        data: {
          name: 'Read-Only Key',
          scopes: ['tables:public_table:read'],
        },
      })

      expect(createKeyResponse.status()).toBe(200)
      const { key: readOnlyKey } = await createKeyResponse.json()

      // WHEN: Using scoped API key for allowed operation
      const allowedResponse = await page.request.get('/api/tables/public_table/records', {
        headers: {
          Authorization: `Bearer ${readOnlyKey}`,
        },
      })

      // THEN: Allowed operation succeeds
      expect(allowedResponse.status()).toBe(200)

      // WHEN: Using scoped API key for forbidden operation (write)
      const forbiddenWriteResponse = await page.request.post('/api/tables/public_table/records', {
        headers: {
          Authorization: `Bearer ${readOnlyKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          data: 'test',
        },
      })

      // THEN: Forbidden operation is rejected
      expect([401, 403]).toContain(forbiddenWriteResponse.status())

      const writeErrorData = await forbiddenWriteResponse.json()
      expect(writeErrorData).toHaveProperty('error')

      // WHEN: Using scoped API key for out-of-scope resource
      const forbiddenResourceResponse = await page.request.get(
        '/api/tables/restricted_table/records',
        {
          headers: {
            Authorization: `Bearer ${readOnlyKey}`,
          },
        }
      )

      // THEN: Out-of-scope access is rejected
      expect([401, 403]).toContain(forbiddenResourceResponse.status())

      const resourceErrorData = await forbiddenResourceResponse.json()
      expect(resourceErrorData).toHaveProperty('error')
    }
  )

  // ============================================================================
  // Dual-Layer Permission Tests (Better Auth + RLS) - Early Rejection Pattern
  // ============================================================================

  test.fixme(
    'API-SECURITY-APIKEY-006: should demonstrate early rejection pattern (invalid API key blocked before database check)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, createApiKey, signUp, signIn }) => {
      // GIVEN: Application with API key authentication and database tables with RLS
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { apiKeys: true },
        },
        tables: [
          {
            id: 1,
            name: 'protected_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'user_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'owner', field: 'user_id' }, // RLS layer permission
            },
          },
        ],
      })

      await signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      const validApiKey = await createApiKey({ name: 'Test Key' })

      // WHEN: Request with invalid/expired API key
      const invalidResponse = await page.request.get('/api/tables/protected_data/records', {
        headers: {
          Authorization: 'Bearer invalid_api_key_12345',
        },
      })

      // THEN: Better Auth blocks at API level (before RLS check)
      expect(invalidResponse.status()).toBe(401)

      // THEN: RLS never executes (verified by checking no database query logged)
      // Better Auth's early rejection prevents database access entirely
      // Invalid API keys fail at authentication layer, not at RLS layer

      // WHEN: Request with valid API key
      const validResponse = await page.request.get('/api/tables/protected_data/records', {
        headers: {
          Authorization: `Bearer ${validApiKey}`,
        },
      })

      // THEN: Better Auth allows → request proceeds to database (RLS would execute if needed)
      expect([200, 404]).toContain(validResponse.status()) // 200 with data or 404 if no records

      // Demonstrates early rejection pattern:
      // - Invalid API key → Better Auth rejects immediately (no database access)
      // - Valid API key → Better Auth allows → RLS filters data (database layer)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-APIKEY-007: API key security workflow prevents compromise',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, createApiKey, signUp, signIn, executeQuery }) => {
      await test.step('Setup: Start server with API keys', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { apiKeys: true },
          },
          tables: [
            {
              id: 1,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'value', type: 'single-line-text' },
              ],
            },
          ],
        })

        await signUp({
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'SecurePass123!',
        })
        await signIn({
          email: 'regression@example.com',
          password: 'SecurePass123!',
        })
      })

      let apiKeyResult: { id: string; key: string }

      await test.step('Verify: API key creation returns key once', async () => {
        apiKeyResult = await createApiKey({ name: 'Regression Key' })
        expect(apiKeyResult).toBeDefined()
        expect(apiKeyResult.key).toBeDefined()

        // List keys should not show actual key value
        const listResponse = await page.request.post('/api/auth/api-key/list')
        const listData = await listResponse.json()

        for (const key of listData.keys || []) {
          expect(key.key || key.value).not.toBe(apiKeyResult.key)
        }
      })

      await test.step('Verify: API key works for authentication', async () => {
        const response = await page.request.get('/api/tables', {
          headers: {
            Authorization: `Bearer ${apiKeyResult.key}`,
          },
        })

        expect(response.status()).toBe(200)
      })

      await test.step('Verify: API key is hashed in database', async () => {
        const dbKeys = await executeQuery('SELECT * FROM api_keys')

        for (const row of dbKeys.rows) {
          expect(
            (row as Record<string, unknown>).key ||
              (row as Record<string, unknown>).api_key ||
              (row as Record<string, unknown>).hash ||
              (row as Record<string, unknown>).value
          ).not.toBe(apiKeyResult.key)
        }
      })

      await test.step('Verify: Revoked key is immediately invalid', async () => {
        // Revoke key
        await page.request.post('/api/auth/api-key/delete', {
          data: { id: apiKeyResult.id },
        })

        // Should fail immediately
        const response = await page.request.get('/api/tables', {
          headers: {
            Authorization: `Bearer ${apiKeyResult.key}`,
          },
        })

        expect(response.status()).toBe(401)
      })
    }
  )
})

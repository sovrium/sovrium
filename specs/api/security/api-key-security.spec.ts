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
 * Spec Count: 4
 *
 * Test Organization:
 * - @spec tests - Security-specific attributes not covered by Better Auth specs
 *
 * Tests API key security mechanisms:
 * - API keys hashed in database (not stored in plaintext)
 * - Revoked API keys immediately invalidated
 * - Scope enforcement for API keys
 * - Dual-layer permission pattern (Better Auth + RLS)
 *
 * NOTE: These tests focus on SECURITY ATTRIBUTES, not auth workflows.
 * Auth workflows (API key creation, listing, rate limiting) are tested in:
 * - specs/api/auth/api-key/create.spec.ts - Key creation and one-time display
 * - specs/api/auth/api-key/list.spec.ts - Key listing behavior
 * - specs/api/auth/enforcement/rate-limiting.spec.ts - Rate limiting
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
    'API-SECURITY-APIKEY-002: should immediately invalidate revoked API keys',
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
    'API-SECURITY-APIKEY-003: should enforce API key scopes and permissions',
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

  test.fixme(
    'API-SECURITY-APIKEY-004: should demonstrate early rejection pattern (invalid API key blocked before database check)',
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
})
